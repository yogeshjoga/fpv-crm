import { trimmedImageUrl } from './trimImage';

export interface ReviewsPdfInput {
  orgName: string;
  logoUrl: string | null;
  groupLabel: string;
  /** e.g. "5-star reviews only" when a star filter is active */
  filterNote: string | null;
  withNames: boolean;
  includeStats: boolean;
  stats: {
    avg: number;
    count: number;
    dist: { n: number; count: number }[];
    satisfied: number;
    commented: number;
    week: number;
    pendingEdits: number;
    edited: number;
    members: number;
    responseRate: number | null;
    days: { label: string; count: number }[];
  };
  reviews: { name: string; group: string; rating: number; date: string; comment: string }[];
  sign: {
    /** 'signed' prints the signature and seal; 'blank' leaves a clear space for an original signature and stamp. */
    mode: 'signed' | 'blank';
    name: string;
    designation: string;
    signatureUrl: string | null;
    sealUrl: string | null;
  };
}

// Same palette as the admin dashboard.
const INK: [number, number, number] = [23, 23, 23];
const MUTED: [number, number, number] = [115, 115, 115];
const FAINT: [number, number, number] = [163, 163, 163];
const AMBER: [number, number, number] = [251, 191, 36];
const BLUE: [number, number, number] = [59, 130, 246];
const GREEN: [number, number, number] = [22, 163, 74];
const TRACK: [number, number, number] = [233, 237, 244];
const PAGE_BG: [number, number, number] = [245, 248, 253];
const CARD_BORDER: [number, number, number] = [226, 232, 242];

// The built-in PDF fonts only cover Latin text. Dashes and curly quotes become their plain look-alikes,
// anything else outside Latin-1 becomes "?" (the CSV export keeps every character).
export const safe = (v: unknown) =>
  String(v ?? '')
    .replace(/₹/g, 'Rs. ')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\u0000-ÿ]/g, '?');

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export async function loadImage(url: string, trim: boolean, maxSide = 700): Promise<{ src: string; w: number; h: number } | null> {
  try {
    let src = trim ? await trimmedImageUrl(url) : url;
    if (!src.startsWith('data:')) src = await blobToDataUrl(await (await fetch(url)).blob());
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = src;
    });
    // Shrink big uploads (a signature or logo is often several megapixels) so the PDF stays light.
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
    return { src: canvas.toDataURL('image/png'), w, h };
  } catch {
    return null; // a missing or unsupported image must never stop the report
  }
}

/** Student feedback report, styled like the Reviews dashboard, with an optional signature and company seal. */
export async function downloadReviewsPdf(input: ReviewsPdfInput) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const contentW = W - M * 2;
  const FOOT = 16; // space kept free at the bottom of each page

  const [logo, signature, seal] = await Promise.all([
    input.logoUrl ? loadImage(input.logoUrl, false, 360) : Promise.resolve(null),
    input.sign.mode === 'signed' && input.sign.signatureUrl ? loadImage(input.sign.signatureUrl, true, 420) : Promise.resolve(null),
    input.sign.mode === 'signed' && input.sign.sealUrl ? loadImage(input.sign.sealUrl, true, 420) : Promise.resolve(null),
  ]);

  const paintPage = () => {
    doc.setFillColor(...PAGE_BG).rect(0, 0, W, H, 'F');
  };
  paintPage();
  let y = M;
  const newPage = () => {
    doc.addPage();
    paintPage();
    y = M;
  };
  const ensure = (needed: number) => {
    if (y + needed > H - FOOT) newPage();
  };

  const card = (x: number, top: number, w: number, h: number) => {
    doc.setFillColor(255, 255, 255).setDrawColor(...CARD_BORDER).setLineWidth(0.3).roundedRect(x, top, w, h, 3, 3, 'FD');
  };
  const text = (s: string, x: number, ty: number, size: number, style: 'normal' | 'bold', color: [number, number, number], align: 'left' | 'right' | 'center' = 'left') => {
    doc.setFont('helvetica', style).setFontSize(size).setTextColor(...color);
    doc.text(safe(s), x, ty, { align });
  };
  const star = (cx: number, cy: number, r: number, color: [number, number, number]) => {
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? r : r * 0.42;
      pts.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]);
    }
    const segs = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
    doc.setFillColor(...color).lines(segs, pts[0][0], pts[0][1], [1, 1], 'F', true);
  };
  const stars = (x: number, cy: number, value: number, r: number, gap: number) => {
    for (let i = 0; i < 5; i++) star(x + r + i * (r * 2 + gap), cy, r, i < value ? AMBER : [221, 225, 232]);
  };
  const pct = (n: number) => `${n}%`;

  /* ── header ─────────────────────────────────────────────── */
  if (logo) {
    const h = 11;
    doc.addImage(logo.src, M, y, (logo.w * h) / logo.h, h);
  } else {
    text(input.orgName.toUpperCase(), M, y + 7, 14, 'bold', INK);
  }
  text('Student Feedback Report', W - M, y + 5.5, 15, 'bold', INK, 'right');
  text(`Generated ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, W - M, y + 10.5, 8.5, 'normal', MUTED, 'right');
  y += 17;
  doc.setDrawColor(...CARD_BORDER).setLineWidth(0.3).line(M, y, W - M, y);
  y += 6;

  text(input.groupLabel, M, y, 11, 'bold', INK);
  const sub = [`${input.stats.count} review${input.stats.count === 1 ? '' : 's'}`, input.filterNote, input.withNames ? 'Student names shown' : 'Anonymous'].filter(Boolean).join('  ·  ');
  text(sub, M, y + 5, 8.5, 'normal', MUTED);
  y += 11;

  /* ── statistics (same as the dashboard) ─────────────────── */
  if (input.includeStats) {
    const s = input.stats;
    const top = y;
    card(M, top, contentW, 86);

    // big average
    text(s.count ? s.avg.toFixed(1) : '-', M + 22, top + 22, 34, 'bold', INK, 'center');
    stars(M + 22 - 13, top + 28, Math.round(s.avg), 2.3, 0.9);
    text(`${s.count} review${s.count === 1 ? '' : 's'}`, M + 22, top + 37, 8, 'normal', MUTED, 'center');

    // distribution
    const dx = M + 50;
    const bw = 46;
    s.dist.forEach((d, i) => {
      const ry = top + 11 + i * 7.6;
      text(String(d.n), dx, ry + 2, 8, 'normal', MUTED, 'right');
      doc.setFillColor(...TRACK).roundedRect(dx + 3, ry - 0.4, bw, 2.6, 1.3, 1.3, 'F');
      if (d.count && s.count) doc.setFillColor(...AMBER).roundedRect(dx + 3, ry - 0.4, Math.max(2.6, (d.count / s.count) * bw), 2.6, 1.3, 1.3, 'F');
      text(String(d.count), dx + bw + 6, ry + 2, 8, 'normal', FAINT, 'left');
    });

    // four stat tiles
    const tx = M + 112;
    const tw = (W - M - 5 - tx - 4) / 2;
    const tiles: [string, string, string, boolean][] = [
      ['Satisfied (4-5 stars)', s.count ? pct(s.satisfied) : '-', '', false],
      ['Wrote a comment', s.count ? pct(s.commented) : '-', '', false],
      ['Last 7 days', String(s.week), s.week === 1 ? 'new review' : 'new reviews', false],
      ['Edit requests', String(s.pendingEdits), s.edited ? `${s.edited} edited so far` : 'pending', s.pendingEdits > 0],
    ];
    tiles.forEach(([label, value, subtext, hi], i) => {
      const x = tx + (i % 2) * (tw + 4);
      const ty = top + 6 + Math.floor(i / 2) * 25;
      doc.setFillColor(...(hi ? ([255, 247, 224] as [number, number, number]) : ([247, 249, 253] as [number, number, number])))
        .setDrawColor(...(hi ? ([252, 211, 77] as [number, number, number]) : CARD_BORDER))
        .setLineWidth(0.25)
        .roundedRect(x, ty, tw, 21, 2.5, 2.5, 'FD');
      text(label, x + 3, ty + 5.5, 7.5, 'normal', MUTED);
      text(value, x + 3, ty + 13.5, 15, 'bold', INK);
      if (subtext) text(subtext, x + 3, ty + 18.2, 7, 'normal', FAINT);
    });

    // response rate + reviews per day
    const by = top + 61;
    doc.setDrawColor(...CARD_BORDER).setLineWidth(0.25).line(M + 5, by - 5, W - M - 5, by - 5);
    text('Response rate', M + 6, by + 1, 8, 'bold', MUTED);
    if (s.members) {
      text(pct(s.responseRate ?? 0), M + 6, by + 10, 15, 'bold', INK);
      text(`${s.count} of ${s.members} students have reviewed`, M + 22, by + 10, 8, 'normal', MUTED);
      doc.setFillColor(...TRACK).roundedRect(M + 6, by + 13, 82, 2.4, 1.2, 1.2, 'F');
      doc.setFillColor(...BLUE).roundedRect(M + 6, by + 13, Math.max(2.4, (82 * (s.responseRate ?? 0)) / 100), 2.4, 1.2, 1.2, 'F');
    } else {
      text('No students in this group yet.', M + 6, by + 9, 8, 'normal', FAINT);
    }

    const cx = M + 100;
    text('Reviews per day - last 7 days', cx, by + 1, 8, 'bold', MUTED);
    const max = Math.max(1, ...s.days.map((d) => d.count));
    const colW = (W - M - 6 - cx) / 7;
    s.days.forEach((d, i) => {
      const barH = d.count ? Math.max(2.5, (d.count / max) * 11) : 1.2;
      doc.setFillColor(...(d.count ? AMBER : TRACK)).roundedRect(cx + i * colW + 1.5, by + 15 - barH, colW - 3, barH, 0.8, 0.8, 'F');
      text(d.label, cx + i * colW + colW / 2, by + 19, 6.5, 'normal', FAINT, 'center');
    });

    y = top + 86 + 8;
  }

  /* ── reviews ────────────────────────────────────────────── */
  ensure(24);
  text('Student feedback', M, y, 12, 'bold', INK);
  y += 5;

  if (!input.reviews.length) {
    text('No reviews match this selection.', M, y + 6, 9.5, 'normal', MUTED);
    y += 12;
  }

  const lineH = 4.5;
  for (const r of input.reviews) {
    doc.setFont('helvetica', 'normal').setFontSize(9.5);
    const lines = r.comment.trim() ? (doc.splitTextToSize(safe(r.comment), contentW - 10) as string[]) : [];
    const h = 8 + 7 + (lines.length ? lines.length * lineH + 2 : 0) + 3;
    ensure(Math.min(h, 40));
    // a very long comment is allowed to flow onto the next page
    const fits = y + h <= H - FOOT;
    card(M, y, contentW, fits ? h : H - FOOT - y);
    text(r.name, M + 5, y + 7, 10.5, 'bold', INK);
    const gx = W - M - 5;
    text(`${r.group}  ·  ${r.date}`, gx, y + 7, 8, 'normal', FAINT, 'right');
    stars(M + 5, y + 12.5, r.rating, 1.9, 0.8);
    let ly = y + 20;
    if (fits) {
      lines.forEach((l) => {
        text(l, M + 5, ly, 9.5, 'normal', [64, 64, 64]);
        ly += lineH;
      });
      y += h + 3.5;
    } else {
      // overflowing comment: continue the remaining lines on following pages
      let i = 0;
      for (; i < lines.length && ly < H - FOOT - 2; i++) {
        text(lines[i], M + 5, ly, 9.5, 'normal', [64, 64, 64]);
        ly += lineH;
      }
      newPage();
      for (; i < lines.length; i++) {
        ensure(lineH + 2);
        text(lines[i], M + 5, y + 4, 9.5, 'normal', [64, 64, 64]);
        y += lineH;
      }
      y += 6;
    }
  }

  /* ── signature block ────────────────────────────────────── */
  const blockH = 46;
  ensure(blockH + 6);
  y += 4;
  const boxW = 84;
  const bx = W - M - boxW;
  const lineY = y + 30;
  if (input.sign.mode === 'signed') {
    if (seal) {
      const sh = 30;
      const sw = (seal.w * sh) / seal.h;
      doc.setGState(new (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 0.88 }) as never);
      doc.addImage(seal.src, bx - sw * 0.28, lineY - sh + 2, sw, sh);
      doc.setGState(new (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 1 }) as never);
    }
    if (signature) {
      const sh = 17;
      const sw = Math.min(boxW - 6, (signature.w * sh) / signature.h);
      doc.addImage(signature.src, bx + (boxW - sw) / 2 + 4, lineY - sh - 1, sw, sh);
    }
  }
  doc.setDrawColor(...INK).setLineWidth(0.4).line(bx, lineY, bx + boxW, lineY);
  text(input.sign.name, bx, lineY + 5.5, 11, 'bold', INK);
  text(input.sign.designation, bx, lineY + 10.5, 8.5, 'normal', MUTED);
  if (input.sign.mode === 'blank') text('Signature and company seal', bx, lineY + 15, 7, 'normal', FAINT);

  /* ── footer on every page ───────────────────────────────── */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    text(`${input.orgName}  ·  Student feedback report`, M, H - 8, 8, 'normal', FAINT);
    text(`Page ${p} of ${pages}`, W - M, H - 8, 8, 'normal', FAINT, 'right');
  }

  doc.save(`student-feedback-${new Date().toISOString().slice(0, 10)}${input.withNames ? '' : '-anonymous'}${input.sign.mode === 'blank' ? '-unsigned' : ''}.pdf`);
}
