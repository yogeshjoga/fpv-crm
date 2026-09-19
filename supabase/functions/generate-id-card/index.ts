import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { adminClient, cors, emailShell, HttpError, json, sendEmail } from '../_shared/common.ts';

/** True for our own service-role calls (e.g. accept-registration) or a signed-in instructor/super_admin. */
async function callerAuthorized(req: Request, admin: ReturnType<typeof adminClient>): Promise<boolean> {
  const provided = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (provided && serviceKey && provided === serviceKey) return true;
  try {
    if (JSON.parse(atob(provided.split('.')[1])).role === 'service_role') return true;
  } catch {
    /* not a service-role JWT */
  }
  try {
    const { data } = await admin.auth.getUser(provided);
    if (!data.user) return false;
    const { data: me } = await admin.from('profiles').select('role').eq('id', data.user.id).single();
    return !!me && ['instructor', 'super_admin'].includes(me.role);
  } catch {
    return false;
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Card is CR80 size — 3.375in x 2.125in — at 72pt/in. */
const CARD_W = 243;
const CARD_H = 153;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function wrap(text: string, font: Awaited<ReturnType<PDFDocument['embedFont']>>, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const trial = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fitSize(text: string, font: Awaited<ReturnType<PDFDocument['embedFont']>>, maxWidth: number, startSize: number, minSize = 6.5): number {
  let size = startSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.5;
  return size;
}

async function embedRemoteImage(pdf: PDFDocument, url: string) {
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const lower = url.toLowerCase();
  return lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const admin = adminClient();
    if (!(await callerAuthorized(req, admin))) throw new HttpError(403, 'Forbidden.');

    const { student_id, course_id } = await req.json();
    if (!student_id) throw new HttpError(400, 'student_id is required.');

    const { data: existing } = await admin.from('id_cards').select('*').eq('student_id', student_id).maybeSingle();
    if (existing) return json(existing);

    const [{ data: org }, { data: student }, { data: course }] = await Promise.all([
      admin.from('org_settings').select('*').single(),
      admin.from('profiles').select('full_name, email, phone, avatar_url').eq('id', student_id).single(),
      course_id ? admin.from('courses').select('title').eq('id', course_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (!org || !student) throw new HttpError(404, 'Missing data for ID card.');

    const seq = await admin.rpc('next_id_card_number');
    if (seq.error) throw new HttpError(500, seq.error.message);
    const cardNumber = `${org.cert_id_prefix || 'EGR'}-ID-${String(seq.data ?? 1).padStart(6, '0')}`;
    const issuedAt = new Date();
    const validUntil = new Date(issuedAt);
    validUntil.setFullYear(validUntil.getFullYear() + 1);

    const pdf = await PDFDocument.create();
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const reg = await pdf.embedFont(StandardFonts.Helvetica);
    const ink = rgb(0.1, 0.1, 0.1);
    const muted = rgb(0.45, 0.45, 0.45);
    const accent = rgb(0.15, 0.39, 0.92);
    const accentLight = rgb(0.9, 0.94, 0.99);
    const white = rgb(1, 1, 1);

    const orgName = String(org.org_name || 'EgireRobotics');
    const courseTitle = course?.title || 'General Student';

    let photo: Awaited<ReturnType<typeof embedRemoteImage>> | null = null;
    if (student.avatar_url) {
      try {
        photo = await embedRemoteImage(pdf, student.avatar_url);
      } catch (e) {
        console.error('avatar embed failed', e);
      }
    }
    let logo: Awaited<ReturnType<typeof embedRemoteImage>> | null = null;
    if (org.logo_url) {
      try {
        logo = await embedRemoteImage(pdf, org.logo_url);
      } catch (e) {
        console.error('logo embed failed', e);
      }
    }
    let signatureImg: Awaited<ReturnType<typeof embedRemoteImage>> | null = null;
    if (org.signatory_image_url) {
      try {
        signatureImg = await embedRemoteImage(pdf, org.signatory_image_url);
      } catch (e) {
        console.error('signature embed failed', e);
      }
    }

    // ---- front -------------------------------------------------------------
    const front = pdf.addPage([CARD_W, CARD_H]);
    front.drawRectangle({ x: 0, y: CARD_H - 34, width: CARD_W, height: 34, color: accent });
    if (logo) {
      const h = 20;
      const w = (logo.width * h) / logo.height;
      front.drawImage(logo, { x: 8, y: CARD_H - 27, width: w, height: h });
      front.drawText(orgName.toUpperCase(), { x: 8 + w + 6, y: CARD_H - 16, size: 8.5, font: bold, color: white });
    } else {
      front.drawText(orgName.toUpperCase(), { x: 8, y: CARD_H - 16, size: 9, font: bold, color: white });
    }
    front.drawText('STUDENT IDENTITY CARD', { x: 8, y: CARD_H - 27, size: 5.5, font: reg, color: white });

    const photoBox = { x: 10, y: 49, w: 52, h: 64 };
    front.drawRectangle({ x: photoBox.x, y: photoBox.y, width: photoBox.w, height: photoBox.h, borderColor: muted, borderWidth: 1, color: accentLight });
    if (photo) {
      const scale = Math.min(photoBox.w / photo.width, photoBox.h / photo.height);
      const w = photo.width * scale;
      const h = photo.height * scale;
      front.drawImage(photo, { x: photoBox.x + (photoBox.w - w) / 2, y: photoBox.y + (photoBox.h - h) / 2, width: w, height: h });
    } else {
      const label = initials(student.full_name || student.email);
      const size = 22;
      const w = bold.widthOfTextAtSize(label, size);
      front.drawText(label, { x: photoBox.x + (photoBox.w - w) / 2, y: photoBox.y + photoBox.h / 2 - 8, size, font: bold, color: accent });
    }

    const textX = photoBox.x + photoBox.w + 8;
    const textW = CARD_W - textX - 8;
    const name = student.full_name || student.email;
    front.drawText(name, { x: textX, y: 101, size: fitSize(name, bold, textW, 10.5), font: bold, color: ink });
    front.drawText('ID', { x: textX, y: 87, size: 6.5, font: reg, color: muted });
    front.drawText(cardNumber, { x: textX + 12, y: 87, size: 7.5, font: bold, color: ink });
    for (const [i, line] of wrap(courseTitle, reg, 7, textW).slice(0, 2).entries()) {
      front.drawText(line, { x: textX, y: 74 - i * 9, size: 7, font: reg, color: ink });
    }
    front.drawText(
      `Valid until ${validUntil.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      { x: textX, y: 51, size: 6.5, font: reg, color: muted },
    );

    front.drawLine({ start: { x: 0, y: 14 }, end: { x: CARD_W, y: 14 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
    front.drawText(String(org.support_email || 'contact@egirerobotics.com'), {
      x: CARD_W / 2 - reg.widthOfTextAtSize(String(org.support_email || 'contact@egirerobotics.com'), 6) / 2,
      y: 5,
      size: 6,
      font: reg,
      color: muted,
    });

    // ---- back ----------------------------------------------------------------
    const back = pdf.addPage([CARD_W, CARD_H]);
    back.drawText('TERMS OF USE', { x: 8, y: CARD_H - 12, size: 7, font: bold, color: accent });
    const terms =
      `This card certifies that the holder is a registered student of ${orgName}. It remains the property of ` +
      `${orgName} and must be produced on request during training sessions. Non-transferable.`;
    let ty = CARD_H - 23;
    for (const line of wrap(terms, reg, 6, CARD_W - 16)) {
      back.drawText(line, { x: 8, y: ty, size: 6, font: reg, color: muted });
      ty -= 7.5;
    }

    back.drawText('If found, please return to:', { x: 8, y: ty - 6, size: 6, font: bold, color: ink });
    back.drawText(orgName, { x: 8, y: ty - 15, size: 6, font: reg, color: muted });
    back.drawText(String(org.support_email || 'contact@egirerobotics.com'), { x: 8, y: ty - 24, size: 6, font: reg, color: muted });

    if (signatureImg) {
      const h = 20;
      const w = (signatureImg.width * h) / signatureImg.height;
      back.drawImage(signatureImg, { x: CARD_W - w - 14, y: 40, width: w, height: h });
    }
    back.drawLine({ start: { x: CARD_W - 90, y: 36 }, end: { x: CARD_W - 10, y: 36 }, thickness: 0.75, color: muted });
    back.drawText(String(org.signatory_name || 'Authorized Signatory'), { x: CARD_W - 90, y: 26, size: 6.5, font: bold, color: ink });
    back.drawText(String(org.signatory_title || orgName), { x: CARD_W - 90, y: 18, size: 5.5, font: reg, color: muted });

    back.drawText(cardNumber, { x: 8, y: 8, size: 5.5, font: reg, color: muted });
    back.drawText(`Issued ${issuedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, {
      x: 8,
      y: 8 + 0,
      size: 5.5,
      font: reg,
      color: muted,
    });

    const pdfBytes = await pdf.save();
    const pdfPath = `${student_id}/${cardNumber}.pdf`;

    const up = await admin.storage.from('id-cards').upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true });
    if (up.error) throw new HttpError(500, `Storage: ${up.error.message}`);

    const nowIso = new Date().toISOString();
    const { data: inserted, error: insErr } = await admin
      .from('id_cards')
      .insert({
        student_id,
        card_number: cardNumber,
        course_id: course_id ?? null,
        pdf_path: pdfPath,
        issued_at: nowIso,
        valid_until: validUntil.toISOString().slice(0, 10),
        last_emailed_at: nowIso,
      })
      .select()
      .single();
    if (insErr) throw new HttpError(500, insErr.message);

    await admin.from('notifications').insert({
      recipient_id: student_id,
      title: `Your ${orgName} student ID card is ready`,
      body: `Card ${cardNumber} has been generated and emailed to you.`,
      kind: 'id_card_issued',
      link: '/app/profile',
    });

    await sendEmail({
      to: student.email,
      subject: `Your ${orgName} student ID card`,
      html: emailShell(
        `<h1 style="font-size:20px;margin:0 0 12px;color:#0a0a0a">Welcome, ${esc(student.full_name || 'there')}! 🪪</h1>` +
          `<p style="margin:0 0 16px;color:#444">Your student ID card <strong>${esc(cardNumber)}</strong> is attached to this email — front and back on one PDF.</p>` +
          `<p style="margin:0 0 16px;color:#444">Please keep it with you during training sessions. It's valid until ${validUntil.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.</p>`,
        org.logo_url ?? null,
      ),
      attachments: [{ filename: `${cardNumber}.pdf`, content: encodeBase64(pdfBytes) }],
    });

    return json(inserted);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: (e as Error).message }, status);
  }
});
