import { useEffect, useMemo, useState } from 'react';
import { Heart, ImagePlus, MessageSquare, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Button, EmptyState, Field, Modal, PageHeader, Select, Spinner, TextArea, TextInput, useToast } from '../../components/ui/kit';

interface Post {
  id: string;
  student_id: string;
  course_id: string | null;
  caption: string;
  media_path: string;
  media_type: string;
  created_at: string;
  student: { full_name: string; email: string } | null;
  course: { title: string } | null;
}
interface CourseOpt {
  id: string;
  title: string;
}

function PostMedia({ path, type }: { path: string; type: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    supabase.storage.from('showcase').createSignedUrl(path, 3600).then(({ data }) => live && setUrl(data?.signedUrl ?? null));
    return () => {
      live = false;
    };
  }, [path]);
  if (!url) return <div className="aspect-video w-full animate-pulse rounded-2xl bg-neutral-200/60" />;
  return type === 'video' ? (
    <video src={url} controls className="aspect-video w-full rounded-2xl bg-black object-contain" />
  ) : (
    <img src={url} alt="" className="w-full rounded-2xl object-cover" />
  );
}

export function Showcase() {
  const { profile, isStaff } = useAuth();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [openComments, setOpenComments] = useState<string | null>(null);

  const q = useQuery(async () => {
    const [posts, likes] = await Promise.all([
      unwrap(
        supabase
          .from('showcase_posts')
          .select('id, student_id, course_id, caption, media_path, media_type, created_at, student:profiles!showcase_posts_student_id_fkey(full_name, email), course:courses(title)')
          .order('created_at', { ascending: false }),
      ) as Promise<Post[]>,
      unwrap(supabase.from('showcase_likes').select('post_id, student_id')) as Promise<{ post_id: string; student_id: string }[]>,
    ]);
    return { posts, likes };
  }, []);

  const likeCounts = useMemo(() => {
    const map = new Map<string, { count: number; mine: boolean }>();
    for (const l of q.data?.likes ?? []) {
      const cur = map.get(l.post_id) ?? { count: 0, mine: false };
      cur.count += 1;
      if (l.student_id === profile?.id) cur.mine = true;
      map.set(l.post_id, cur);
    }
    return map;
  }, [q.data, profile?.id]);

  const toggleLike = async (postId: string, liked: boolean) => {
    if (!profile) return;
    if (liked) {
      await supabase.from('showcase_likes').delete().match({ post_id: postId, student_id: profile.id });
    } else {
      await supabase.from('showcase_likes').insert({ post_id: postId, student_id: profile.id });
    }
    q.refetch();
  };

  const remove = async (post: Post) => {
    if (!confirm('Delete this post?')) return;
    await supabase.storage.from('showcase').remove([post.media_path]);
    await supabase.from('showcase_posts').delete().eq('id', post.id);
    toast('Post deleted');
    q.refetch();
  };

  if (q.loading) return <Spinner />;
  const posts = q.data?.posts ?? [];

  return (
    <div>
      <PageHeader
        title="Build showcase"
        subtitle="Share your build, your first flight, anything you're proud of"
        actions={
          <Button onClick={() => setCreating(true)}>
            <ImagePlus size={15} /> Share your build
          </Button>
        }
      />
      {!posts.length ? (
        <EmptyState
          icon={<ImagePlus size={22} />}
          title="Nobody's posted yet"
          description="Be the first — a photo of your build or a clip of your first flight."
          action={<Button onClick={() => setCreating(true)}>Share your build</Button>}
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {posts.map((p) => {
            const l = likeCounts.get(p.id) ?? { count: 0, mine: false };
            const canDelete = p.student_id === profile?.id || isStaff;
            return (
              <GlassCard key={p.id} className="overflow-hidden p-0">
                <PostMedia path={p.media_path} type={p.media_type} />
                <div className="p-4">
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span className="font-medium text-neutral-900">{p.student?.full_name || p.student?.email}</span>
                    {p.course && <span>{p.course.title}</span>}
                  </div>
                  {p.caption && <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">{p.caption}</p>}
                  <div className="mt-3 flex items-center gap-4 text-sm text-neutral-500">
                    <button onClick={() => toggleLike(p.id, l.mine)} className={`flex items-center gap-1.5 ${l.mine ? 'text-red-500' : 'hover:text-red-500'}`}>
                      <Heart size={15} fill={l.mine ? 'currentColor' : 'none'} /> {l.count || ''}
                    </button>
                    <button onClick={() => setOpenComments(p.id)} className="flex items-center gap-1.5 hover:text-neutral-800">
                      <MessageSquare size={15} /> Comment
                    </button>
                    {canDelete && (
                      <button onClick={() => remove(p)} className="ml-auto text-neutral-400 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {creating && <NewPostModal studentId={profile!.id} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); q.refetch(); }} />}
      {openComments && <CommentsModal postId={openComments} onClose={() => setOpenComments(null)} />}
    </div>
  );
}

function NewPostModal({ studentId, onClose, onCreated }: { studentId: string; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [caption, setCaption] = useState('');
  const [courseId, setCourseId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const q = useQuery(async () => {
    const enrollments = (await unwrap(
      supabase.from('enrollments').select('course:courses(id, title)').eq('student_id', studentId).eq('status', 'active'),
    )) as { course: CourseOpt | null }[];
    return { courses: enrollments.map((e) => e.course).filter((c): c is CourseOpt => !!c) };
  }, [studentId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast('Choose a photo or video first', 'error');
    setBusy(true);
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
    const path = `${studentId}/${Date.now()}-${file.name}`;
    const up = await supabase.storage.from('showcase').upload(path, file);
    if (up.error) {
      setBusy(false);
      return toast(up.error.message, 'error');
    }
    const { error } = await supabase.from('showcase_posts').insert({
      student_id: studentId,
      course_id: courseId || null,
      caption: caption.trim(),
      media_path: path,
      media_type: mediaType,
    });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Shared!');
    onCreated();
  };

  return (
    <Modal open onClose={onClose} title="Share your build">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Photo or video">
          <input
            type="file"
            accept="image/*,video/*"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-full file:border-0 file:bg-[#1a1a1a] file:px-4 file:py-2 file:text-xs file:font-medium file:text-white"
          />
        </Field>
        <Field label="Caption">
          <TextArea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} placeholder="What did you build or fly?" />
        </Field>
        {!!q.data?.courses.length && (
          <Field label="Course (optional)">
            <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">— none —</option>
              {q.data.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Post
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CommentsModal({ postId, onClose }: { postId: string; onClose: () => void }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const q = useQuery(async () => {
    const comments = (await unwrap(
      supabase
        .from('showcase_comments')
        .select('id, body, created_at, author:profiles!showcase_comments_author_id_fkey(full_name, email)')
        .eq('post_id', postId)
        .order('created_at'),
    )) as { id: string; body: string; created_at: string; author: { full_name: string; email: string } | null }[];
    return { comments };
  }, [postId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('showcase_comments').insert({ post_id: postId, author_id: profile!.id, body: body.trim() });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    setBody('');
    q.refetch();
  };

  return (
    <Modal open onClose={onClose} title="Comments">
      {q.loading ? (
        <Spinner />
      ) : !q.data?.comments.length ? (
        <p className="mb-4 text-sm text-neutral-400">No comments yet.</p>
      ) : (
        <div className="mb-4 max-h-72 space-y-3 overflow-y-auto pr-1">
          {q.data.comments.map((c) => (
            <div key={c.id} className="rounded-xl bg-white/50 p-3 text-sm">
              <div className="font-medium text-neutral-900">{c.author?.full_name || c.author?.email}</div>
              <p className="mt-0.5 text-neutral-700">{c.body}</p>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={send} className="flex gap-2">
        <TextInput className="flex-1" placeholder="Add a comment…" value={body} onChange={(e) => setBody(e.target.value)} />
        <Button type="submit" loading={busy}>
          Send
        </Button>
      </form>
    </Modal>
  );
}
