import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, FileText, Plus, Trash2, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Button, Field, Modal, PageHeader, Select, Spinner, TextArea, TextInput, useToast } from '../../components/ui/kit';

export function CourseBuilder() {
  const { id } = useParams();
  const { profile } = useAuth();
  const toast = useToast();
  const [newModule, setNewModule] = useState('');
  const [editingLesson, setEditingLesson] = useState<any | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const q = useQuery(async () => {
    return (await unwrap(
      supabase
        .from('courses')
        .select('id, title, slug, modules(id, title, position, lessons(id, title, position, kind, content, video_url, embed_url, lesson_resources(id, file_name, file_path)))')
        .eq('id', id as string)
        .single(),
    )) as any;
  }, [id]);

  if (q.loading) return <Spinner />;
  if (q.error) return <p className="text-sm text-red-600">{q.error}</p>;
  const course = q.data;
  const modules = [...(course.modules ?? [])].sort((a: any, b: any) => a.position - b.position);

  const addModule = async () => {
    const title = newModule.trim();
    if (!title) return toast('Type a module title first', 'error');
    const { error } = await supabase.from('modules').insert({ course_id: course.id, title, position: modules.length });
    if (error) return toast(error.message, 'error');
    setNewModule('');
    toast('Module added');
    q.refetch();
  };

  const delModule = async (mid: string) => {
    if (!confirm('Delete this module and its lessons?')) return;
    await supabase.from('modules').delete().eq('id', mid);
    q.refetch();
  };

  const addLesson = async (mid: string, count: number) => {
    const { error } = await supabase.from('lessons').insert({ module_id: mid, title: 'New lesson', position: count });
    if (error) return toast(error.message, 'error');
    q.refetch();
  };

  const delLesson = async (lid: string) => {
    if (!confirm('Delete this lesson?')) return;
    await supabase.from('lessons').delete().eq('id', lid);
    q.refetch();
  };

  const saveLesson = async () => {
    const { id: lid, title, kind, content, video_url, embed_url } = editingLesson;
    const { error } = await supabase
      .from('lessons')
      .update({ title, kind, content, video_url: video_url || null, embed_url: embed_url || null })
      .eq('id', lid);
    if (error) return toast(error.message, 'error');
    setEditingLesson(null);
    q.refetch();
  };

  const uploadResource = async (lessonId: string, file: File) => {
    setUploadingFor(lessonId);
    const path = `${course.id}/${lessonId}/${Date.now()}-${file.name}`;
    const up = await supabase.storage.from('course-resources').upload(path, file, { upsert: false });
    if (up.error) {
      setUploadingFor(null);
      return toast(up.error.message, 'error');
    }
    const { error } = await supabase.from('lesson_resources').insert({
      lesson_id: lessonId,
      file_path: path,
      file_name: file.name,
      mime: file.type,
      size_bytes: file.size,
      uploaded_by: profile!.id,
    });
    setUploadingFor(null);
    if (error) return toast(error.message, 'error');
    toast('Resource uploaded');
    q.refetch();
  };

  const delResource = async (rid: string, path: string) => {
    await supabase.storage.from('course-resources').remove([path]);
    await supabase.from('lesson_resources').delete().eq('id', rid);
    q.refetch();
  };

  return (
    <div>
      <Link to="/admin/courses" className="mb-3 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800">
        <ChevronLeft size={15} /> Courses
      </Link>
      <PageHeader title={course.title} subtitle="Modules, lessons and PDF resources" />

      <div className="mb-5 flex gap-2">
        <TextInput placeholder="New module title…" value={newModule} onChange={(e) => setNewModule(e.target.value)} className="max-w-xs" />
        <Button onClick={addModule}>
          <Plus size={15} /> Add module
        </Button>
      </div>

      <div className="space-y-4">
        {modules.map((m: any, mi: number) => {
          const lessons = [...(m.lessons ?? [])].sort((a: any, b: any) => a.position - b.position);
          return (
            <GlassCard key={m.id} className="p-5">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-neutral-900">
                  <span className="text-neutral-400">Module {mi + 1} · </span>
                  {m.title}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => addLesson(m.id, lessons.length)}>
                    <Plus size={14} /> Lesson
                  </Button>
                  <button onClick={() => delModule(m.id)} className="text-neutral-400 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {lessons.map((l: any, li: number) => (
                  <div key={l.id} className="rounded-2xl border border-white/60 bg-white/40 p-3">
                    <div className="flex items-center justify-between">
                      <button onClick={() => setEditingLesson({ ...l })} className="text-left text-sm font-medium text-neutral-900 hover:text-blue-600">
                        {mi + 1}.{li + 1} {l.title}
                      </button>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer text-neutral-400 hover:text-blue-600" title="Upload PDF">
                          {uploadingFor === l.id ? '…' : <Upload size={15} />}
                          <input
                            type="file"
                            accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,image/*"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && uploadResource(l.id, e.target.files[0])}
                          />
                        </label>
                        <button onClick={() => delLesson(l.id)} className="text-neutral-400 hover:text-red-500">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    {!!l.lesson_resources?.length && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {l.lesson_resources.map((r: any) => (
                          <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-xs text-neutral-600">
                            <FileText size={12} /> {r.file_name}
                            <button onClick={() => delResource(r.id, r.file_path)} className="text-neutral-400 hover:text-red-500">
                              <Trash2 size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {!lessons.length && <p className="text-sm text-neutral-400">No lessons yet.</p>}
              </div>
            </GlassCard>
          );
        })}
        {!modules.length && <p className="text-sm text-neutral-400">Add a module to start building.</p>}
      </div>

      <Modal open={!!editingLesson} onClose={() => setEditingLesson(null)} title="Edit lesson" wide>
        {editingLesson && (
          <div className="space-y-4">
            <Field label="Title">
              <TextInput value={editingLesson.title} onChange={(e) => setEditingLesson({ ...editingLesson, title: e.target.value })} />
            </Field>
            <Field label="Lesson type">
              <Select value={editingLesson.kind ?? 'article'} onChange={(e) => setEditingLesson({ ...editingLesson, kind: e.target.value })}>
                <option value="article">Article (text / blog)</option>
                <option value="video">Video</option>
                <option value="embed">Embed (simulator, 3D model, slides…)</option>
                <option value="download">Downloads only</option>
              </Select>
            </Field>
            {(editingLesson.kind ?? 'article') === 'article' && (
              <Field label="Content" hint="Plain text or markdown">
                <TextArea
                  value={editingLesson.content ?? ''}
                  onChange={(e) => setEditingLesson({ ...editingLesson, content: e.target.value })}
                  className="min-h-[160px]"
                />
              </Field>
            )}
            {editingLesson.kind === 'video' && (
              <Field label="Video URL" hint="YouTube / Vimeo link">
                <TextInput value={editingLesson.video_url ?? ''} onChange={(e) => setEditingLesson({ ...editingLesson, video_url: e.target.value })} />
              </Field>
            )}
            {editingLesson.kind === 'embed' && (
              <Field label="Embed URL" hint="Sketchfab 3D model, VelociDrone/Uncrashed/Betaflight sim, Google Slides, a hosted PDF — anything embeddable">
                <TextInput value={editingLesson.embed_url ?? ''} onChange={(e) => setEditingLesson({ ...editingLesson, embed_url: e.target.value })} placeholder="https://…" />
              </Field>
            )}
            <p className="text-xs text-neutral-500">
              Attach PDFs, PPTs, DOCs and images from each lesson row (upload icon). Images preview inline for students.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditingLesson(null)}>
                Cancel
              </Button>
              <Button onClick={saveLesson}>Save lesson</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
