import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';
import QRCode from 'https://esm.sh/qrcode@1.5.4';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { adminClient, cors, HttpError, json, sendEmail } from '../_shared/common.ts';

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
      admin.from('courses').select('title, course_code').eq('id', course_id).single(),
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
    const page = pdf.addPage([842, 595]);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const reg = await pdf.embedFont(StandardFonts.Helvetica);
    const ink = rgb(0.1, 0.1, 0.1);
    const muted = rgb(0.42, 0.42, 0.42);
    const accent = rgb(0.15, 0.39, 0.92);

    page.drawRectangle({ x: 24, y: 24, width: 794, height: 547, borderColor: accent, borderWidth: 2 });
    page.drawRectangle({ x: 32, y: 32, width: 778, height: 531, borderColor: rgb(0.8, 0.85, 0.95), borderWidth: 1 });

    const centre = (text: string, y: number, font: typeof bold, size: number, color = ink) => {
      const w = font.widthOfTextAtSize(text, size);
      page.drawText(text, { x: 421 - w / 2, y, size, font, color });
    };

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
    page.drawText(String(org.signatory_name || 'Authorized Signatory'), { x: 520, y: 104, size: 10, font: reg, color: ink });
    page.drawText(String(org.org_name || 'EgireRobotics'), { x: 520, y: 90, size: 9, font: reg, color: muted });

    try {
      const qrDataUrl: string = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 300 });
      const qrPng = await pdf.embedPng(qrDataUrl);
      page.drawImage(qrPng, { x: 92, y: 96, width: 96, height: 96 });
    } catch (e) {
      console.error('QR render failed', e);
    }

    if (org.logo_url) {
      try {
        const bytes = new Uint8Array(await (await fetch(org.logo_url)).arrayBuffer());
        const lower = String(org.logo_url).toLowerCase();
        const img = lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
        const scale = 60 / img.height;
        page.drawImage(img, { x: 421 - (img.width * scale) / 2, y: 512, width: img.width * scale, height: 60 });
      } catch (e) {
        console.error('logo embed failed', e);
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

    await sendEmail({
      to: student.email,
      subject: `Your ${org.org_name} certificate - ${course.title}`,
      html: `<div style='font-family:system-ui,Arial,sans-serif;max-width:520px;margin:auto'>` +
        `<h2 style='margin:0 0 8px'>Congratulations, ${esc(student.full_name || 'there')}!</h2>` +
        `<p style='color:#444'>You passed <strong>${esc(course.title)}</strong> with a score of ${Number(score_pct ?? 0)}%.</p>` +
        `<p style='color:#444'>Your certificate <strong>${certId}</strong> is attached. Anyone can confirm it at:</p>` +
        `<p><a href='${verifyUrl}'>${verifyUrl}</a></p>` +
        `<p style='color:#888;font-size:13px'>${esc(String(org.org_name))} - FPV &amp; Drone Training</p></div>`,
      attachments: [{ filename: `${certId}.pdf`, content: encodeBase64(pdfBytes) }],
    });

    return json({ cert_id_string: certId, pdf_path: pdfPath });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: (e as Error).message }, status);
  }
});
