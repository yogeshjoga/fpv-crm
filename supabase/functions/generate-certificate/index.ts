import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';
import QRCode from 'https://esm.sh/qrcode@1.5.4';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { adminClient, cors, emailShell, HttpError, json, sendEmail } from '../_shared/common.ts';

function callerIsServiceRole(req: Request): boolean {
  const provided = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (provided && serviceKey && provided === serviceKey) return true;
  // legacy JWT service-role token
  try {
    return JSON.parse(atob(provided.split('.')[1])).role === 'service_role';
  } catch {
    return false;
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const PAGE_W = 842;
const PAGE_H = 595;

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

async function embedRemoteImage(pdf: PDFDocument, url: string) {
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const lower = url.toLowerCase();
  return lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    if (!callerIsServiceRole(req)) throw new HttpError(403, 'Forbidden.');
    const admin = adminClient();
    const { attempt_id, student_id, course_id, score_pct } = await req.json();
    if (!student_id || !course_id) throw new HttpError(400, 'student_id and course_id are required.');

    const { data: existing } = await admin
      .from('certificates')
      .select('cert_id_string, pdf_path')
      .eq('student_id', student_id)
      .eq('course_id', course_id)
      .eq('revoked', false)
      .maybeSingle();
    if (existing) return json(existing);

    const [{ data: org }, { data: course }, { data: student }] = await Promise.all([
      admin.from('org_settings').select('*').single(),
      admin.from('courses').select('title, course_code, cert_type').eq('id', course_id).single(),
      admin.from('profiles').select('full_name, email').eq('id', student_id).single(),
    ]);
    if (!org || !course || !student) throw new HttpError(404, 'Missing data for certificate.');

    const { data: seq } = await admin.rpc('next_cert_number', { p_course_code: course.course_code });
    const year = new Date().getFullYear();
    const certId = `${org.cert_id_prefix}-${course.course_code}-${year}-${String(seq ?? 1).padStart(6, '0')}`;
    const base = String(org.verify_base_url || '').replace(/\/+$/, '');
    const verifyUrl = `${base}/verify/${certId}`;
    const issuedAt = new Date();

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const reg = await pdf.embedFont(StandardFonts.Helvetica);
    const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
    const ink = rgb(0.1, 0.1, 0.1);
    const muted = rgb(0.42, 0.42, 0.42);
    const accent = rgb(0.15, 0.39, 0.92);
    const navy = rgb(0.059, 0.165, 0.29);
    const gold = rgb(0.788, 0.635, 0.153);

    const centre = (text: string, y: number, font: Awaited<ReturnType<PDFDocument['embedFont']>>, size: number, color = ink) => {
      const w = font.widthOfTextAtSize(text, size);
      page.drawText(text, { x: PAGE_W / 2 - w / 2, y, size, font, color });
    };

    let backgroundImg: Awaited<ReturnType<typeof embedRemoteImage>> | null = null;
    if (org.cert_background_url) {
      try {
        backgroundImg = await embedRemoteImage(pdf, org.cert_background_url);
      } catch (e) {
        console.error('certificate background embed failed', e);
      }
    }

    if (backgroundImg) {
      // Branded background (logo, borders, signature already baked in) with dynamic
      // fields printed on top, positions tuned to this exact template layout.
      page.drawImage(backgroundImg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

      // Mask the template's plain "OF" line so the certificate type can replace it.
      page.drawRectangle({ x: PAGE_W * 0.2, y: PAGE_H * 0.675, width: PAGE_W * 0.6, height: PAGE_H * 0.052, color: rgb(0.992, 0.988, 0.976) });
      centre(`OF ${String(course.cert_type || 'Participation').toUpperCase()}`, PAGE_H * 0.685, serifBold, 20, gold);

      centre(student.full_name || student.email, PAGE_H * 0.585, serifBold, 22, navy);

      const scoreLine = score_pct != null ? ` and achieved a score of ${Number(score_pct)}% in the certification exam.` : '.';
      const blurb =
        `has successfully completed the ${course.title} program conducted by ${org.org_name}${scoreLine}`;
      let by = PAGE_H * 0.465;
      for (const line of wrap(blurb, reg, 12, PAGE_W * 0.55)) {
        centre(line, by, reg, 12, rgb(0.2, 0.2, 0.2));
        by -= 18;
      }

      const verifyX = PAGE_W * 0.95;
      const verifyRight = (text: string, y: number, font: Awaited<ReturnType<PDFDocument['embedFont']>>, size: number, color = navy) => {
        const w = font.widthOfTextAtSize(text, size);
        page.drawText(text, { x: verifyX - w, y, size, font, color });
      };
      verifyRight('Scan or visit', PAGE_H * 0.955, reg, 8, navy);
      verifyRight(String(org.verify_base_url || 'egirerobotics.com').replace(/^https?:\/\//, ''), PAGE_H * 0.935, bold, 8, gold);
      for (const [i, line] of wrap("to confirm this certificate's holder, course and issue date.", reg, 7.5, PAGE_W * 0.19).entries()) {
        verifyRight(line, PAGE_H * 0.918 - i * 11, reg, 7.5, navy);
      }

      page.drawText(`Certificate ID`, { x: PAGE_W * 0.06, y: PAGE_H * 0.135, size: 9, font: bold, color: navy });
      page.drawText(certId, { x: PAGE_W * 0.06 + bold.widthOfTextAtSize('Certificate ID  ', 9), y: PAGE_H * 0.135, size: 9, font: reg, color: rgb(0.3, 0.3, 0.3) });
      page.drawText(`Date of issue`, { x: PAGE_W * 0.06, y: PAGE_H * 0.11, size: 9, font: bold, color: navy });
      page.drawText(issuedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), {
        x: PAGE_W * 0.06 + bold.widthOfTextAtSize('Date of issue  ', 9),
        y: PAGE_H * 0.11,
        size: 9,
        font: reg,
        color: rgb(0.3, 0.3, 0.3),
      });
    } else {
      // Fallback plain layout, used only until an org uploads a certificate background.
      page.drawRectangle({ x: 24, y: 24, width: 794, height: 547, borderColor: accent, borderWidth: 2 });
      page.drawRectangle({ x: 32, y: 32, width: 778, height: 531, borderColor: rgb(0.8, 0.85, 0.95), borderWidth: 1 });

      centre(String(org.org_name || 'EgireRobotics').toUpperCase(), 500, bold, 20, accent);
      centre('CERTIFICATE OF COMPLETION', 452, bold, 30);
      centre('This is to certify that', 402, reg, 13, muted);
      centre(student.full_name || student.email, 358, bold, 26);
      centre('has successfully completed the course', 320, reg, 13, muted);
      centre(course.title, 286, bold, 19, accent);
      centre(
        `Score ${Number(score_pct ?? 0)}%   -   Issued ${issuedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
        250,
        reg,
        12,
        muted,
      );

      page.drawText(`Certificate ID: ${certId}`, { x: 60, y: 70, size: 10, font: reg, color: muted });
      page.drawText(`Verify at ${verifyUrl}`, { x: 60, y: 54, size: 9, font: reg, color: muted });

      page.drawLine({ start: { x: 520, y: 120 }, end: { x: 720, y: 120 }, thickness: 1, color: muted });
      page.drawText(String(org.signatory_name || 'Authorized Signatory'), { x: 520, y: 104, size: 10, font: bold, color: ink });
      page.drawText(String(org.signatory_title || org.org_name || 'EgireRobotics'), { x: 520, y: 90, size: 9, font: reg, color: muted });

      try {
        const qrDataUrl: string = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 300 });
        const qrPng = await pdf.embedPng(qrDataUrl);
        page.drawImage(qrPng, { x: 92, y: 96, width: 96, height: 96 });
      } catch (e) {
        console.error('QR render failed', e);
      }

      if (org.logo_url) {
        try {
          const logo = await embedRemoteImage(pdf, org.logo_url);
          const scale = 60 / logo.height;
          page.drawImage(logo, { x: 421 - (logo.width * scale) / 2, y: 512, width: logo.width * scale, height: 60 });
        } catch (e) {
          console.error('logo embed failed', e);
        }
      }
    }

    const pdfBytes = await pdf.save();
    const pdfPath = `${student_id}/${certId}.pdf`;

    const up = await admin.storage.from('certificates').upload(pdfPath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (up.error) throw new HttpError(500, `Storage: ${up.error.message}`);

    const { error: insErr } = await admin.from('certificates').insert({
      cert_id_string: certId,
      student_id,
      course_id,
      attempt_id: attempt_id ?? null,
      score_pct: Number(score_pct ?? 0),
      issued_at: issuedAt.toISOString(),
      pdf_path: pdfPath,
      qr_url: verifyUrl,
    });
    if (insErr) throw new HttpError(500, insErr.message);

    await admin.from('notifications').insert({
      recipient_id: student_id,
      title: `Certificate issued — ${course.title}`,
      body: `You passed ${course.title} with ${Number(score_pct ?? 0)}%. Certificate ${certId} is ready to download.`,
      kind: 'exam_passed',
      link: '/app/certificates',
    });

    await sendEmail({
      to: student.email,
      subject: `Your ${org.org_name} certificate - ${course.title}`,
      html: emailShell(
        `<h1 style="font-size:20px;margin:0 0 12px;color:#0a0a0a">Congratulations, ${esc(student.full_name || 'there')}! 🎉</h1>` +
          `<p style="margin:0 0 16px;color:#444">You passed <strong>${esc(course.title)}</strong> with a score of ${Number(score_pct ?? 0)}%.</p>` +
          `<p style="margin:0 0 16px;color:#444">Your certificate <strong>${certId}</strong> is attached to this email. Anyone can confirm it here:</p>` +
          `<p style="margin:0"><a href="${verifyUrl}" style="color:#0a0a0a">${verifyUrl}</a></p>`,
        org,
      ),
      attachments: [{ filename: `${certId}.pdf`, content: encodeBase64(pdfBytes) }],
    });

    return json({ cert_id_string: certId, pdf_path: pdfPath });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: (e as Error).message }, status);
  }
});
