import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, Checkbox, EmptyState, Field, Modal, PageHeader, Select, Spinner, TextArea, TextInput, useToast } from '../../components/ui/kit';

interface OptionDraft {
  label: string;
  is_correct: boolean;
}

export function QuestionBank() {
  const { courseId } = useParams();
  const { profile } = useAuth();
  const { canWrite } = useAdminAccess();
  const writable = canWrite('courses');
  const toast = useToast();
  const [editing, setEditing] = useState<any | null>(null);

  const q = useQuery(async () => {
    const [course, questions] = await Promise.all([
      unwrap(supabase.from('courses').select('id, title, exam_question_count').eq('id', courseId as string).single()) as Promise<any>,
      unwrap(
        supabase
          .from('questions')
          .select('id, prompt, type, explanation, is_active, question_options(id, label, is_correct, position)')
          .eq('course_id', courseId as string)
          .order('created_at', { ascending: true }),
      ) as Promise<any[]>,
    ]);
    return { course, questions };
  }, [courseId]);

  const activeCount = q.data?.questions.filter((x) => x.is_active).length ?? 0;

  const openNew = () =>
    setEditing({
      id: null,
      prompt: '',
      type: 'single',
      explanation: '',
      is_active: true,
      options: [
        { label: '', is_correct: true },
        { label: '', is_correct: false },
      ] as OptionDraft[],
    });

  const openEdit = (row: any) =>
    setEditing({
      id: row.id,
      prompt: row.prompt,
      type: row.type,
      explanation: row.explanation ?? '',
      is_active: row.is_active,
      options: [...row.question_options].sort((a: any, b: any) => a.position - b.position).map((o: any) => ({ label: o.label, is_correct: o.is_correct })),
    });

  const save = async () => {
    const e = editing;
    const opts: OptionDraft[] = e.options.filter((o: OptionDraft) => o.label.trim());
    if (!e.prompt.trim()) return toast('Enter a question prompt', 'error');
    if (opts.length < 2) return toast('Add at least two options', 'error');
    if (!opts.some((o) => o.is_correct)) return toast('Mark at least one correct option', 'error');

    let questionId = e.id;
    if (questionId) {
      const { error } = await supabase.from('questions').update({ prompt: e.prompt, type: e.type, explanation: e.explanation, is_active: e.is_active }).eq('id', questionId);
      if (error) return toast(error.message, 'error');
      await supabase.from('question_options').delete().eq('question_id', questionId);
    } else {
      const { data, error } = await supabase
        .from('questions')
        .insert({ course_id: courseId, prompt: e.prompt, type: e.type, explanation: e.explanation, is_active: e.is_active, created_by: profile!.id })
        .select('id')
        .single();
      if (error) return toast(error.message, 'error');
      questionId = data.id;
    }
    const { error: optErr } = await supabase
      .from('question_options')
      .insert(opts.map((o, i) => ({ question_id: questionId, label: o.label.trim(), is_correct: o.is_correct, position: i })));
    if (optErr) return toast(optErr.message, 'error');
    setEditing(null);
    q.refetch();
    toast('Question saved');
  };

  const del = async (id: string) => {
    if (!confirm('Delete this question?')) return;
    await supabase.from('questions').delete().eq('id', id);
    q.refetch();
  };

  if (q.loading) return <Spinner />;
  if (q.error) return <p className="text-sm text-red-600">{q.error}</p>;

  return (
    <div>
      <Link to="/admin/courses" className="mb-3 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800">
        <ChevronLeft size={15} /> Courses
      </Link>
      <PageHeader
        title={`Question bank · ${q.data!.course.title}`}
        subtitle={`${activeCount} active questions · exam draws ${q.data!.course.exam_question_count}`}
        actions={
          writable && (
            <Button onClick={openNew}>
              <Plus size={16} /> Add question
            </Button>
          )
        }
      />

      {activeCount < q.data!.course.exam_question_count && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The bank has fewer active questions ({activeCount}) than the exam draw size ({q.data!.course.exam_question_count}). Add more or lower the draw size on the course.
        </div>
      )}

      {!q.data!.questions.length ? (
        <EmptyState title="No questions yet" description="Add multiple-choice questions to power this course’s exam." action={writable && <Button onClick={openNew}>Add question</Button>} />
      ) : (
        <div className="space-y-3">
          {q.data!.questions.map((row, i) => (
            <GlassCard key={row.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-neutral-400">Q{i + 1}</span>
                    <Badge tone={row.type === 'multi' ? 'blue' : 'neutral'}>{row.type}</Badge>
                    {!row.is_active && <Badge tone="amber">inactive</Badge>}
                  </div>
                  <button onClick={() => openEdit(row)} className="mt-1 text-left font-medium text-neutral-900 hover:text-blue-600">
                    {row.prompt}
                  </button>
                  <ul className="mt-2 space-y-0.5 text-sm">
                    {[...row.question_options].sort((a: any, b: any) => a.position - b.position).map((o: any) => (
                      <li key={o.id} className={o.is_correct ? 'text-green-700' : 'text-neutral-500'}>
                        {o.is_correct ? '✓' : '·'} {o.label}
                      </li>
                    ))}
                  </ul>
                </div>
                {writable && (
                  <button onClick={() => del(row.id)} className="text-neutral-400 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={writable ? (editing?.id ? 'Edit question' : 'New question') : 'View question'} wide>
        {editing && (
          <div className="space-y-4">
            <Field label="Prompt" required>
              <TextArea disabled={!writable} value={editing.prompt} onChange={(e) => setEditing({ ...editing, prompt: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Type">
                <Select disabled={!writable} value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>
                  <option value="single">single answer</option>
                  <option value="multi">multiple answers</option>
                </Select>
              </Field>
              <div className="flex items-end pb-2">
                <Checkbox disabled={!writable} label="Active (included in exams)" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-sm font-medium text-neutral-700">Options</div>
              <div className="space-y-2">
                {editing.options.map((o: OptionDraft, idx: number) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type={editing.type === 'single' ? 'radio' : 'checkbox'}
                      name="correct"
                      disabled={!writable}
                      checked={o.is_correct}
                      onChange={(e) => {
                        const next = [...editing.options];
                        if (editing.type === 'single') next.forEach((x: OptionDraft, i: number) => (x.is_correct = i === idx));
                        else next[idx].is_correct = e.target.checked;
                        setEditing({ ...editing, options: next });
                      }}
                    />
                    <TextInput
                      disabled={!writable}
                      value={o.label}
                      placeholder={`Option ${idx + 1}`}
                      onChange={(e) => {
                        const next = [...editing.options];
                        next[idx].label = e.target.value;
                        setEditing({ ...editing, options: next });
                      }}
                    />
                    {writable && (
                      <button
                        onClick={() => setEditing({ ...editing, options: editing.options.filter((_: unknown, i: number) => i !== idx) })}
                        className="text-neutral-400 hover:text-red-500"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {writable && (
                <Button variant="ghost" className="mt-2" onClick={() => setEditing({ ...editing, options: [...editing.options, { label: '', is_correct: false }] })}>
                  <Plus size={14} /> Add option
                </Button>
              )}
            </div>

            <Field label="Explanation" hint="Shown after grading (optional)">
              <TextInput disabled={!writable} value={editing.explanation} onChange={(e) => setEditing({ ...editing, explanation: e.target.value })} />
            </Field>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                {writable ? 'Cancel' : 'Close'}
              </Button>
              {writable && <Button onClick={save}>Save question</Button>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
