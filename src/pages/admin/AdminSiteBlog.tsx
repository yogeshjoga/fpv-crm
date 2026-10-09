import { useRef, useState } from 'react';
import { ArrowLeft, ImagePlus, Newspaper, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useQuery, unwrap } from '../../lib/useQuery';
import { slugify } from '../../lib/slug';
import { publicUrl, removeMedia, uploadBlogCover } from '../../lib/siteMedia';
import { GlassCard } from '../../components/ui/shared';
import { MarkdownPreview } from '../../components/ui/MarkdownPreview';
import { Badge, Button, Checkbox, EmptyState, Field, PageHeader, Spinner, TextArea, TextInput, useToast } from '../../components/ui/kit';

interface Post {
  id: string; slug: string; title: string; excerpt: string; category: string; author: string;
  content_md: string; cover_path: string | null; read_minutes: number;
  is_published: boolean; published_at: string | null; updated_at: string;
}

export function AdminSiteBlog() {
  const [editing, setEditing] = useState<Post | 'new' | null>(null);
  const posts = useQuery(
    () => unwrap(supabase.from('site_blog_posts').select('*').order('published_at', { ascending: false, nullsFirst: true }).order('created_at', { ascending: false })) as Promise<Post[]>,
    [],
  );

  if (posts.loading) return <Spinner />;

  if (editing) {
    return (
      <PostEditor
        key={editing === 'new' ? 'new' : editing.id}
        post={editing === 'new' ? null : editing}
        categories={[...new Set((posts.data ?? []).map((p) => p.category))]}
        onBack={() => setEditing(null)}
        onSaved={() => { setEditing(null); posts.refetch(); }}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Site Blog"
        subtitle="Articles shown on the public website's Journal page. Super admins only."
        actions={<Button onClick={() => setEditing('new')}><Plus size={15} /> New post</Button>}
      />
      {!posts.data?.length ? (
        <EmptyState icon={<Newspaper size={22} />} title="No posts yet" description="Write the first article." />
      ) : (
        <div className="space-y-3">
          {posts.data.map((p) => (
            <button key={p.id} onClick={() => setEditing(p)} className="block w-full text-left">
              <GlassCard className="flex items-center gap-4 p-4 transition-transform hover:-translate-y-0.5">
                {p.cover_path ? (
                  <img src={publicUrl(p.cover_path)} alt="" className="h-14 w-20 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-300"><Newspaper size={20} /></div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-neutral-900">{p.title}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                    <Badge tone="blue">{p.category}</Badge>
                    <span>{p.author}</span>
                    <span>· updated {new Date(p.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <Badge tone={p.is_published ? 'green' : 'amber'}>{p.is_published ? 'Published' : 'Draft'}</Badge>
              </GlassCard>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PostEditor({ post, categories, onBack, onSaved }: { post: Post | null; categories: string[]; onBack: () => void; onSaved: () => void }) {
  const toast = useToast();
  const coverRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(post?.title ?? '');
  const [slug, setSlug] = useState(post?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(!!post);
  const [category, setCategory] = useState(post?.category ?? 'General');
  const [author, setAuthor] = useState(post?.author ?? 'EGIRE Team');
  const [minutes, setMinutes] = useState(post?.read_minutes ?? 5);
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '');
  const [content, setContent] = useState(post?.content_md ?? '');
  const [cover, setCover] = useState<string | null>(post?.cover_path ?? null);
  const [published, setPublished] = useState(post?.is_published ?? false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedThisSession, setUploadedThisSession] = useState<string[]>([]);

  const onTitle = (v: string) => {
    setTitle(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const pickCover = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadBlogCover(file);
      setUploadedThisSession((u) => [...u, path]);
      setCover(path);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed', 'error');
    }
    setUploading(false);
    if (coverRef.current) coverRef.current.value = '';
  };

  const save = async () => {
    if (!title.trim()) return toast('Add a title', 'error');
    const finalSlug = slugify(slug || title);
    if (!finalSlug) return toast('Add a web address (slug) using letters or numbers', 'error');
    setSaving(true);
    const now = new Date().toISOString();
    const fields = {
      slug: finalSlug,
      title: title.trim(),
      excerpt: excerpt.trim(),
      category: category.trim() || 'General',
      author: author.trim() || 'EGIRE Team',
      content_md: content,
      cover_path: cover,
      read_minutes: Math.min(120, Math.max(1, Number(minutes) || 5)),
      is_published: published,
      published_at: published ? post?.published_at ?? now : post?.published_at ?? null,
      updated_at: now,
    };
    const { error } = post
      ? await supabase.from('site_blog_posts').update(fields).eq('id', post.id)
      : await supabase.from('site_blog_posts').insert(fields);
    setSaving(false);
    if (error) return toast(/duplicate key/i.test(error.message) ? 'That web address is already used by another post' : error.message, 'error');
    // covers uploaded this session but replaced before saving are orphaned — clean them up
    await removeMedia(uploadedThisSession.filter((p) => p !== cover));
    if (post?.cover_path && post.cover_path !== cover) await removeMedia([post.cover_path]);
    toast(published ? 'Saved — live on the website' : 'Saved as draft');
    onSaved();
  };

  const remove = async () => {
    if (!post || !confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('site_blog_posts').delete().eq('id', post.id);
    if (error) return toast(error.message, 'error');
    await removeMedia([post.cover_path, ...uploadedThisSession]);
    toast('Post deleted');
    onSaved();
  };

  return (
    <div>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800">
        <ArrowLeft size={15} /> All posts
      </button>
      <PageHeader
        title={post ? 'Edit post' : 'New post'}
        actions={
          <>
            {post && <Button variant="ghost" onClick={remove} title="Delete post"><Trash2 size={15} /></Button>}
            <Button onClick={save} loading={saving}>Save</Button>
          </>
        }
      />

      <GlassCard className="mb-5 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Title" required>
            <TextInput value={title} onChange={(e) => onTitle(e.target.value)} />
          </Field>
          <Field label="Web address (slug)" hint="Used in the post's link. Letters, numbers and dashes.">
            <TextInput value={slug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }} />
          </Field>
          <Field label="Category">
            <TextInput value={category} onChange={(e) => setCategory(e.target.value)} list="blog-categories" />
            <datalist id="blog-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Author"><TextInput value={author} onChange={(e) => setAuthor(e.target.value)} /></Field>
            <Field label="Read time (min)"><TextInput type="number" min={1} max={120} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></Field>
          </div>
        </div>
        <div className="mt-4">
          <Field label="Short summary" hint="Shown on the article card.">
            <TextArea rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {cover ? <img src={publicUrl(cover)} alt="" className="h-20 w-32 rounded-lg object-cover" /> : <div className="flex h-20 w-32 items-center justify-center rounded-lg bg-neutral-100 text-neutral-300"><ImagePlus size={22} /></div>}
          <div>
            <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pickCover(e.target.files?.[0])} disabled={uploading}
              className="block text-sm text-neutral-600 file:mr-3 file:rounded-full file:border-0 file:bg-white/80 file:px-3 file:py-1.5 file:text-xs file:font-medium" />
            <p className="mt-1 text-xs text-neutral-500">{uploading ? 'Uploading…' : 'Optional cover image.'}</p>
            {cover && <button onClick={() => setCover(null)} className="mt-1 text-xs text-red-600 hover:underline">Remove cover</button>}
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard className="p-5">
          <Field label="Article (Markdown)" hint="# Heading, ## Subheading, **bold**, *italic*, - lists, [link](https://…)">
            <TextArea rows={22} value={content} onChange={(e) => setContent(e.target.value)} className="font-mono text-xs" />
          </Field>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Preview</div>
          <MarkdownPreview source={content} />
        </GlassCard>
      </div>

      <div className="mt-5">
        <Checkbox label="Published — visible on the public website" checked={published} onChange={(e) => setPublished(e.target.checked)} />
      </div>
    </div>
  );
}
