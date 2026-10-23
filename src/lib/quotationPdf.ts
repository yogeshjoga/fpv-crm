import { loadImage, safe } from './reviewsPdf';
import type { OrgBrand } from './offerPdf';
import {
  MODE_LABEL, PROGRAMME_LABEL, amountInWords, calcTotals, durationText, fmtDate, inr, parseItems, parseList, proposedDates,
  type DeliveryMode, type ProgrammeType, type Quotation,
} from './quotations';

type RGB = [number, number, number];
const INK: RGB = [23, 23, 23];
const BODY: RGB = [55, 55, 55];
const MUTED: RGB = [115, 115, 115];
const FAINT: RGB = [163, 163, 163];
const BLUE: RGB = [37, 99, 235];
const RULE: RGB = [221, 226, 235];
const PANEL: RGB = [246, 248, 252];
const WHITE: RGB = [255, 255, 255];

const MARGIN = 18;

export interface QuotePdfOptions {
  org: OrgBrand;
  supportEmail?: string;
  /** Print the signature and the company seal. Off leaves clear space for an original signature and stamp. */
  signed: boolean;
}

/** The client quotation as an A4 PDF: logo, clear dates, programme, itemised pricing, terms, signature and seal. */
export async function buildQuotationPdf(q: Quotation, opts: QuotePdfOptions) {
  const { org } = opts;
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const cw = W - MARGIN * 2;
  const FOOT = 18;
  const TOP = 15;

  const [logo, signature, seal] = await Promise.all([
    org.logoUrl ? loadImage(org.logoUrl, false, 400) : Promise.resolve(null),
    opts.signed && org.signatureUrl ? loadImage(org.signatureUrl, true, 420) : Promise.resolve(null),
    opts.signed && org.sealUrl ? loadImage(org.sealUrl, true, 420) : Promise.resolve(null),
  ]);

  const items = parseItems(q.items);
  const topics = parseList(q.topics);
  const inclusions = parseList(q.inclusions);
  const money = (n: number) => safe(inr(n));
  // The saved totals are the source of truth; recompute only to be able to show the discount and taxable lines.
  const t = calcTotals(items, Number(q.discount_amount), Number(q.gst_percent));
  const total = Number(q.total);

  let y = TOP;
  const text = (s: string, x: number, ty: number, size: number, style: 'normal' | 'bold' | 'italic', color: RGB, align: 'left' | 'right' | 'center' = 'left') => {
    doc.setFont('helvetica', style).setFontSize(size).setTextColor(...color);
    doc.text(safe(s), x, ty, { align });
  };
  const wrap = (s: string, width: number, size: number, style: 'normal' | 'bold' = 'normal') => {
    doc.setFont('helvetica', style).setFontSize(size);
    return doc.splitTextToSize(safe(s), width) as string[];
  };

  const header = () => {
    if (logo) {
      const h = 13;
      doc.addImage(logo.src, MARGIN, TOP - 4, (logo.w * h) / logo.h, h);
    } else text(org.orgName.toUpperCase(), MARGIN, TOP + 4, 15, 'bold', INK);
    text('QUOTATION', W - MARGIN, TOP + 1, 16, 'bold', BLUE, 'right');
    text(`No. ${q.quote_no ?? ''}`, W - MARGIN, TOP + 6.5, 9, 'normal', MUTED, 'right');
    doc.setDrawColor(...BLUE).setLineWidth(0.6).line(MARGIN, TOP + 11.5, W - MARGIN, TOP + 11.5);
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

  const heading = (s: string) => {
    ensure(16);
    y += 3;
    text(s, MARGIN, y, 11, 'bold', INK);
    y += 1.8;
    doc.setDrawColor(...RULE).setLineWidth(0.3).line(MARGIN, y, W - MARGIN, y);
    y += 5.5;
  };
  const para = (s: string, size = 10, color: RGB = BODY, gap = 2.2) => {
    for (const l of wrap(s, cw, size)) {
      ensure(5);
      text(l, MARGIN, y, size, 'normal', color);
      y += 5 * (size / 10);
    }
    y += gap;
  };
  const bullet = (s: string) => {
    wrap(s, cw - 6, 10).forEach((l, i) => {
      ensure(5);
      if (i === 0) doc.setFillColor(...BLUE).circle(MARGIN + 1.5, y - 1.2, 0.7, 'F');
      text(l, MARGIN + 5, y, 10, 'normal', BODY);
      y += 5;
    });
    y += 0.8;
  };
  const detailRows = (rows: [string, string][]) => {
    const labelW = 40;
    rows.filter(([, v]) => v).forEach(([k, v], i) => {
      const lines = wrap(v, cw - labelW - 8, 10);
      const h = lines.length * 4.9 + 2.4;
      ensure(h);
      doc.setFillColor(...(i % 2 === 0 ? PANEL : WHITE)).rect(MARGIN, y - 4, cw, h, 'F');
      text(k, MARGIN + 3, y, 9, 'bold', MUTED);
      lines.forEach((l, j) => text(l, MARGIN + labelW, y + j * 4.9, 10, 'normal', INK));
      y += h;
    });
    y += 2;
  };

  /* ── the three dates that matter, side by side ─────────── */
  const boxW = (cw - 8) / 3;
  const dateBoxes: [string, string][] = [
    ['ISSUED ON', fmtDate(q.issued_on)],
    ['VALID UNTIL', fmtDate(q.valid_until)],
    ['PROPOSED DATES', proposedDates(q)],
  ];
  const datesLines = wrap(dateBoxes[2][1], boxW - 7, 8.5, 'bold').slice(0, 4).length;
  const boxH = Math.max(17, 9 + datesLines * 4);
  dateBoxes.forEach(([label, value], i) => {
    const x = MARGIN + i * (boxW + 4);
    doc.setFillColor(...PANEL).setDrawColor(...RULE).setLineWidth(0.3).roundedRect(x, y - 4, boxW, boxH, 2, 2, 'FD');
    text(label, x + 3.5, y + 0.8, 7.5, 'bold', MUTED);
    wrap(value, boxW - 7, i === 2 ? 8.5 : 10.5, 'bold').slice(0, 4).forEach((l, j) => text(l, x + 3.5, y + 6.3 + j * 4, i === 2 ? 8.5 : 10.5, 'bold', INK));
  });
  y += boxH + 5;

  /* ── client and company ───────────────────────────────── */
  const colW = (cw - 8) / 2;
  const clientLines: { s: string; style: 'normal' | 'bold'; size: number; color: RGB }[] = [{ s: q.client_name, style: 'bold', size: 11, color: INK }];
  if (q.client_designation) clientLines.push({ s: q.client_designation, style: 'normal', size: 9.5, color: BODY });
  if (q.organisation) clientLines.push({ s: q.organisation, style: 'bold', size: 10, color: BODY });
  if (q.client_address) clientLines.push({ s: q.client_address, style: 'normal', size: 9, color: MUTED });
  if (q.client_email) clientLines.push({ s: q.client_email, style: 'normal', size: 9, color: MUTED });
  if (q.client_phone) clientLines.push({ s: q.client_phone, style: 'normal', size: 9, color: MUTED });
  const fromLines: typeof clientLines = [{ s: org.orgName, style: 'bold', size: 11, color: INK }];
  if (q.prepared_by) fromLines.push({ s: `Contact: ${q.prepared_by}`, style: 'normal', size: 9.5, color: BODY });
  if (q.prepared_phone) fromLines.push({ s: q.prepared_phone, style: 'normal', size: 9, color: MUTED });
  if (opts.supportEmail) fromLines.push({ s: opts.supportEmail, style: 'normal', size: 9, color: MUTED });
  fromLines.push({ s: 'egirerobotics.com', style: 'normal', size: 9, color: MUTED });

  const blockHeight = (lines: typeof clientLines) => lines.reduce((n, l) => n + wrap(l.s, colW, l.size, l.style).length * (l.size > 10 ? 5.2 : 4.5), 0);
  const blockH = Math.max(blockHeight(clientLines), blockHeight(fromLines)) + 8;
  ensure(blockH + 6);
  const drawBlock = (x: number, label: string, lines: typeof clientLines) => {
    text(label, x, y, 8, 'bold', BLUE);
    let ly = y + 5.5;
    for (const l of lines) {
      for (const w of wrap(l.s, colW, l.size, l.style)) {
        text(w, x, ly, l.size, l.style, l.color);
        ly += l.size > 10 ? 5.2 : 4.5;
      }
    }
  };
  drawBlock(MARGIN, 'PREPARED FOR', clientLines);
  drawBlock(MARGIN + colW + 8, 'PREPARED BY', fromLines);
  y += blockH + 2;

  /* ── subject and intro ────────────────────────────────── */
  ensure(24);
  text(`Subject: Quotation for ${q.title}`, MARGIN, y, 11, 'bold', INK);
  y += 6.5;
  const who = q.client_name.split(' ')[0];
  para(`Dear ${who},`, 10, BODY, 2);
  para(
    `Thank you for your interest in EgireRobotics. As discussed, we are pleased to share our quotation for the ${PROGRAMME_LABEL[q.programme_type as ProgrammeType].toLowerCase()} below, for approximately ${q.participants} participant${q.participants === 1 ? '' : 's'}.`,
    10, BODY, 3,
  );

  heading('Programme details');
  detailRows([
    ['Programme', q.title],
    ['Type', PROGRAMME_LABEL[q.programme_type as ProgrammeType]],
    ['Participants', `Approximately ${q.participants}`],
    ['Duration', durationText(q)],
    ['Mode', MODE_LABEL[q.mode as DeliveryMode]],
    ['Venue', q.venue],
    ['Proposed dates', proposedDates(q)],
  ]);

  if (topics.length) {
    heading('Topics covered');
    topics.forEach(bullet);
  }

  /* ── pricing table ────────────────────────────────────── */
  heading('Quotation');
  const cNo = MARGIN + 2;
  const cDesc = MARGIN + 10;
  const cQty = MARGIN + cw - 64;
  const cRate = MARGIN + cw - 38;
  const cAmt = MARGIN + cw - 2;
  const descW = cQty - cDesc - 28;
  const tableHead = () => {
    doc.setFillColor(...INK).rect(MARGIN, y - 4.6, cw, 7.4, 'F');
    text('#', cNo, y, 8.5, 'bold', WHITE);
    text('DESCRIPTION', cDesc, y, 8.5, 'bold', WHITE);
    text('QTY', cQty, y, 8.5, 'bold', WHITE, 'right');
    text('RATE', cRate, y, 8.5, 'bold', WHITE, 'right');
    text('AMOUNT', cAmt, y, 8.5, 'bold', WHITE, 'right');
    y += 7;
  };
  ensure(24);
  tableHead();
  items.forEach((it, i) => {
    const lines = wrap(it.description, descW, 10);
    const h = Math.max(lines.length * 4.9, 5) + 3.4;
    if (y + h > H - FOOT) {
      newPage();
      tableHead();
    }
    doc.setFillColor(...(i % 2 === 0 ? PANEL : WHITE)).rect(MARGIN, y - 4.2, cw, h, 'F');
    text(String(i + 1), cNo, y, 9.5, 'normal', MUTED);
    lines.forEach((l, j) => text(l, cDesc, y + j * 4.9, 10, 'normal', INK));
    const qty = `${Number(it.qty).toLocaleString('en-IN', { maximumFractionDigits: 2 })}${it.unit ? ` ${it.unit}` : ''}`;
    text(qty, cQty, y, 9, 'normal', BODY, 'right');
    text(money(it.rate), cRate, y, 9.5, 'normal', BODY, 'right');
    text(money(Math.round(it.qty * it.rate * 100) / 100), cAmt, y, 10, 'normal', INK, 'right');
    y += h;
  });
  doc.setDrawColor(...RULE).setLineWidth(0.3).line(MARGIN, y - 3, W - MARGIN, y - 3);
  y += 3;

  ensure(42 + (Number(q.discount_amount) > 0 ? 6 : 0) + (Number(q.gst_percent) > 0 ? 6 : 0));
  const totalsX = MARGIN + cw - 82;
  const totalLine = (label: string, value: string, strong = false) => {
    ensure(8);
    text(label, totalsX, y, strong ? 10.5 : 9.5, strong ? 'bold' : 'normal', strong ? INK : BODY);
    text(value, cAmt, y, strong ? 11 : 10, strong ? 'bold' : 'normal', INK, 'right');
    y += strong ? 7 : 5.8;
  };
  totalLine('Subtotal', money(Number(q.subtotal) || t.subtotal));
  if (Number(q.discount_amount) > 0) totalLine('Discount', `- ${money(Number(q.discount_amount))}`);
  if (Number(q.gst_percent) > 0) totalLine(`GST @ ${Number(q.gst_percent)}%`, money(Number(q.gst_amount)));
  y += 2;
  ensure(14);
  doc.setFillColor(...BLUE).roundedRect(totalsX - 3, y - 5, cAmt - totalsX + 5, 9, 1.5, 1.5, 'F');
  text('TOTAL', totalsX, y + 0.8, 10.5, 'bold', WHITE);
  text(money(total), cAmt, y + 0.8, 11.5, 'bold', WHITE, 'right');
  y += 10;
  wrap(amountInWords(total), cw, 9).forEach((l) => {
    ensure(5);
    text(l, MARGIN, y, 9, 'italic', MUTED);
    y += 4.4;
  });
  if (q.gst_note.trim()) {
    y += 1;
    para(q.gst_note.trim(), 9, MUTED, 1);
  }

  if (inclusions.length) {
    heading('What is included');
    inclusions.forEach(bullet);
  }
  if (q.payment_terms.trim()) {
    heading('Payment terms');
    para(q.payment_terms.trim());
  }
  const terms = q.terms.split('\n').map((l) => l.trim()).filter(Boolean);
  if (terms.length) {
    heading('Terms and conditions');
    terms.forEach(bullet);
  }
  if (q.notes.trim()) {
    heading('Notes');
    q.notes.split('\n').map((l) => l.trim()).filter(Boolean).forEach((l) => para(l, 10, BODY, 1.5));
  }

  y += 2;
  para(`This quotation is valid until ${fmtDate(q.valid_until)}. We would be glad to work with you and look forward to your confirmation.`, 10, BODY, 3);

  /* ── signature, seal and client acceptance ────────────── */
  ensure(64);
  y += 4;
  const sigW = 76;
  const bx = W - MARGIN - sigW;
  const lineY = y + 28;
  text(`For ${org.orgName}`, bx, y, 10, 'bold', INK);
  if (opts.signed) {
    if (seal) {
      const sh = 30;
      const sw = (seal.w * sh) / seal.h;
      doc.setGState(new (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 0.88 }) as never);
      doc.addImage(seal.src, bx + (sigW - sw) / 2, lineY - sh + 3, sw, sh);
      doc.setGState(new (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 1 }) as never);
    }
    if (signature) {
      const sh = 17;
      const sw = Math.min(sigW - 6, (signature.w * sh) / signature.h);
      doc.addImage(signature.src, bx + (sigW - sw) / 2, lineY - sh - 1, sw, sh);
    }
  }
  doc.setDrawColor(...INK).setLineWidth(0.4).line(bx, lineY, bx + sigW, lineY);
  text(q.signatory_name || 'Authorised signatory', bx, lineY + 5.5, 10.5, 'bold', INK);
  wrap(q.signatory_designation, sigW, 8.5).forEach((l, i) => text(l, bx, lineY + 10.5 + i * 4, 8.5, 'normal', MUTED));
  text(`Date: ${fmtDate(q.issued_on)}`, bx, lineY + 10.5 + Math.max(1, wrap(q.signatory_designation, sigW, 8.5).length) * 4 + 1, 8.5, 'normal', MUTED);
  if (!opts.signed) text('Signature and company seal', bx, lineY + 24, 7, 'normal', FAINT);

  text('Client acceptance', MARGIN, y, 10, 'bold', INK);
  text('We accept this quotation and its terms.', MARGIN, y + 5.5, 8.5, 'normal', MUTED);
  doc.setDrawColor(...INK).setLineWidth(0.4).line(MARGIN, lineY, MARGIN + sigW - 8, lineY);
  text(q.client_name, MARGIN, lineY + 5.5, 10, 'bold', INK);
  text('Signature, stamp and date', MARGIN, lineY + 10.5, 8.5, 'normal', MUTED);
  y = lineY + 26;

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...RULE).setLineWidth(0.3).line(MARGIN, H - 13, W - MARGIN, H - 13);
    text(`${org.orgName}  ·  ${q.quote_no ?? ''}  ·  Issued ${fmtDate(q.issued_on)}`, MARGIN, H - 8, 8, 'normal', FAINT);
    text(`Page ${p} of ${pages}`, W - MARGIN, H - 8, 8, 'normal', FAINT, 'right');
  }
  return doc;
}

const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

export async function downloadQuotationPdf(q: Quotation, opts: QuotePdfOptions) {
  const doc = await buildQuotationPdf(q, opts);
  doc.save(`quotation-${slug(q.quote_no ?? 'draft')}-${slug(q.organisation || q.client_name) || 'client'}.pdf`);
}

/** Opens the PDF in a new tab so staff can check it before sending. */
export async function previewQuotationPdf(q: Quotation, opts: QuotePdfOptions) {
  const doc = await buildQuotationPdf(q, opts);
  const url = URL.createObjectURL(doc.output('blob'));
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
