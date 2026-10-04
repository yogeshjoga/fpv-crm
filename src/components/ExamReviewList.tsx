import { CheckCircle2, XCircle } from 'lucide-react';
import { GlassCard } from './ui/shared';

export interface ReviewItem {
  question_id: string;
  prompt: string;
  type: string;
  your_answers: string[];
  correct_answers: string[];
  explanation: string;
}

/** The questions a student got wrong, each with their answer, the correct answer and the explanation. */
export function ExamReviewList({ items }: { items: ReviewItem[] }) {
  return (
    <div className="space-y-4">
      {items.map((r, i) => (
        <GlassCard key={r.question_id} className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Question {i + 1}</div>
          <p className="mt-1 font-medium text-neutral-900">{r.prompt}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                <XCircle size={14} /> Your answer
              </div>
              <div className="mt-1">{r.your_answers.length ? r.your_answers.join(', ') : 'Not answered'}</div>
            </div>
            <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                <CheckCircle2 size={14} /> Correct answer
              </div>
              <div className="mt-1 font-medium">{r.correct_answers.join(', ')}</div>
            </div>
          </div>
          {r.explanation && (
            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-sm leading-relaxed text-neutral-700">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-700">Why — explanation &amp; example</div>
              {r.explanation}
            </div>
          )}
        </GlassCard>
      ))}
    </div>
  );
}
