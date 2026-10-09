import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Globe, MessageSquareHeart, Pencil, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { StarRating } from '../../components/StarRating';
import { Button, Checkbox, EmptyState, Field, PageHeader, Select, Spinner, TextArea, useToast } from '../../components/ui/kit';

interface MyReview {
  id: string;
  group_id: string | null;
  rating: number;
  comment: string;
  updated_at: string;
}
interface EditRequest {
  id: string;
  review_id: string;
  status: 'pending' | 'approved' | 'denied' | 'used';
  created_at: string;
}
interface Membership {
  group: { id: string; name: string } | null;
}

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/**
 * One review per student per course group. After submitting it is locked: to change it the
 * student sends an edit request with a reason, and only if staff approve does the review
 * unlock — for a single edit, after which it locks again (enforced by the database).
 */
export function Reviews() {
  const { profile, isStaff } = useAuth();
  const toast = useToast();
  const [target, setTarget] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [share, setShare] = useState(false);

  const q = useQuery(async () => {
    const [reviews, memberships, requests, consents] = await Promise.all([
      unwrap(
        supabase.from('reviews').select('id, group_id, rating, comment, updated_at').eq('student_id', profile!.id).not('group_id', 'is', null).order('updated_at', { ascending: false }),
      ) as Promise<MyReview[]>,
      // Students see the groups they belong to; staff previewing this page see every group.
      isStaff
        ? (unwrap(supabase.from('course_groups').select('id, name').order('name')) as Promise<{ id: string; name: string }[]>)
        : (unwrap(supabase.from('course_group_members').select('group:course_groups(id, name)').eq('student_id', profile!.id)) as unknown as Promise<Membership[]>),
      unwrap(supabase.from('review_edit_requests').select('id, review_id, status, created_at').eq('student_id', profile!.id).order('created_at', { ascending: false })) as Promise<EditRequest[]>,
      unwrap(supabase.from('review_website_consent').select('review_id, allowed')) as Promise<{ review_id: string; allowed: boolean }[]>,
    ]);
    const groups = (memberships as (Membership | { id: string; name: string })[])
      .map((m) => ('group' in m ? m.group : m))
      .filter((g): g is { id: string; name: string } => !!g);
    return { reviews, groups, requests, consents };
  }, [profile?.id, isStaff]);

  const reviews = useMemo(() => q.data?.reviews ?? [], [q.data]);
  const groups = useMemo(() => q.data?.groups ?? [], [q.data]);
  const requests = useMemo(() => q.data?.requests ?? [], [q.data]);
  const consents = useMemo(() => new Map((q.data?.consents ?? []).map((c) => [c.review_id, c.allowed] as const)), [q.data]);
  const current = target ?? groups[0]?.id ?? '';
  const nameFor = (groupId: string | null) => groups.find((g) => g.id === groupId)?.name ?? 'Group';
  const existing = reviews.find((r) => r.group_id === current);
  const sharing = existing ? consents.get(existing.id) === true : false;

  const mine = existing ? requests.filter((r) => r.review_id === existing.id) : [];
  const open = mine.find((r) => r.status === 'pending' || r.status === 'approved');
  const lastDenied = !open && mine[0]?.status === 'denied' ? mine[0] : undefined;
  const approved = open?.status === 'approved';

  // When an admin approves an edit, load the current review into the form.
  useEffect(() => {
    if (approved && existing) {
      setRating(existing.rating);
      setComment(existing.comment);
    } else if (!existing) {
      setRating(0);
      setComment('');
    }
    setAsking(false);
    setReason('');
  }, [approved, existing?.id, current]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || existing) return;
    if (!rating) return toast('Pick a star rating first', 'error');
    if (!confirm('Submit your review? You can only review this group once. To change it later you will need an admin to approve an edit request.')) return;
    setBusy(true);
    const { data, error } = await supabase
      .from('reviews')
      .insert({ rating, comment: comment.trim(), student_id: profile!.id, group_id: current })
      .select('id')
      .single();
    if (error) {
      setBusy(false);
      return toast(error.code === '23505' ? 'You have already reviewed this group.' : error.message, 'error');
    }
    if (share && data) {
      const { error: consentError } = await supabase.rpc('set_review_website_consent', { p_review: data.id, p_allow: true });
      if (consentError) toast('Your review was saved, but we could not record your website choice. You can set it from your review.', 'error');
    }
    setBusy(false);
    toast('Thanks for your review!');
    setRating(0);
    setComment('');
    setShare(false);
    q.refetch();
  };

  const setConsent = async (reviewId: string, allow: boolean) => {
    setBusy(true);
    const { error } = await supabase.rpc('set_review_website_consent', { p_review: reviewId, p_allow: allow });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast(allow ? 'Thank you. An admin may now show your review on the website.' : 'Done. Your review will not be shown on the website.');
    q.refetch();
  };

  const requestEdit = async () => {
    if (!existing) return;
    if (reason.trim().length < 5) return toast('Please tell the admin why you want to edit (at least a few words)', 'error');
    setBusy(true);
    const { error } = await supabase.from('review_edit_requests').insert({ review_id: existing.id, student_id: profile!.id, reason: reason.trim() });
    setBusy(false);
    if (error) return toast(error.code === '23505' ? 'You already have an open request for this review.' : error.message, 'error');
    toast('Edit request sent — an admin will review it');
    setAsking(false);
    setReason('');
    q.refetch();
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existing || !approved) return;
    if (!rating) return toast('Pick a star rating first', 'error');
    if (!confirm('Save your edit? Your review will lock again afterwards.')) return;
    setBusy(true);
    const { data, error } = await supabase.from('reviews').update({ rating, comment: comment.trim() }).eq('id', existing.id).select('id');
    setBusy(false);
    if (error) return toast(error.message, 'error');
    if (!data?.length) return toast('That edit is no longer approved. Please send a new request.', 'error');
    toast('Review updated — thank you!');
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

              {existing && approved ? (
                <form onSubmit={saveEdit} className="space-y-4">
                  <div className="rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm text-blue-900">
                    An admin approved one edit of your review. Make your change and save — it will lock again afterwards.
                  </div>
                  <Field label="Your rating" required>
                    <div className="flex items-center gap-3">
                      <StarRating value={rating} onChange={setRating} size={28} />
                      <span className="text-sm text-neutral-500">{LABELS[rating]}</span>
                    </div>
                  </Field>
                  <Field label="Your feedback">
                    <TextArea rows={5} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
                  </Field>
                  <div className="flex justify-end">
                    <Button type="submit" loading={busy}>
                      <Send size={14} /> Save my edit
                    </Button>
                  </div>
                </form>
              ) : existing ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-green-200 bg-green-50/70 p-5">
                    <div className="flex items-center gap-2 font-medium text-green-800">
                      <CheckCircle2 size={18} /> You've reviewed {nameFor(existing.group_id)} — thank you!
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <StarRating value={existing.rating} size={24} />
                      <span className="text-sm text-neutral-600">{LABELS[existing.rating]}</span>
                    </div>
                    {existing.comment && <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-700">{existing.comment}</p>}
                    <p className="mt-3 text-xs text-neutral-500">Submitted {new Date(existing.updated_at).toLocaleDateString()}. Your review is locked.</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/50 p-4">
                    <div className="flex items-start gap-2 text-sm text-neutral-700">
                      <Globe size={16} className="mt-0.5 shrink-0 text-neutral-400" />
                      <span>
                        {sharing
                          ? 'You allowed this review to appear on the EGIRE Robotics website with your first name and last initial. An admin chooses which reviews are shown.'
                          : 'Your review is private. You can allow it to appear on the EGIRE Robotics website with your first name and last initial. An admin chooses which reviews are shown.'}
                      </span>
                    </div>
                    <Button variant="secondary" onClick={() => setConsent(existing.id, !sharing)} loading={busy} disabled={isStaff}>
                      {sharing ? 'Withdraw' : 'Allow'}
                    </Button>
                  </div>

                  {open ? (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800">
                      <Clock size={16} className="mt-0.5 shrink-0" />
                      <span>Edit request sent on {new Date(open.created_at).toLocaleDateString()} — waiting for an admin to decide. You'll get a notification.</span>
                    </div>
                  ) : asking ? (
                    <div className="space-y-3 rounded-2xl border border-white/60 bg-white/50 p-4">
                      <Field label="Why do you want to edit your review?" required hint="Your admin sees this reason when deciding.">
                        <TextArea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. I made a typo, or my feedback changed after the last session" />
                      </Field>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => setAsking(false)}>
                          Cancel
                        </Button>
                        <Button type="button" onClick={requestEdit} loading={busy} disabled={isStaff}>
                          <Send size={14} /> Send request
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <Button variant="secondary" onClick={() => setAsking(true)} disabled={isStaff}>
                        <Pencil size={14} /> Request an edit
                      </Button>
                      {lastDenied && <span className="text-xs text-neutral-500">Your last request was declined on {new Date(lastDenied.created_at).toLocaleDateString()}.</span>}
                    </div>
                  )}
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
                  <Checkbox
                    label="You may show my review on the EGIRE Robotics website with my first name and last initial. I can change this later."
                    checked={share}
                    onChange={(e) => setShare(e.target.checked)}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-neutral-400">One review per group. Changes later need an admin's approval.</span>
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
