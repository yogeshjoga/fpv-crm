import { useMemo, useState } from 'react';
import { CalendarDays, Check, Download, Eye, EyeOff, FileText, Globe, MessageSquareHeart, MessageSquareText, Pencil, ThumbsUp, Trash2, Users, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { downloadCsv } from '../../lib/csv';
import { downloadReviewsPdf } from '../../lib/reviewsPdf';
import { slugify } from '../../lib/slug';
import { GlassCard } from '../../components/ui/shared';
import { StarRating } from '../../components/StarRating';
import { Badge, Button, Checkbox, EmptyState, Field, Modal, PageHeader, Select, Spinner, TextInput, useToast } from '../../components/ui/kit';

interface ReviewRow {
  id: string;
  rating: number;
  comment: string;
  group_id: string | null;
  created_at: string;
  updated_at: string;
  student: { full_name: string; email: string } | null;
  group: { name: string } | null;
}
interface FeaturedRow {
  review_id: string;
  display_name: string;
  subtitle: string;
  hidden: boolean;
}
interface EditRequestRow {
  id: string;
  reason: string;
  status: 'pending' | 'approved';
  created_at: string;
  student: { full_name: string; email: string } | null;
  review: { rating: number; comment: string; group: { name: string } | null } | null;
}

export function AdminReviews() {
  const toast = useToast();
  const { canWrite } = useAdminAccess();
  const writable = canWrite('reviews');
  // Exports carry names, emails and feedback, so they are limited to admins.
  const { profile } = useAuth();
  const canExport = profile?.role === 'admin' || profile?.role === 'super_admin';
  // Reviewer names stay hidden until an admin unlocks them with the eye button, so the page is safe
  // to show to students or on a shared screen. It re-hides every time the page is opened.
  const [showNames, setShowNames] = useState(false);
  const [group, setGroup] = useState('all');
  const [stars, setStars] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [withNames, setWithNames] = useState(true);
  const [format, setFormat] = useState<'pdf' | 'csv'>('pdf');
  const [withStats, setWithStats] = useState(true);
  // 'signed' prints the signature and company seal; 'blank' leaves room for an original signature and stamp.
  const [signMode, setSignMode] = useState<'signed' | 'blank'>('signed');
  const [pdfBusy, setPdfBusy] = useState(false);
  const DEFAULT_DESIGNATION = 'Founder, EgireRobotics · DGCA certified pilot';
  const [designation, setDesignation] = useState(() => {
    try {
      return localStorage.getItem('reviews.designation') || DEFAULT_DESIGNATION;
    } catch {
      return DEFAULT_DESIGNATION;
    }
  });

  const q = useQuery(
    () =>
      unwrap(
        supabase
          .from('reviews')
          .select(
            'id, rating, comment, group_id, created_at, updated_at, student:profiles!reviews_student_id_fkey(full_name, email), group:course_groups(name)',
          )
          .order('updated_at', { ascending: false }),
      ) as unknown as Promise<ReviewRow[]>,
    [],
  );

  // Students can't edit a review on their own: they ask, and an admin decides here.
  const rq = useQuery(
    () =>
      unwrap(
        supabase
          .from('review_edit_requests')
          .select('id, reason, status, created_at, student:profiles!review_edit_requests_student_id_fkey(full_name, email), review:reviews(rating, comment, group:course_groups(name))')
          .in('status', ['pending', 'approved'])
          .order('created_at', { ascending: true }),
      ) as unknown as Promise<EditRequestRow[]>,
    [],
  );
  // Group sizes, so the dashboard can show how many students have actually reviewed.
  const mq = useQuery(() => unwrap(supabase.from('course_group_members').select('group_id')) as Promise<{ group_id: string }[]>, []);
  // Reviews an admin has chosen to show on the public website.
  const fq = useQuery(
    () => unwrap(supabase.from('site_featured_reviews').select('review_id, display_name, subtitle, hidden')) as Promise<FeaturedRow[]>,
    [],
  );
  const featuredBy = useMemo(() => new Map((fq.data ?? []).map((f) => [f.review_id, f] as const)), [fq.data]);
  const [featuring, setFeaturing] = useState<ReviewRow | null>(null);
  // What each student chose about website display: true (agreed), false (declined) or nothing yet.
  const cq = useQuery(
    () => unwrap(supabase.from('review_website_consent').select('review_id, allowed')) as Promise<{ review_id: string; allowed: boolean }[]>,
    [],
  );
  const consentBy = useMemo(() => new Map((cq.data ?? []).map((c) => [c.review_id, c.allowed] as const)), [cq.data]);
  const [site, setSite] = useState<'all' | 'agreed' | 'live'>('all');
  // On the website: the student agreed (shown automatically) or staff featured it, unless staff hid it or the student declined.
  const isLive = (r: ReviewRow) => {
    const row = featuredBy.get(r.id);
    const consent = consentBy.get(r.id);
    return !!r.comment.trim() && !row?.hidden && consent !== false && (consent === true || !!row);
  };
  const requests = rq.data ?? [];
  const pending = requests.filter((r) => r.status === 'pending');
  const approved = requests.filter((r) => r.status === 'approved');

  const decide = async (r: EditRequestRow, status: 'approved' | 'denied') => {
    if (status === 'denied' && r.status === 'pending' && !confirm('Decline this edit request? The review stays as it is.')) return;
    const { error } = await supabase.from('review_edit_requests').update({ status }).eq('id', r.id);
    if (error) return toast(error.message, 'error');
    toast(status === 'approved' ? 'Approved — the student can now edit once' : r.status === 'approved' ? 'Approval withdrawn' : 'Request declined');
    rq.refetch();
  };

  const all = useMemo(() => q.data ?? [], [q.data]);
  // A steady "Anonymous #n" per review (oldest first), so a review can still be pointed at without a name.
  const anonNo = useMemo(
    () => new Map([...all].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((r, i) => [r.id, i + 1] as const)),
    [all],
  );
  const groupOptions = useMemo(() => {
    const groups = new Map<string, string>();
    for (const r of all) if (r.group_id && r.group) groups.set(r.group_id, r.group.name);
    return [...groups.entries()];
  }, [all]);

  const rows = useMemo(
    () =>
      all.filter(
        (r) =>
          (group === 'all' || r.group_id === group) &&
          (stars === 'all' || r.rating === Number(stars)) &&
          (site === 'all' || (site === 'agreed' ? consentBy.get(r.id) === true : isLive(r))),
      ),
    [all, group, stars, site, consentBy, featuredBy],
  );

  // The dashboard follows the group filter only; the star filter just narrows the list below.
  const scoped = useMemo(() => all.filter((r) => group === 'all' || r.group_id === group), [all, group]);
  const avg = scoped.length ? scoped.reduce((sum, r) => sum + r.rating, 0) / scoped.length : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: scoped.filter((r) => r.rating === n).length }));
  const stats = useMemo(() => {
    const members = (mq.data ?? []).filter((m) => group === 'all' || m.group_id === group).length;
    const pct = (n: number) => (scoped.length ? Math.round((n / scoped.length) * 100) : 0);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      return { key: d.toDateString(), label: d.toLocaleDateString('en-GB', { weekday: 'short' }), count: 0 };
    });
    for (const r of scoped) {
      const hit = days.find((d) => d.key === new Date(r.created_at).toDateString());
      if (hit) hit.count++;
    }
    return {
      members,
      responseRate: members ? Math.min(100, Math.round((scoped.length / members) * 100)) : null,
      satisfied: pct(scoped.filter((r) => r.rating >= 4).length),
      commented: pct(scoped.filter((r) => r.comment.trim()).length),
      edited: scoped.filter((r) => new Date(r.updated_at).getTime() - new Date(r.created_at).getTime() > 60_000).length,
      days,
      week: days.reduce((sum, d) => sum + d.count, 0),
    };
  }, [scoped, mq.data, group]);

  // Exports exactly what is on screen: the current group and star filters are applied.
  // Without names the file has no name or email column and only dates (no times), so feedback
  // can be shared or analysed anonymously.
  const exportCsv = () => {
    const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB');
    const stamp = (iso: string) => new Date(iso).toLocaleString('en-GB');
    const edited = (r: ReviewRow) => (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime() > 60_000 ? 'Yes' : 'No');
    const headers = withNames
      ? ['Student', 'Email', 'Course group', 'Rating (1-5)', 'Comment', 'Submitted', 'Last updated', 'Edited']
      : ['#', 'Course group', 'Rating (1-5)', 'Comment', 'Submitted', 'Last updated', 'Edited'];
    const body = rows.map((r, i) =>
      withNames
        ? [r.student?.full_name ?? '', r.student?.email ?? '', r.group?.name ?? '', r.rating, r.comment, stamp(r.created_at), stamp(r.updated_at), edited(r)]
        : [i + 1, r.group?.name ?? '', r.rating, r.comment, day(r.created_at), day(r.updated_at), edited(r)],
    );
    const scope = group === 'all' ? 'all-groups' : slugify(groupOptions.find(([id]) => id === group)?.[1] ?? 'group');
    downloadCsv(`reviews-${scope}${withNames ? '' : '-anonymous'}-${new Date().toISOString().slice(0, 10)}.csv`, headers, body);
    toast(`Exported ${rows.length} review${rows.length === 1 ? '' : 's'}${withNames ? '' : ' anonymously'}`);
    setExporting(false);
  };

  // A branded PDF for sharing with a college: the dashboard statistics, the reviews, and the founder's signature and seal.
  const exportPdf = async () => {
    setPdfBusy(true);
    try {
      try {
        localStorage.setItem('reviews.designation', designation);
      } catch {
        /* remembering the line is a convenience only */
      }
      const { data: org } = await supabase
        .from('org_settings')
        .select('org_name, logo_url, signatory_name, signatory_image_url, company_seal_url')
        .single();
      const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const groupName = group === 'all' ? 'All course groups' : groupOptions.find(([id]) => id === group)?.[1] ?? 'Course group';
      await downloadReviewsPdf({
        orgName: org?.org_name || 'EgireRobotics',
        logoUrl: org?.logo_url ?? null,
        groupLabel: groupName,
        filterNote: stars === 'all' ? null : `${stars}-star reviews only`,
        withNames,
        includeStats: withStats,
        stats: {
          avg,
          count: scoped.length,
          dist,
          satisfied: stats.satisfied,
          commented: stats.commented,
          week: stats.week,
          pendingEdits: pending.length,
          edited: stats.edited,
          members: stats.members,
          responseRate: stats.responseRate,
          days: stats.days.map((d) => ({ label: d.label, count: d.count })),
        },
        reviews: rows.map((r) => ({
          name: withNames ? r.student?.full_name || r.student?.email || 'Student' : `Anonymous #${anonNo.get(r.id) ?? ''}`,
          group: r.group?.name ?? 'Group',
          rating: r.rating,
          date: day(r.updated_at),
          comment: r.comment,
        })),
        sign: {
          mode: signMode,
          name: org?.signatory_name || 'Yogesh Joga',
          designation: designation.trim() || DEFAULT_DESIGNATION,
          signatureUrl: org?.signatory_image_url ?? null,
          sealUrl: org?.company_seal_url ?? null,
        },
      });
      toast(`PDF ready: ${rows.length} review${rows.length === 1 ? '' : 's'}${withNames ? '' : ', anonymous'}${signMode === 'blank' ? ', unsigned' : ''}`);
      setExporting(false);
    } catch (e) {
      toast((e as Error).message || 'Could not create the PDF', 'error');
    } finally {
      setPdfBusy(false);
    }
  };

  const remove = async (r: ReviewRow) => {
    if (!confirm('Remove this review? The student will no longer see it.')) return;
    const { error } = await supabase.from('reviews').delete().eq('id', r.id);
    if (error) return toast(error.message, 'error');
    toast('Review removed');
    q.refetch();
  };

  if (q.loading && !q.data) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Reviews"
        subtitle="What each course group says about the program"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-56">
              <Select value={group} onChange={(e) => setGroup(e.target.value)}>
                <option value="all">All course groups</option>
                {groupOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-36">
              <Select value={stars} onChange={(e) => setStars(e.target.value)}>
                <option value="all">All stars</option>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} star{n > 1 ? 's' : ''}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-44">
              <Select value={site} onChange={(e) => setSite(e.target.value as 'all' | 'agreed' | 'live')}>
                <option value="all">All reviews</option>
                <option value="agreed">Agreed to publish</option>
                <option value="live">On website</option>
              </Select>
            </div>
            {canExport && (
              <Button
                variant="secondary"
                onClick={() => {
                  setWithNames(showNames); // names are only pre-ticked when they're unlocked on screen
                  setExporting(true);
                }}
                disabled={!rows.length}
              >
                <Download size={15} /> Export
              </Button>
            )}
            {canExport && (
              <button
                type="button"
                onClick={() => setShowNames((v) => !v)}
                aria-pressed={showNames}
                aria-label={showNames ? 'Hide reviewer names' : 'Show reviewer names'}
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                  showNames ? 'bg-[#1a1a1a] text-white' : 'bg-white/70 text-neutral-500 hover:bg-white hover:text-neutral-800'
                }`}
              >
                {showNames ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            )}
          </div>
        }
      />

      {(pending.length > 0 || approved.length > 0) && (
        <GlassCard className="mb-6 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-neutral-900">
            <Pencil size={16} /> Edit requests
            {pending.length > 0 && <Badge tone="amber">{pending.length} waiting</Badge>}
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">Reviews are locked. Approving lets that student change their review once; it then locks again.</p>
          <div className="mt-4 space-y-3">
            {[...pending, ...approved].map((r) => (
              <div key={r.id} className="rounded-2xl border border-white/60 bg-white/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-neutral-900">{showNames ? r.student?.full_name || r.student?.email || 'Student' : 'Anonymous student'}</span>
                      <Badge tone="amber">{r.review?.group?.name ?? 'Group'}</Badge>
                      {r.status === 'approved' && <Badge tone="green">Approved — waiting for the student</Badge>}
                    </div>
                    <p className="mt-2 text-sm text-neutral-700">
                      <span className="text-neutral-400">Reason: </span>
                      {r.reason}
                    </p>
                    {r.review && (
                      <div className="mt-2 text-xs text-neutral-500">
                        <span className="mr-2 inline-block align-middle">
                          <StarRating value={r.review.rating} size={12} />
                        </span>
                        <span className="line-clamp-2">{r.review.comment || 'No comment'}</span>
                      </div>
                    )}
                    <div className="mt-1 text-[11px] text-neutral-400">Asked {new Date(r.created_at).toLocaleString()}</div>
                  </div>
                  {writable && (
                    <div className="flex gap-2">
                      {r.status === 'pending' && (
                        <Button onClick={() => decide(r, 'approved')}>
                          <Check size={14} /> Approve
                        </Button>
                      )}
                      <Button variant="secondary" onClick={() => decide(r, 'denied')}>
                        <X size={14} /> {r.status === 'approved' ? 'Withdraw' : 'Decline'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {!all.length ? (
        <EmptyState icon={<MessageSquareHeart size={22} />} title="No reviews yet" description="Students can leave a rating and feedback from Reviews in their sidebar." />
      ) : (
        <>
          <GlassCard className="mb-6 p-5">
            <div className="grid gap-6 lg:grid-cols-[170px_minmax(0,1fr)_minmax(0,1.3fr)] lg:items-center">
              <div className="text-center lg:border-r lg:border-white/60 lg:pr-6">
                <div className="text-5xl font-semibold text-neutral-900">{scoped.length ? avg.toFixed(1) : '–'}</div>
                <div className="mt-1 flex justify-center">
                  <StarRating value={Math.round(avg)} size={18} />
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  {scoped.length} review{scoped.length === 1 ? '' : 's'}
                </div>
              </div>

              <div className="space-y-1.5">
                {dist.map((d) => (
                  <button
                    key={d.n}
                    type="button"
                    aria-pressed={stars === String(d.n)}
                    title={stars === String(d.n) ? 'Show all stars' : `Show only ${d.n}-star reviews`}
                    onClick={() => setStars(stars === String(d.n) ? 'all' : String(d.n))}
                    className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-0.5 text-xs text-neutral-600 transition-colors hover:bg-white/60 ${stars === String(d.n) ? 'bg-white/80 ring-1 ring-amber-300' : ''}`}
                  >
                    <span className="w-3 text-right">{d.n}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/70">
                      <span className="block h-full rounded-full bg-amber-400" style={{ width: scoped.length ? `${(d.count / scoped.length) * 100}%` : 0 }} />
                    </span>
                    <span className="w-6 text-right text-neutral-400">{d.count}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatTile icon={<ThumbsUp size={15} />} label="Satisfied (4–5★)" value={scoped.length ? `${stats.satisfied}%` : '–'} />
                <StatTile icon={<MessageSquareText size={15} />} label="Wrote a comment" value={scoped.length ? `${stats.commented}%` : '–'} />
                <StatTile icon={<CalendarDays size={15} />} label="Last 7 days" value={String(stats.week)} sub={stats.week === 1 ? 'new review' : 'new reviews'} />
                <StatTile
                  icon={<Pencil size={15} />}
                  label="Edit requests"
                  value={String(pending.length)}
                  sub={stats.edited ? `${stats.edited} edited so far` : 'waiting for you'}
                  highlight={pending.length > 0}
                />
              </div>
            </div>

            <div className="mt-5 grid gap-5 border-t border-white/60 pt-5 md:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                  <Users size={14} /> Response rate
                </div>
                {stats.members ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold text-neutral-900">{stats.responseRate}%</span>
                      <span className="text-xs text-neutral-500">
                        {scoped.length} of {stats.members} students have reviewed
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/70">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${stats.responseRate}%` }} />
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-neutral-400">No students in this group yet.</p>
                )}
              </div>
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                  <CalendarDays size={14} /> Reviews per day · last 7 days
                </div>
                <div className="flex h-14 items-end gap-2">
                  {stats.days.map((d) => {
                    const max = Math.max(1, ...stats.days.map((x) => x.count));
                    return (
                      <div key={d.key} className="flex flex-1 flex-col items-center gap-1" title={`${d.label}: ${d.count}`}>
                        <div className="flex h-9 w-full items-end">
                          <div
                            className={`w-full rounded-t-md ${d.count ? 'bg-amber-400' : 'bg-white/70'}`}
                            style={{ height: d.count ? `${Math.max(14, (d.count / max) * 100)}%` : '8%' }}
                          />
                        </div>
                        <span className="text-[10px] text-neutral-400">{d.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </GlassCard>

          {!rows.length ? (
            <EmptyState icon={<MessageSquareHeart size={22} />} title="No matching reviews" description="Try a different group or star filter." />
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <GlassCard key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-neutral-900">{showNames ? r.student?.full_name || r.student?.email || 'Student' : `Anonymous #${anonNo.get(r.id) ?? ''}`}</span>
                        <Badge tone="amber">{r.group?.name ?? 'Group'}</Badge>
                        {new Date(r.updated_at).getTime() - new Date(r.created_at).getTime() > 60_000 && <Badge tone="blue">Edited</Badge>}
                        {isLive(r) && <Badge tone="green">On website</Badge>}
                        {featuredBy.get(r.id)?.hidden && <Badge tone="amber">Hidden from website</Badge>}
                        {consentBy.get(r.id) === true && !isLive(r) && !featuredBy.get(r.id)?.hidden && <Badge tone="blue">Agreed to publish</Badge>}
                        {consentBy.get(r.id) === false && <Badge tone="red">Declined website</Badge>}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <StarRating value={r.rating} size={15} />
                        <span className="text-xs text-neutral-400">{new Date(r.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {writable && canExport && (
                        <Button
                          variant="secondary"
                          onClick={() => setFeaturing(r)}
                          disabled={!showNames || !r.comment.trim() || consentBy.get(r.id) === false}
                          title={consentBy.get(r.id) === false ? 'This student chose not to be shown on the website' : !r.comment.trim() ? 'Only reviews with a comment can be shown' : !showNames ? 'Unlock names first (eye button)' : 'Choose how this review appears on the website'}
                        >
                          <Globe size={14} /> {isLive(r) ? 'On website' : featuredBy.get(r.id)?.hidden ? 'Hidden' : 'Show on website'}
                        </Button>
                      )}
                      {writable && (
                        <Button variant="ghost" onClick={() => remove(r)} title="Remove review">
                          <Trash2 size={15} />
                        </Button>
                      )}
                    </div>
                  </div>
                  {r.comment && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{r.comment}</p>}
                </GlassCard>
              ))}
            </div>
          )}
        </>
      )}

      {featuring && (
        <FeatureModal
          review={featuring}
          existing={featuredBy.get(featuring.id) ?? null}
          studentAgreed={consentBy.get(featuring.id) === true}
          live={isLive(featuring)}
          onClose={() => setFeaturing(null)}
          onSaved={() => {
            setFeaturing(null);
            fq.refetch();
          }}
        />
      )}

      {canExport && exporting && (
        <Modal open onClose={() => setExporting(false)} title="Export reviews" wide>
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              {rows.length} review{rows.length === 1 ? '' : 's'} will be exported, matching the group and star filters currently selected.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['pdf', 'PDF report', 'Coloured like this dashboard, with the statistics. Made for sharing.'],
                  ['csv', 'CSV spreadsheet', 'Plain data for Excel or Sheets. Keeps every language.'],
                ] as const
              ).map(([key, title, hint]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFormat(key)}
                  className={`rounded-2xl border p-3 text-left transition-colors ${format === key ? 'border-neutral-900 bg-white' : 'border-white/60 bg-white/40 hover:bg-white/70'}`}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-900">
                    {key === 'pdf' ? <FileText size={14} /> : <Download size={14} />} {title}
                  </span>
                  <span className="mt-0.5 block text-xs text-neutral-500">{hint}</span>
                </button>
              ))}
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/60 bg-white/50 p-3">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={withNames} onChange={(e) => setWithNames(e.target.checked)} />
              <span>
                <span className="block text-sm font-medium text-neutral-900">Include student names{format === 'csv' ? ' and email addresses' : ''}</span>
                <span className="block text-xs text-neutral-500">
                  Untick to export anonymously: reviews are listed as Anonymous #1, #2 and so on{format === 'csv' ? ', with no name or email column and only dates' : ''}. Comments are
                  exported as written, so a student may still name themselves in their text.
                </span>
              </span>
            </label>

            {format === 'pdf' && (
              <>
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/60 bg-white/50 p-3">
                  <input type="checkbox" className="mt-1 h-4 w-4" checked={withStats} onChange={(e) => setWithStats(e.target.checked)} />
                  <span>
                    <span className="block text-sm font-medium text-neutral-900">Include the dashboard statistics</span>
                    <span className="block text-xs text-neutral-500">Average rating, star breakdown, satisfaction, response rate and the last 7 days.</span>
                  </span>
                </label>

                <div className="rounded-2xl border border-white/60 bg-white/50 p-3">
                  <div className="text-sm font-medium text-neutral-900">Signature and company seal</div>
                  <div className="mt-2 space-y-2 text-sm text-neutral-700">
                    <label className="flex cursor-pointer items-start gap-2">
                      <input type="radio" className="mt-1" checked={signMode === 'signed'} onChange={() => setSignMode('signed')} />
                      <span>
                        <span className="font-medium">With signature and seal</span>
                        <span className="block text-xs text-neutral-500">Your signature and the company seal are printed at the end, above your name.</span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2">
                      <input type="radio" className="mt-1" checked={signMode === 'blank'} onChange={() => setSignMode('blank')} />
                      <span>
                        <span className="font-medium">Blank, for the original signature and seal</span>
                        <span className="block text-xs text-neutral-500">Leaves a clear line with your name below it, so you can print it and sign and stamp by hand.</span>
                      </span>
                    </label>
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 text-xs text-neutral-500">Printed under the signature line</div>
                    <div className="rounded-xl bg-white/70 px-3 py-1.5 text-xs text-neutral-500">Yogesh Joga</div>
                    <input
                      className="mt-1.5 w-full rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm text-neutral-800 outline-none focus:border-neutral-400"
                      value={designation}
                      maxLength={120}
                      onChange={(e) => setDesignation(e.target.value)}
                    />
                  </div>
                </div>

                <p className="text-xs text-neutral-400">The PDF font covers English only. Comments written in other scripts print as “?”. Use the CSV for those.</p>
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setExporting(false)}>
                Cancel
              </Button>
              {format === 'pdf' ? (
                <Button onClick={exportPdf} loading={pdfBusy}>
                  <FileText size={15} /> Download PDF{withNames ? '' : ' (anonymous)'}
                </Button>
              ) : (
                <Button onClick={exportCsv}>
                  <Download size={15} /> Download {withNames ? 'CSV' : 'anonymous CSV'}
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** The full name, tidied the same way the website tidies it: "MENTI HEMASAGAR" and "menti hemasagar" become "Menti Hemasagar". */
function suggestName(full: string) {
  return full
    .replace(/([A-Za-z]{2,})\.([A-Za-z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w === w.toUpperCase() || w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

function FeatureModal({ review, existing, studentAgreed, live, onClose, onSaved }: { review: ReviewRow; existing: FeaturedRow | null; studentAgreed: boolean; live: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(existing?.display_name ?? suggestName(review.student?.full_name ?? ''));
  const [subtitle, setSubtitle] = useState(existing?.subtitle ?? review.group?.name ?? '');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast('Add the name to show on the website', 'error');
    if (!existing && !studentAgreed && !agreed) return toast('Confirm the student agreed before publishing', 'error');
    setBusy(true);
    const { error } = await supabase
      .from('site_featured_reviews')
      .upsert({
        review_id: review.id,
        display_name: name.trim(),
        subtitle: subtitle.trim(),
        ...(existing ? {} : { consent: studentAgreed ? 'student-opt-in' : 'staff-confirmed' }),
      });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast(existing ? 'Website review updated' : 'Review is now on the website');
    onSaved();
  };

  // Keeps a review off the website without touching the student's choice or the review itself.
  const setHidden = async (hidden: boolean) => {
    if (hidden && !confirm('Hide this review from the website? It stays in the CRM.')) return;
    setBusy(true);
    const { error } = await supabase.from('site_featured_reviews').upsert({
      review_id: review.id,
      display_name: name.trim() || suggestName(review.student?.full_name ?? '') || 'Student',
      subtitle: subtitle.trim(),
      hidden,
      ...(existing ? {} : { consent: studentAgreed ? 'student-opt-in' : 'staff-confirmed' }),
    });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast(hidden ? 'Hidden from the website' : 'Back on the website');
    onSaved();
  };

  const unfeature = async () => {
    if (!confirm('Remove this review from the website? It stays in the CRM.')) return;
    setBusy(true);
    const { error } = await supabase.from('site_featured_reviews').delete().eq('review_id', review.id);
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Removed from the website');
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={existing || live ? 'Review on the website' : 'Show this review on the website'}>
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/60 bg-white/50 p-4">
          <StarRating value={review.rating} size={15} />
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{review.comment}</p>
        </div>
        <Field label="Name shown on the website" hint="The full name by default, because named reviews are more believable. Shorten it if the student asks." required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <div className="-mt-2 flex flex-wrap gap-3 text-xs">
          <button type="button" className="font-medium text-blue-600 hover:underline" onClick={() => setName(suggestName(review.student?.full_name ?? ''))}>
            Use the full name
          </button>
          <button type="button" className="font-medium text-blue-600 hover:underline" onClick={() => setSubtitle(review.group?.name ?? '')}>
            Use the course group as the tag
          </button>
        </div>
        <Field label="Tag under the name (course or college)" hint="The course group by default, for example: Sivani FPV course. You can add the college or year too.">
          <TextInput value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={120} />
        </Field>
        {!existing && studentAgreed && (
          <p className="rounded-xl border border-green-200 bg-green-50/80 px-4 py-3 text-sm text-green-800">
            The student agreed to this review being shown on the website, so it appears there automatically. Change the name below only if needed.
          </p>
        )}
        {!existing && !studentAgreed && (
          <Checkbox
            label="The student agreed to this review being shown publicly with this name."
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
        )}
        <p className="text-xs text-neutral-500">The website shows only the rating, the comment, this name and the description. Nothing else about the student is shared.</p>
        <div className="flex justify-between gap-2">
          <div>
            {existing?.hidden ? (
              <Button variant="secondary" onClick={() => setHidden(false)} disabled={busy}>
                Show again
              </Button>
            ) : studentAgreed && (live || existing) ? (
              <Button variant="secondary" onClick={() => setHidden(true)} disabled={busy}>
                Hide from website
              </Button>
            ) : (
              existing && (
                <Button variant="secondary" onClick={unfeature} disabled={busy}>
                  Remove from website
                </Button>
              )
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy}>
              {existing ? 'Save' : 'Show on website'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function StatTile({ icon, label, value, sub, highlight }: { icon: React.ReactNode; label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${highlight ? 'border-amber-200 bg-amber-50/70' : 'border-white/60 bg-white/50'}`}>
      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
        {icon} {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-neutral-900">{value}</div>
      {sub && <div className="text-[11px] text-neutral-400">{sub}</div>}
    </div>
  );
}
