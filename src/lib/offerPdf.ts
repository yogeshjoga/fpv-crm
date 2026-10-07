import { loadImage, safe } from './reviewsPdf';
import { EMPLOYMENT_LABEL, LEVEL_LABEL, compensationParagraphs, fmtDate, type Level, type Offer } from './offers';
import { MODE_LABEL, type WorkMode } from './careers';

export interface OrgBrand {
  orgName: string;
  logoUrl: string | null;
  signatureUrl: string | null;
  sealUrl: string | null;
}

type RGB = [number, number, number];
const INK: RGB = [23, 23, 23];
const BODY: RGB = [55, 55, 55];
const MUTED: RGB = [115, 115, 115];
const FAINT: RGB = [163, 163, 163];
const BLUE: RGB = [37, 99, 235];
const RULE: RGB = [221, 226, 235];
const PANEL: RGB = [246, 248, 252];

export type PdfKind = 'offer' | 'jd';
/** 'signed' prints the signature and seal. 'blank' leaves clear space for an original signature and stamp. */
export type SignMode = 'signed' | 'blank';

const MARGIN = 20;

/** Build the offer letter (with the job description attached) or just the job description profile. */
export async function buildOfferPdf(kind: PdfKind, offer: Offer, org: OrgBrand, sign: SignMode) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const contentW = W - MARGIN * 2;
  const FOOT = 18;
  const TOP = 16;

  const [logo, signature, seal] = await Promise.all([
    org.logoUrl ? loadImage(org.logoUrl, false, 400) : Promise.resolve(null),
    sign === 'signed' && org.signatureUrl ? loadImage(org.signatureUrl, true, 420) : Promise.resolve(null),
    sign === 'signed' && org.sealUrl ? loadImage(org.sealUrl, true, 420) : Promise.resolve(null),
  ]);

  let y = TOP;

  const text = (s: string, x: number, ty: number, size: number, style: 'normal' | 'bold' | 'italic', color: RGB, align: 'left' | 'right' | 'center' = 'left') => {
    doc.setFont('helvetica', style).setFontSize(size).setTextColor(...color);
    doc.text(safe(s), x, ty, { align });
  };
  const header = () => {
    if (logo) {
      const h = 12;
      doc.addImage(logo.src, MARGIN, TOP - 4, (logo.w * h) / logo.h, h);
    } else text(org.orgName.toUpperCase(), MARGIN, TOP + 4, 14, 'bold', INK);
    text(kind === 'offer' ? 'OFFER LETTER' : 'JOB DESCRIPTION', W - MARGIN, TOP + 1, 13, 'bold', BLUE, 'right');
    text(kind === 'offer' ? `Ref: ${offer.offer_no ?? ''}` : `Prepared for ${offer.candidate_name}`, W - MARGIN, TOP + 6.5, 8.5, 'normal', MUTED, 'right');
    doc.setDrawColor(...BLUE).setLineWidth(0.6).line(MARGIN, TOP + 11, W - MARGIN, TOP + 11);
    y = TOP + 19;
  };
  const newPage = () => {
    doc.addPage();
    header();
  };
  const ensure = (needed: number) => {
    if (y + needed > H - FOOT) newPage();
  };
  header();

  const lineH = 5;
  /** A wrapped paragraph that flows across pages. */
  const para = (s: string, opts: { size?: number; style?: 'normal' | 'bold' | 'italic'; color?: RGB; indent?: number; gap?: number } = {}) => {
    const size = opts.size ?? 10;
    const indent = opts.indent ?? 0;
    doc.setFont('helvetica', opts.style ?? 'normal').setFontSize(size);
    const lines = doc.splitTextToSize(safe(s), contentW - indent) as string[];
    for (const l of lines) {
      ensure(lineH);
      text(l, MARGIN + indent, y, size, opts.style ?? 'normal', opts.color ?? BODY);
      y += lineH * (size / 10);
    }
    y += opts.gap ?? 2.5;
  };
  const heading = (s: string) => {
    ensure(14);
    y += 2;
    text(s, MARGIN, y, 11, 'bold', INK);
    y += 1.8;
    doc.setDrawColor(...RULE).setLineWidth(0.3).line(MARGIN, y, W - MARGIN, y);
    y += 5.5;
  };
  const bullet = (s: string) => {
    doc.setFont('helvetica', 'normal').setFontSize(10);
    const lines = doc.splitTextToSize(safe(s), contentW - 6) as string[];
    lines.forEach((l, i) => {
      ensure(lineH);
      if (i === 0) {
        doc.setFillColor(...BLUE).circle(MARGIN + 1.5, y - 1.2, 0.7, 'F');
      }
      text(l, MARGIN + 5, y, 10, 'normal', BODY);
      y += lineH;
    });
    y += 0.8;
  };
  /** Job description text: blank lines separate paragraphs, "- " lines are bullets, a short line before bullets is a sub-heading. */
  const jdBlocks = (s: string) => {
    const blocks = s.replace(/\r\n/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
    for (const block of blocks) {
      const lines = block.split('\n');
      const isB = (l: string) => /^\s*[-•*]\s+/.test(l);
      const strip = (l: string) => l.replace(/^\s*[-•*]\s+/, '');
      if (lines.some(isB) && !isB(lines[0])) {
        ensure(12);
        text(lines[0], MARGIN, y, 10.5, 'bold', INK);
        y += 5.5;
        lines.slice(1).forEach((l) => (isB(l) ? bullet(strip(l)) : para(l, { gap: 1 })));
        y += 2;
      } else if (lines.every(isB)) {
        lines.forEach((l) => bullet(strip(l)));
        y += 2;
      } else para(block);
    }
  };
  const detailsTable = (rows: [string, string][]) => {
    const shown = rows.filter(([, v]) => v);
    const labelW = 44;
    shown.forEach(([k, v], i) => {
      doc.setFont('helvetica', 'normal').setFontSize(10);
      const lines = doc.splitTextToSize(safe(v), contentW - labelW - 8) as string[];
      const h = Math.max(1, lines.length) * 4.8 + 2.2;
      ensure(h);
      doc.setFillColor(...(i % 2 === 0 ? PANEL : ([255, 255, 255] as RGB))).rect(MARGIN, y - 3.8, contentW, h, "F");
      text(k, MARGIN + 3, y, 9, 'bold', MUTED);
      lines.forEach((l, j) => text(l, MARGIN + labelW, y + j * 5, 10, 'normal', INK));
      y += h;
    });
    y += 3;
  };

  const roleLine = `${offer.role_title} (${LEVEL_LABEL[offer.level as Level]}, ${EMPLOYMENT_LABEL[offer.employment_type as keyof typeof EMPLOYMENT_LABEL]})`;
  const profileRows = (): [string, string][] => [
    ['Position', offer.role_title],
    ['Level', LEVEL_LABEL[offer.level as Level]],
    ['Engagement', EMPLOYMENT_LABEL[offer.employment_type as keyof typeof EMPLOYMENT_LABEL]],
    ['Department', offer.department],
    ['Work mode', MODE_LABEL[offer.work_mode as WorkMode]],
    ['Location', offer.location],
    ['Reporting to', offer.reporting_to],
    ['Working hours', offer.working_hours],
  ];

  if (kind === 'offer') {
    /* ── date, addressee, subject ─────────────────────────── */
    text(`Date: ${fmtDate(offer.issued_on)}`, MARGIN, y, 10, 'normal', BODY);
    y += 8;
    text('To,', MARGIN, y, 10, 'normal', BODY);
    y += 5.5;
    text(offer.candidate_name, MARGIN, y, 11, 'bold', INK);
    y += 5.5;
    if (offer.candidate_email) {
      text(offer.candidate_email, MARGIN, y, 9.5, 'normal', MUTED);
      y += 5.5;
    }
    y += 3;
    para(`Subject: Offer of ${offer.employment_type === 'internship' ? 'internship' : 'employment'} as ${offer.role_title}`, { style: 'bold', color: INK, size: 10.5, gap: 4 });

    para(`Dear ${offer.candidate_name.split(' ')[0]},`, { gap: 3 });
    para(
      `We are pleased to offer you the position of ${roleLine} at ${org.orgName}. We were impressed with you during our selection process and we look forward to you joining the team. The main terms of this offer are below.`,
      { gap: 4 },
    );

    heading('Your position');
    detailsTable([
      ...profileRows(),
      ['Start date', offer.start_date ? fmtDate(offer.start_date) : ''],
      ['End date', offer.end_date ? fmtDate(offer.end_date) : ''],
      ['Probation', offer.probation_months ? `${offer.probation_months} month${offer.probation_months === 1 ? '' : 's'}` : ''],
      ['Notice period', offer.notice_days ? `${offer.notice_days} days` : ''],
      ['Offer valid until', offer.valid_until ? fmtDate(offer.valid_until) : ''],
    ]);

    heading('Pay');
    compensationParagraphs(offer).forEach((p) => para(p));

    if (offer.terms.trim()) {
      heading('Terms and conditions');
      offer.terms
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .forEach((l) => para(l, { gap: 1.8 }));
    }

    y += 3;
    para(`We welcome you to ${org.orgName} and look forward to a good time working together.`, { gap: 4 });

    /* ── signature block: company on the right, candidate acceptance on the left ─ */
    ensure(62);
    y += 4;
    const boxW = 76;
    const bx = W - MARGIN - boxW;
    const lineY = y + 28;
    text('For ' + org.orgName, bx, y, 10, 'bold', INK);
    if (sign === 'signed') {
      if (seal) {
        const sh = 30;
        const sw = (seal.w * sh) / seal.h;
        doc.setGState(new (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 0.88 }) as never);
        doc.addImage(seal.src, bx + (boxW - sw) / 2, lineY - sh + 3, sw, sh);
        doc.setGState(new (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 1 }) as never);
      }
      if (signature) {
        const sh = 17;
        const sw = Math.min(boxW - 6, (signature.w * sh) / signature.h);
        doc.addImage(signature.src, bx + (boxW - sw) / 2, lineY - sh - 1, sw, sh);
      }
    }
    doc.setDrawColor(...INK).setLineWidth(0.4).line(bx, lineY, bx + boxW, lineY);
    text(offer.signatory_name || 'Authorised signatory', bx, lineY + 5.5, 10.5, 'bold', INK);
    doc.setFont('helvetica', 'normal').setFontSize(8.5);
    (doc.splitTextToSize(safe(offer.signatory_designation), boxW) as string[]).forEach((l, i) => text(l, bx, lineY + 10.5 + i * 4, 8.5, 'normal', MUTED));
    if (sign === 'blank') text('Signature and company seal', bx, lineY + 20, 7, 'normal', FAINT);

    const ax = MARGIN;
    text('Acceptance', ax, y, 10, 'bold', INK);
    text('I accept this offer and its terms.', ax, y + 5.5, 8.5, 'normal', MUTED);
    doc.setDrawColor(...INK).setLineWidth(0.4).line(ax, lineY, ax + boxW - 8, lineY);
    text(offer.candidate_name, ax, lineY + 5.5, 10, 'bold', INK);
    text('Signature and date', ax, lineY + 10.5, 8.5, 'normal', MUTED);
    y = lineY + 24;

    /* ── job description attached ─────────────────────────── */
    if (offer.jd.trim()) {
      newPage();
      text('Annexure: Job description', MARGIN, y, 13, 'bold', INK);
      y += 7;
      text(`${roleLine}  ·  ${offer.candidate_name}`, MARGIN, y, 9, 'normal', MUTED);
      y += 8;
      jdBlocks(offer.jd);
    }
  } else {
    /* ── job description profile ──────────────────────────── */
    text(offer.role_title, MARGIN, y, 17, 'bold', INK);
    y += 7;
    text(`Prepared for ${offer.candidate_name}  ·  ${LEVEL_LABEL[offer.level as Level]}  ·  ${EMPLOYMENT_LABEL[offer.employment_type as keyof typeof EMPLOYMENT_LABEL]}`, MARGIN, y, 9.5, 'normal', MUTED);
    y += 8;
    detailsTable(profileRows());
    heading('Job description');
    jdBlocks(offer.jd || 'To be shared.');
    if (offer.terms.trim()) {
      heading('Terms and conditions');
      offer.terms
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .forEach((l) => para(l, { gap: 1.8 }));
    }
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...RULE).setLineWidth(0.3).line(MARGIN, H - 13, W - MARGIN, H - 13);
    text(`${org.orgName}${kind === 'offer' && offer.offer_no ? `  ·  ${offer.offer_no}` : ''}`, MARGIN, H - 8, 8, 'normal', FAINT);
    text(`Page ${p} of ${pages}`, W - MARGIN, H - 8, 8, 'normal', FAINT, 'right');
  }
  return doc;
}

export async function downloadOfferPdf(kind: PdfKind, offer: Offer, org: OrgBrand, sign: SignMode) {
  const doc = await buildOfferPdf(kind, offer, org, sign);
  const who = offer.candidate_name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'candidate';
  doc.save(`${kind === 'offer' ? 'offer-letter' : 'job-description'}-${who}${sign === 'blank' && kind === 'offer' ? '-unsigned' : ''}.pdf`);
}
