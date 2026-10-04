import { useMemo, useState } from 'react';
import { CheckCircle2, MessageSquareHeart, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { StarRating } from '../../components/StarRating';
import { Button, EmptyState, Field, PageHeader, Select, Spinner, TextArea, useToast } from '../../components/ui/kit';

interface MyReview {
  id: string;
  group_id: string | null;
  rating: number;
  comment: string;
  updated_at: string;
}
interface Membership {
  group: { id: string; name: string } | null;
}

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/**
 * One review per student per course group, final: once submitted it can't be edited or
 * deleted (the database allows no student update/delete either). Staff can remove a review,
 * which lets the student submit again.
 */
export function Reviews() {
  const { profile, isStaff } = useAuth();
  const toast = useToast();
  const [target, setTarget] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const q = useQuery(async () => {
    const [reviews, memberships] = await Promise.all([
      unwrap(
        supabase.from('reviews').select('id, group_id, rating, comment, updated_at').eq('student_id', profile!.id).not('group_id', 'is', null).order('updated_at', { ascending: false }),
      ) as Promise<MyReview[]>,
      // Students see the groups they belong to; staff previewing this page see every group.
      isStaff
        ? (unwrap(supabase.from('course_groups').select('id, name').order('name')) as Promise<{ id: string; name: string }[]>)
        : (unwrap(supabase.from('course_group_members').select('group:course_groups(id, name)').eq('student_id', profile!.id)) as unknown as Promise<Membership[]>),
    ]);
    const groups = (memberships as (Membership | { id: string; name: string })[])
      .map((m) => ('group' in m ? m.group : m))
      .filter((g): g is { id: string; name: string } => !!g);
    return { reviews, groups };
  }, [profile?.id, isStaff]);

  const reviews = useMemo(() => q.data?.reviews ?? [], [q.data]);
  const groups = useMemo(() => q.data?.groups ?? [], [q.data]);
  const current = target ?? groups[0]?.id ?? '';
  const nameFor = (groupId: string | null) => groups.find((g) => g.id === groupId)?.name ?? 'Group';
  const existing = reviews.find((r) => r.group_id === current);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || existing) return;
    if (!rating) return toast('Pick a star rating first', 'error');
    if (!confirm('Submit your review? You can only review this group once, and it cannot be changed afterwards.')) return;
    setBusy(true);
    const { error } = await supabase.from('reviews').insert({ rating, comment: comment.trim(), student_id: profile!.id, group_id: current });
    setBusy(false);
    if (error) return toast(error.code === '23505' ? 'You have already reviewed this group.' : error.message, 'error');
    toast('Thanks for your review!');
    setRating(0);
    setComment('');
    q.refetch();
  };

  if (q.loading && !q.data) return <Spinner />;

  return (
    <div>
      <PageHeader title="Reviews" subtitle="Tell us how your learning is going — your honest feedback shapes the next batch" />

      {!groups.length ? (
        <EmptyState
          icon={<MessageSquareHeart size={22} />}
          title={isStaff ? 'No course groups yet' : 'No course group yet'}
          description={
            isStaff
              ? 'Create a course group under Admin → Course Groups and students in it can review it here.'
              : 'Reviews are collected for your course group. Once your instructor adds you to one, it will appear here.'
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <GlassCard className="p-5 lg:col-span-3">
            <div className="space-y-4">
              {isStaff && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800">
                  Staff preview — students see only their own group here. Only students can submit; read reviews in Admin → Reviews.
                </div>
              )}
              <Field label="Course group">
                <Select value={current} onChange={(e) => setTarget(e.target.value)}>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                      {reviews.some((r) => r.group_id === g.id) ? ' — reviewed' : ''}
                    </option>
                  ))}
                </Select>
              </Field>

              {existing ? (
                <div className="rounded-2xl border border-green-200 bg-green-50/70 p-5">
                  <div className="flex items-center gap-2 font-medium text-green-800">
                    <CheckCircle2 size={18} /> You've reviewed {nameFor(existing.group_id)} — thank you!
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <StarRating value={existing.rating} size={24} />
                    <span className="text-sm text-neutral-600">{LABELS[existing.rating]}</span>
                  </div>
                  {existing.comment && <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-700">{existing.comment}</p>}
                  <p className="mt-3 text-xs text-neutral-500">
                    Submitted {new Date(existing.updated_at).toLocaleDateString()}. Each student can review a group once, so this can't be changed.
                  </p>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <Field label="Your rating" required>
                    <div className="flex items-center gap-3">
                      <StarRating value={rating} onChange={setRating} size={28} />
                      <span className="text-sm text-neutral-500">{LABELS[rating]}</span>
                    </div>
                  </Field>
                  <Field label="Your feedback" hint="What was useful, what was confusing, what should we improve? (optional)">
                    <TextArea rows={5} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tell us in your own words…" />
                  </Field>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-neutral-400">One review per group — it can't be edited after you submit.</span>
                    <Button type="submit" loading={busy} disabled={isStaff}>
                      <Send size={14} /> Submit review
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </GlassCard>

          <div className="lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold text-neutral-700">Your reviews</h2>
            {!reviews.length ? (
              <EmptyState icon={<MessageSquareHeart size={22} />} title="No reviews yet" description="Your submitted reviews will show up here." />
            ) : (
              <div className="space-y-3">
                {reviews.map((r) => (
                  <GlassCard key={r.id} className="p-4">
                    <button type="button" onClick={() => setTarget(r.group_id)} className="block min-w-0 text-left">
                      <div className="truncate text-sm font-medium text-neutral-900">{nameFor(r.group_id)}</div>
                      <div className="mt-1">
                        <StarRating value={r.rating} size={14} />
                      </div>
                    </button>
                    {r.comment && <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600">{r.comment}</p>}
                    <div className="mt-2 text-[11px] text-neutral-400">{new Date(r.updated_at).toLocaleDateString()}</div>
                  </GlassCard>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
