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

type CardType = 'student' | 'coordinator' | 'volunteer';
const CARD_TYPES: CardType[] = ['student', 'coordinator', 'volunteer'];
const TYPE_PREFIX: Record<CardType, string> = { student: 'STU', coordinator: 'CO', volunteer: 'VOL' };
const TYPE_LABEL: Record<CardType, string> = { student: 'STUDENT', coordinator: 'COORDINATOR', volunteer: 'VOLUNTEER' };
const TYPE_TERMS: Record<CardType, string> = {
  student: 'This card certifies that the holder is a registered student of {org}. It remains the property of {org} and must be produced on request during training sessions. Non-transferable.',
  coordinator: 'This card certifies that the holder is an authorized workshop coordinator representing {org}. It remains the property of {org} and must be produced on request during workshop sessions. Non-transferable.',
  volunteer: 'This card certifies that the holder is a registered volunteer supporting {org} workshops. It remains the property of {org} and must be produced on request during workshop sessions. Non-transferable.',
};

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

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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

    const body = await req.json();
    const student_id: string | undefined = body.student_id;
    const course_id: string | null = body.course_id ?? null;
    if (!student_id) throw new HttpError(400, 'student_id is required.');

    const cardType: CardType = CARD_TYPES.includes(body.card_type) ? body.card_type : 'student';
    const workshopName: string | null = body.workshop_name?.trim() || null;
    const workshopLocation: string | null = body.workshop_location?.trim() || null;

    const issuedAt = new Date();
    const validFrom = body.valid_from ? new Date(body.valid_from) : issuedAt;
    const validUntil = body.valid_until
      ? new Date(body.valid_until)
      : (() => {
          const d = new Date(issuedAt);
          d.setFullYear(d.getFullYear() + 1);
          return d;
        })();

    const [{ data: org }, { data: student }, { data: course }] = await Promise.all([
      admin.from('org_settings').select('*').single(),
      admin.from('profiles').select('full_name, email, phone, avatar_url').eq('id', student_id).single(),
      course_id ? admin.from('courses').select('title').eq('id', course_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (!org || !student) throw new HttpError(404, 'Missing data for ID card.');

    // Fee paid isn't typed in per card — pull it from the person's own registration
    // (payment recorded there) so the admin doesn't have to re-enter it by hand.
    let feePaid: string | null = body.fee_paid?.trim() || null;
    if (!feePaid && cardType === 'student') {
      const { data: latestReg } = await admin
        .from('registrations')
        .select('payment_amount, payment_status')
        .eq('created_profile_id', student_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestReg?.payment_amount != null) {
        const status = String(latestReg.payment_status || '').replace(/^./, (c) => c.toUpperCase());
        feePaid = `₹${Number(latestReg.payment_amount).toLocaleString('en-IN')}${status ? ` · ${status}` : ''}`;
      }
    }

    const seq = await admin.rpc('next_id_card_number');
    if (seq.error) throw new HttpError(500, seq.error.message);
    const cardNumber = `${org.cert_id_prefix || 'EGR'}-${TYPE_PREFIX[cardType]}-${String(seq.data ?? 1).padStart(6, '0')}`;

    const pdf = await PDFDocument.create();
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const reg = await pdf.embedFont(StandardFonts.Helvetica);
    const ink = rgb(0.1, 0.1, 0.1);
    const muted = rgb(0.45, 0.45, 0.45);
    // Navy + gold, matching the certificate's palette.
    const navy = rgb(0.059, 0.165, 0.29);
    const navyTint = rgb(0.933, 0.949, 0.968);
    const gold = rgb(0.788, 0.635, 0.153);
    const goldDark = rgb(0.55, 0.42, 0.06);
    const goldOnNavy = rgb(0.91, 0.83, 0.54);

    const orgName = String(org.org_name || 'EgireRobotics');
    const roleLine = cardType === 'student' ? course?.title || 'General Student' : workshopName || `${orgName} Workshop`;

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
    // Corner accents, matching the certificate's navy/gold trim.
    front.drawSvgPath('M0 0 L60 0 L0 34 Z', { x: 0, y: CARD_H, color: navy, opacity: 0.9 });
    front.drawSvgPath('M0 0 L-46 0 L0 26 Z', { x: CARD_W, y: CARD_H, color: gold });

    if (logo) {
      const h = 24;
      const w = (logo.width * h) / logo.height;
      front.drawImage(logo, { x: 10, y: CARD_H - 32, width: w, height: h });
    } else {
      front.drawText(orgName.toUpperCase(), { x: 10, y: CARD_H - 22, size: 10, font: bold, color: navy });
    }
    const frontLabel = `${TYPE_LABEL[cardType].split('').join(' ')}   I D E N T I T Y   C A R D`;
    front.drawText(frontLabel, { x: 10, y: CARD_H - 40, size: 5, font: reg, color: goldDark });
    front.drawLine({ start: { x: 10, y: CARD_H - 45 }, end: { x: CARD_W - 10, y: CARD_H - 45 }, thickness: 0.75, color: gold });

    const photoBox = { x: 10, y: 47, w: 52, h: 62 };
    front.drawRectangle({ x: photoBox.x, y: photoBox.y, width: photoBox.w, height: photoBox.h, borderColor: gold, borderWidth: 1, color: navyTint });
    if (photo) {
      const scale = Math.min(photoBox.w / photo.width, photoBox.h / photo.height);
      const w = photo.width * scale;
      const h = photo.height * scale;
      front.drawImage(photo, { x: photoBox.x + (photoBox.w - w) / 2, y: photoBox.y + (photoBox.h - h) / 2, width: w, height: h });
    } else {
      const label = initials(student.full_name || student.email);
      const size = 22;
      const w = bold.widthOfTextAtSize(label, size);
      front.drawText(label, { x: photoBox.x + (photoBox.w - w) / 2, y: photoBox.y + photoBox.h / 2 - 8, size, font: bold, color: navy });
    }

    const textX = photoBox.x + photoBox.w + 8;
    const textW = CARD_W - textX - 8;
    const name = student.full_name || student.email;
    front.drawText(name, { x: textX, y: 99, size: fitSize(name, bold, textW, 11), font: bold, color: navy });
    front.drawText('ID', { x: textX, y: 85, size: 6.5, font: reg, color: muted });
    front.drawText(cardNumber, { x: textX + 12, y: 85, size: 7.5, font: bold, color: ink });
    for (const [i, line] of wrap(roleLine, reg, 7, textW).slice(0, 2).entries()) {
      front.drawText(line, { x: textX, y: 72 - i * 9, size: 7, font: reg, color: ink });
    }
    front.drawText(`Valid ${fmtDate(validFrom)} – ${fmtDate(validUntil)}`, {
      x: textX,
      y: 51,
      size: 6,
      font: reg,
      color: muted,
    });

    front.drawRectangle({ x: 0, y: 0, width: CARD_W, height: 18, color: navy });
    const tagline = 'EXPLORE  ·  ENGINEER  ·  EXCEL';
    front.drawText(tagline, {
      x: CARD_W / 2 - reg.widthOfTextAtSize(tagline, 6) / 2,
      y: 7,
      size: 6,
      font: reg,
      color: goldOnNavy,
    });

    // ---- back ----------------------------------------------------------------
    const back = pdf.addPage([CARD_W, CARD_H]);
    back.drawRectangle({ x: 0, y: CARD_H - 18, width: CARD_W, height: 18, color: navy });
    back.drawText('TERMS OF USE', { x: 10, y: CARD_H - 12, size: 7, font: bold, color: goldOnNavy });

    const terms = TYPE_TERMS[cardType].replaceAll('{org}', orgName);
    let ty = CARD_H - 29;
    for (const line of wrap(terms, reg, 6, CARD_W - 20)) {
      back.drawText(line, { x: 10, y: ty, size: 6, font: reg, color: muted });
      ty -= 7.5;
    }
    ty -= 2;

    if (workshopName || workshopLocation) {
      const line = [workshopName, workshopLocation].filter(Boolean).join(', ');
      for (const l of wrap(`Workshop: ${line}`, reg, 6, CARD_W - 20).slice(0, 2)) {
        back.drawText(l, { x: 10, y: ty, size: 6, font: reg, color: rgb(0.25, 0.25, 0.25) });
        ty -= 7.5;
      }
    }
    if (feePaid) {
      back.drawText(`Fee: ${feePaid}`, { x: 10, y: ty, size: 6, font: reg, color: rgb(0.25, 0.25, 0.25) });
      ty -= 7.5;
    }

    back.drawText('If found, please return to', { x: 10, y: ty - 4, size: 6.5, font: bold, color: navy });
    back.drawText(orgName, { x: 10, y: ty - 13, size: 6, font: reg, color: muted });
    back.drawText(String(org.support_email || 'contact@egirerobotics.com'), { x: 10, y: ty - 22, size: 6, font: reg, color: muted });

    if (signatureImg) {
      const h = 18;
      const w = (signatureImg.width * h) / signatureImg.height;
      back.drawImage(signatureImg, { x: CARD_W - Math.max(w, 90) - 10 + (Math.max(w, 90) - w) / 2, y: 38, width: w, height: h });
    }
    back.drawLine({ start: { x: CARD_W - 100, y: 36 }, end: { x: CARD_W - 10, y: 36 }, thickness: 0.75, color: gold });
    back.drawText(String(org.signatory_name || 'Authorized Signatory'), { x: CARD_W - 100, y: 26, size: 6.5, font: bold, color: navy });
    back.drawText(String(org.signatory_title || orgName), { x: CARD_W - 100, y: 18, size: 5.5, font: reg, color: muted });

    back.drawText(`${cardNumber}  ·  Issued ${fmtDate(issuedAt)}`, {
      x: 10,
      y: 8,
      size: 5.5,
      font: reg,
      color: muted,
    });
    back.drawSvgPath('M0 0 L-60 0 L0 -34 Z', { x: CARD_W, y: 0, color: navy, opacity: 0.9 });

    const pdfBytes = await pdf.save();
    const pdfPath = `${student_id}/${cardNumber}.pdf`;

    const up = await admin.storage.from('id-cards').upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true });
    if (up.error) throw new HttpError(500, `Storage: ${up.error.message}`);

    const nowIso = new Date().toISOString();
    const { data: inserted, error: insErr } = await admin
      .from('id_cards')
      .upsert(
        {
          student_id,
          card_number: cardNumber,
          course_id: course_id ?? null,
          card_type: cardType,
          workshop_name: workshopName,
          workshop_location: workshopLocation,
          fee_paid: feePaid,
          pdf_path: pdfPath,
          issued_at: nowIso,
          valid_from: validFrom.toISOString().slice(0, 10),
          valid_until: validUntil.toISOString().slice(0, 10),
          last_emailed_at: nowIso,
        },
        { onConflict: 'student_id' },
      )
      .select()
      .single();
    if (insErr) throw new HttpError(500, insErr.message);

    const emailRes = await sendEmail({
      to: student.email,
      subject: `Your ${orgName} ${TYPE_LABEL[cardType].toLowerCase()} ID card`,
      html: emailShell(
        `<h1 style="font-size:20px;margin:0 0 12px;color:#0a0a0a">Welcome, ${esc(student.full_name || 'there')}! 🪪</h1>` +
          `<p style="margin:0 0 16px;color:#444">Your ${TYPE_LABEL[cardType].toLowerCase()} ID card <strong>${esc(cardNumber)}</strong> is attached to this email — front and back on one PDF.</p>` +
          `<p style="margin:0 0 16px;color:#444">Please keep it with you during sessions. It's valid ${fmtDate(validFrom)} to ${fmtDate(validUntil)}.</p>`,
        org.logo_url ?? null,
      ),
      attachments: [{ filename: `${cardNumber}.pdf`, content: encodeBase64(pdfBytes) }],
    });

    await admin.from('notifications').insert({
      recipient_id: student_id,
      title: `Your ${orgName} ID card is ready`,
      body: emailRes.sent
        ? `Card ${cardNumber} has been generated and emailed to you.`
        : `Card ${cardNumber} has been generated, but the email could not be sent — ask an admin to resend it.`,
      kind: 'id_card_issued',
      link: '/app/profile',
    });

    // The card, PDF and DB row are already created at this point — only the email failed.
    // Surface that as an error (instead of a false "success") so the admin can Resend once email is fixed.
    if (!emailRes.sent) throw new HttpError(502, `Card ${cardNumber} was generated, but the email failed to send (${emailRes.skipped ?? 'unknown error'}). Use Resend once email delivery is fixed.`);

    return json(inserted);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: (e as Error).message }, status);
  }
});
