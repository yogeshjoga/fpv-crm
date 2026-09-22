import { useEffect, useRef, useState } from 'react';

/** CR80-style page size used by the generate-certificate edge function — kept in sync
 * with `PAGE_W`/`PAGE_H` there. Every position below is the exact px/pt value that
 * function draws at, so this stays a faithful preview of the real PDF without needing
 * to render or download one — it's live data (student/course/org fields) laid over the
 * org's certificate background image, not a stored image render. */
const PAGE_W = 842;
const PAGE_H = 595;

export interface CertificatePreviewData {
  certId: string;
  studentName: string;
  courseTitle: string;
  certType: string;
  scorePct: number | null;
  issuedAt: string;
  orgName: string;
  verifyBaseUrl: string;
  backgroundUrl: string | null;
}

/** Renders a certificate purely from data — the org's background image (one small,
 * cacheable file) plus text laid on top, matching generate-certificate's PDF layout.
 * Scales to fit its container via a CSS transform so the same fixed-position numbers
 * work at any display size. */
export function CertificatePreview({ data }: { data: CertificatePreviewData }) {
  const { certId, studentName, courseTitle, certType, scorePct, issuedAt, orgName, verifyBaseUrl, backgroundUrl } = data;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setScale(w / PAGE_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const issuedLabel = new Date(issuedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const domain = verifyBaseUrl.replace(/^https?:\/\//, '') || 'egirerobotics.com';
  const blurb =
    `has successfully completed the ${courseTitle} program conducted by ${orgName}` +
    (scorePct != null ? ` and achieved a score of ${Number(scorePct)}% in the certification exam.` : '.');

  const navy = '#0f2a4a';
  const gold = '#c9a227';

  return (
    <div ref={wrapperRef} className="w-full overflow-hidden rounded-xl border border-white/60 shadow-sm" style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}` }}>
      <div
        className="relative bg-white"
        style={{
          width: PAGE_W,
          height: PAGE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined,
          backgroundSize: 'cover',
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        {backgroundUrl ? (
          <>
            {/* mask the template's own plain "OF ..." line so our value can replace it */}
            <div className="absolute" style={{ left: 0.2 * PAGE_W, bottom: 0.675 * PAGE_H, width: 0.6 * PAGE_W, height: 0.052 * PAGE_H, background: '#fdfcf9' }} />
            <div className="absolute inset-x-0 text-center font-bold" style={{ bottom: 0.685 * PAGE_H, fontSize: 20, color: gold }}>
              OF {certType.toUpperCase()}
            </div>

            <div className="absolute inset-x-0 text-center font-bold" style={{ bottom: 0.585 * PAGE_H, fontSize: 22, color: navy }}>
              {studentName}
            </div>

            <div
              className="absolute left-1/2 -translate-x-1/2 text-center leading-[18px]"
              style={{ bottom: 0.465 * PAGE_H - 14, width: 0.55 * PAGE_W, fontSize: 12, color: '#333' }}
            >
              {blurb}
            </div>

            <div className="absolute text-right" style={{ right: PAGE_W - 0.95 * PAGE_W, bottom: 0.955 * PAGE_H, fontSize: 8, color: navy }}>
              Scan or visit
            </div>
            <div className="absolute text-right font-bold" style={{ right: PAGE_W - 0.95 * PAGE_W, bottom: 0.935 * PAGE_H, fontSize: 8, color: gold }}>
              {domain}
            </div>
            <div
              className="absolute text-right leading-[11px]"
              style={{ right: PAGE_W - 0.95 * PAGE_W, bottom: 0.918 * PAGE_H - 22, width: 0.19 * PAGE_W, fontSize: 7.5, color: navy }}
            >
              to confirm this certificate's holder, course and issue date.
            </div>

            <div className="absolute" style={{ left: 0.06 * PAGE_W, bottom: 0.135 * PAGE_H, fontSize: 9 }}>
              <span className="font-bold" style={{ color: navy }}>
                Certificate ID{'  '}
              </span>
              <span style={{ color: '#4d4d4d' }}>{certId}</span>
            </div>
            <div className="absolute" style={{ left: 0.06 * PAGE_W, bottom: 0.11 * PAGE_H, fontSize: 9 }}>
              <span className="font-bold" style={{ color: navy }}>
                Date of issue{'  '}
              </span>
              <span style={{ color: '#4d4d4d' }}>{issuedLabel}</span>
            </div>
          </>
        ) : (
          // Plain fallback shown only until an org uploads a certificate background.
          <div className="flex h-full flex-col items-center justify-center gap-3 border-4 border-double border-blue-600/70 px-16 text-center">
            <div className="text-lg font-bold uppercase tracking-widest text-blue-700">{orgName}</div>
            <div className="text-3xl font-bold text-neutral-900">Certificate of Completion</div>
            <div className="text-sm text-neutral-500">This is to certify that</div>
            <div className="text-2xl font-bold text-neutral-900">{studentName}</div>
            <div className="text-sm text-neutral-500">has successfully completed the course</div>
            <div className="text-lg font-bold text-blue-700">{courseTitle}</div>
            <div className="text-sm text-neutral-500">
              {scorePct != null ? `Score ${Number(scorePct)}% — ` : ''}Issued {issuedLabel}
            </div>
            <div className="mt-6 text-xs text-neutral-400">Certificate ID: {certId}</div>
          </div>
        )}
      </div>
    </div>
  );
}
