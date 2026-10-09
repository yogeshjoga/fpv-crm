import { loadImage, safe } from './reviewsPdf';
import type { OrgBrand } from './offerPdf';

export interface EmployeeIdInput {
  fullName: string;
  code: string;
  designation: string;
  department: string;
  joinedOn: string | null;
  email: string;
  phone: string;
  photoUrl: string | null;
}

type RGB = [number, number, number];
const INK: RGB = [23, 23, 23];
const MUTED: RGB = [110, 110, 110];
const BLUE: RGB = [37, 99, 235];
const RULE: RGB = [221, 226, 235];

const fmt = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

/** A credit-card sized (85.6 x 54 mm) employee ID: front with photo and details, back with return address and signature. */
export async function downloadEmployeeIdCard(input: EmployeeIdInput, org: OrgBrand) {
  const { jsPDF } = await import('jspdf');
  const W = 85.6;
  const H = 54;
  const doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: 'landscape' });
  const text = (s: string, x: number, y: number, size: number, style: 'normal' | 'bold', color: RGB, align: 'left' | 'center' | 'right' = 'left') => {
    doc.setFont('helvetica', style).setFontSize(size).setTextColor(...color);
    doc.text(safe(s), x, y, { align });
  };

  const [logo, photo, signature] = await Promise.all([
    org.logoUrl ? loadImage(org.logoUrl, false, 360) : Promise.resolve(null),
    input.photoUrl ? loadImage(input.photoUrl, false, 420) : Promise.resolve(null),
    org.signatureUrl ? loadImage(org.signatureUrl, true, 360) : Promise.resolve(null),
  ]);

  /* ── front ───────────────────────────────────────────── */
  doc.setFillColor(...BLUE).rect(0, 0, W, 2.2, 'F');
  if (logo) {
    const h = 7;
    doc.addImage(logo.src, 4, 4.2, (logo.w * h) / logo.h, h);
  } else text(org.orgName.toUpperCase(), 4, 9, 9, 'bold', INK);
  text('EMPLOYEE', W - 4, 8.4, 7, 'bold', BLUE, 'right');
  doc.setDrawColor(...RULE).setLineWidth(0.2).line(4, 12.4, W - 4, 12.4);

  const px = 4;
  const py = 16;
  const pw = 22;
  const ph = 28;
  if (photo) {
    doc.addImage(photo.src, px, py, pw, ph);
  } else {
    doc.setFillColor(238, 242, 250).roundedRect(px, py, pw, ph, 2, 2, 'F');
    const initials = input.fullName
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
    text(initials || '?', px + pw / 2, py + ph / 2 + 3, 16, 'bold', BLUE, 'center');
  }

  const tx = px + pw + 5;
  const name = doc.splitTextToSize(safe(input.fullName), W - tx - 4) as string[];
  name.slice(0, 2).forEach((l, i) => text(l, tx, 20 + i * 5, 11, 'bold', INK));
  let y = 20 + Math.min(name.length, 2) * 5 + 1;
  if (input.designation) {
    text(input.designation, tx, y, 8, 'bold', BLUE);
    y += 4.2;
  }
  if (input.department) {
    text(input.department, tx, y, 7.5, 'normal', MUTED);
    y += 4.4;
  }
  text(`ID  ${input.code}`, tx, y + 2, 8, 'bold', INK);
  if (input.joinedOn) text(`Joined  ${fmt(input.joinedOn)}`, tx, y + 6.4, 7.5, 'normal', MUTED);
  text(org.orgName, W - 4, H - 3, 6, 'normal', MUTED, 'right');

  /* ── back ────────────────────────────────────────────── */
  doc.addPage([W, H], 'landscape');
  doc.setFillColor(...BLUE).rect(0, 0, W, 2.2, 'F');
  text('This card is the property of', W / 2, 9, 7, 'normal', MUTED, 'center');
  text(org.orgName, W / 2, 13.5, 10, 'bold', INK, 'center');
  text('If found, please return it to the company office or write to', W / 2, 19, 6.5, 'normal', MUTED, 'center');
  text('contact@egirerobotics.com', W / 2, 23, 7.5, 'bold', BLUE, 'center');
  doc.setDrawColor(...RULE).setLineWidth(0.2).line(8, 28, W - 8, 28);
  if (input.email) text(input.email, W / 2, 32, 6.5, 'normal', MUTED, 'center');
  if (input.phone) text(input.phone, W / 2, 35.6, 6.5, 'normal', MUTED, 'center');
  if (signature) {
    const sh = 8;
    const sw = Math.min(26, (signature.w * sh) / signature.h);
    doc.addImage(signature.src, W - 8 - sw, 38, sw, sh);
  }
  doc.setDrawColor(...INK).setLineWidth(0.2).line(W - 36, 47, W - 8, 47);
  text('Authorised signatory', W - 22, 50.4, 5.5, 'normal', MUTED, 'center');
  text('Must be returned on leaving.', 8, 50.4, 5.5, 'normal', MUTED);

  doc.save(`employee-id-${input.code.toLowerCase()}.pdf`);
}
