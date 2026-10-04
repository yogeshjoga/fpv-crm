import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Button, EmptyState, PageHeader, Spinner, useToast } from '../../components/ui/kit';
import { ExamReviewList, type ReviewItem } from '../../components/ExamReviewList';
import { downloadReviewPdf } from '../../lib/reviewPdf';

interface SavedReview {
  available: boolean;
  attempt_no?: number;
  score_pct?: number;
  submitted_at?: string;
  total?: number;
  items: ReviewItem[];
}

/** A saved copy of the wrong answers from one submitted attempt, with a PDF download. */
export function ExamReview() {
  const { slug, attemptId } = useParams();
  const { profile } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const q = useQuery(async () => {
    const [review, course] = await Promise.all([
      supabase.rpc('my_exam_review', { p_attempt_id: attemptId as string }),
      supabase.from('courses').select('title').eq('slug', slug as string).maybeSingle(),
    ]);
    if (review.error) throw new Error(review.error.message);
    return { review: review.data as unknown as SavedReview, title: course.data?.title ?? 'Online exam' };
  }, [slug, attemptId]);

  if (q.loading) return <Spinner />;
  if (q.error) return <p className="text-sm text-red-600">{q.error}</p>;
  const { review, title } = q.data!;
  const back = (
    <Link to={`/app/courses/${slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
      <ArrowLeft size={14} /> Back to course
    </Link>
  );

  if (!review.available) {
    return (
      <div className="space-y-4">
        {back}
        <GlassCard className="flex flex-col items-center gap-3 p-10 text-center">
          <Lock size={26} className="text-neutral-400" />
          <div className="text-lg font-semibold text-neutral-900">No review available</div>
          <p className="max-w-sm text-sm text-neutral-500">
            This attempt isn't finished yet, doesn't belong to you, or the exam doesn't share wrong answers.
          </p>
        </GlassCard>
      </div>
    );
  }

  const wrong = review.items.length;
  const correct = (review.total ?? 0) - wrong;
  const download = async () => {
    setBusy(true);
    try {
      await downloadReviewPdf({
        studentName: profile?.full_name || profile?.email || 'Student',
        courseTitle: title,
        summary: `Attempt ${review.attempt_no} - Score ${Number(review.score_pct)}% - ${correct}/${review.total} correct - ${wrong} wrong`,
        items: review.items,
      });
    } catch (e) {
      toast((e as Error).message || 'Could not create the PDF', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {back}
      <PageHeader
        title="Your wrong answers"
        subtitle={`${title} · attempt ${review.attempt_no} · ${review.submitted_at ? new Date(review.submitted_at).toLocaleString() : ''}`}
        actions={
          wrong > 0 && (
            <Button variant="secondary" onClick={download} loading={busy}>
              <Download size={15} /> Download PDF
            </Button>
          )
        }
      />
      <p className="text-sm text-neutral-600">
        Score <span className="font-semibold text-neutral-900">{Number(review.score_pct)}%</span> — {correct}/{review.total} correct
        {wrong > 0 && (
          <>
            {' '}
            · <span className="font-semibold text-red-600">{wrong} wrong</span>
          </>
        )}
      </p>
      {wrong === 0 ? (
        <EmptyState title="Nothing to review" description="You answered every question correctly in this attempt." />
      ) : (
        <ExamReviewList items={review.items} />
      )}
    </div>
  );
}
