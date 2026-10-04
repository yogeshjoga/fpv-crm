import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { trimmedImageUrl } from '../lib/trimImage';

/** CR80-style page size used by the generate-certificate edge function — kept in sync
 * with `PAGE_W`/`PAGE_H` there. Every position below is the exact px/pt value that
 * function draws at, so this stays a faithful preview of the real PDF without needing
 * to render or download one — it's live data (student/course/org fields) laid over the
 * org's certificate background image, not a stored image render. */
const PAGE_W = 842;
const PAGE_H = 595;
/** Page points per pixel of the 2000x1414 template artwork. */
const ART_X = PAGE_W / 2000;
const ART_Y = PAGE_H / 1414;

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
  /** The signatory's signature and the company seal (Company Settings), shown as on the PDF. */
  signatureUrl?: string | null;
  sealUrl?: string | null;
  /** For certificates issued from module marks: "a total score of X out of Y". */
  totalMarks?: { total: number; max: number } | null;
}

/** Renders a certificate purely from data — the org's background image (one small,
 * cacheable file) plus text laid on top, matching generate-certificate's PDF layout.
 * Scales to fit its container via a CSS transform so the same fixed-position numbers
 * work at any display size. */
export function CertificatePreview({ data }: { data: CertificatePreviewData }) {
  const { certId, studentName, courseTitle, certType, scorePct, issuedAt, orgName, verifyBaseUrl, backgroundUrl, signatureUrl, sealUrl, totalMarks } = data;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [signatureSrc, setSignatureSrc] = useState<string | null>(null);
  const [sealSrc, setSealSrc] = useState<string | null>(null);

  // Crop each image to its visible ink first, exactly as the PDF does.
  useEffect(() => {
    let live = true;
    setSignatureSrc(null);
    setSealSrc(null);
    if (signatureUrl) trimmedImageUrl(signatureUrl).then((u) => live && setSignatureSrc(u));
    if (sealUrl) trimmedImageUrl(sealUrl).then((u) => live && setSealSrc(u));
    return () => {
      live = false;
    };
  }, [signatureUrl, sealUrl]);

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

  // Same URL, and the same corner spot, that the real PDF's QR code links to and
  // sits in — a scan (of the printed certificate) or this preview both land on
  // the same /verify/<certId> page.
  const verifyUrl = `${verifyBaseUrl.replace(/\/+$/, '')}/verify/${certId}`;
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(verifyUrl, { margin: 1, width: 300 })
      .then((url) => live && setQrDataUrl(url))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [verifyUrl]);

  const issuedLabel = new Date(issuedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const blurb =
    `has successfully completed the ${courseTitle} program conducted by ${orgName}` +
    (totalMarks
      ? ` and achieved a total score of ${totalMarks.total} out of ${totalMarks.max} in the final assessment.`
      : scorePct != null
        ? ` and achieved a score of ${Number(scorePct)}% in the certification exam.`
        : '.');

  // Shrink long certificate types so they never run into the gold rules either side.
  const ofText = `OF ${certType.toUpperCase()}`;
  const ofSize = Math.min(20, 20 * ((1325 - 641 - 60) * ART_X) / (ofText.length * 14.2));

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
            {/* Company seal beside the signature, and the signature on the signing line above the
                printed name. Same art-pixel positions the PDF uses. */}
            {sealSrc && (
              <img
                src={sealSrc}
                alt=""
                className="absolute"
                style={{ left: (1265 - 235 / 2) * ART_X, top: 1040 * ART_Y, width: 235 * ART_X, transform: 'translateY(-50%)', opacity: 0.9 }}
              />
            )}
            {signatureSrc && (
              <img
                src={signatureSrc}
                alt=""
                className="absolute"
                style={{ left: (1524 - 290 / 2) * ART_X, top: 1130 * ART_Y, width: 290 * ART_X, transform: 'translateY(-100%)' }}
              />
            )}

            {/* Cover only the template's own gold "OF" (x 681-754, y 394-428 of the 2000x1414 art)
                and centre our value between the template's two gold rules (x 641-1325, y 413).
                Same numbers as generate-certificate. */}
            <div
              className="absolute"
              style={{ left: 672 * ART_X, top: 388 * ART_Y, width: 92 * ART_X, height: 46 * ART_Y, background: '#fefefe' }}
            />
            <div
              className="absolute whitespace-nowrap text-center font-bold"
              style={{
                left: 641 * ART_X,
                width: (1325 - 641) * ART_X,
                top: 413 * ART_Y - 14,
                height: 28,
                lineHeight: '28px',
                fontSize: ofSize,
                color: gold,
                fontFamily: '"Times New Roman", Times, serif',
              }}
            >
              {ofText}
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

            {/* No caption text on purpose — the QR code alone is enough. */}
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="Scan to verify"
                className="absolute"
                style={{ right: PAGE_W - 0.95 * PAGE_W, bottom: 0.975 * PAGE_H - 58, width: 58, height: 58 }}
              />
            )}

            <div className="absolute" style={{ left: 0.06 * PAGE_W + 28, bottom: 0.135 * PAGE_H, fontSize: 9 }}>
              <span className="font-bold" style={{ color: navy }}>
                Certificate ID{'  '}
              </span>
              <span style={{ color: '#4d4d4d' }}>{certId}</span>
            </div>
            <div className="absolute" style={{ left: 0.06 * PAGE_W + 28, bottom: 0.11 * PAGE_H, fontSize: 9 }}>
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
