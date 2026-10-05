import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';
import QRCode from 'https://esm.sh/qrcode@1.5.4';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { decode as decodePng, encode as encodePng } from 'https://esm.sh/fast-png@6.2.0';
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

/**
 * Embeds a signature / seal image cropped to its visible ink. These are normally transparent PNGs
 * on a big empty canvas (e.g. 1920x1080 with a small stamp in the middle); drawing the whole canvas
 * would shrink the real signature to a speck and put it in the wrong place.
 */
async function embedTrimmedImage(pdf: PDFDocument, url: string) {
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const isJpg = url.toLowerCase().split('?')[0].match(/\.jpe?g$/);
  if (isJpg) return await pdf.embedJpg(bytes);
  try {
    const png = decodePng(bytes);
    if (png.channels === 4 && png.depth === 8) {
      const { width, height, data } = png;
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (data[(y * width + x) * 4 + 3] > 8) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX >= 0) {
        const w = maxX - minX + 1;
        const h = maxY - minY + 1;
        const out = new Uint8Array(w * h * 4);
        for (let row = 0; row < h; row++) {
          const from = ((minY + row) * width + minX) * 4;
          out.set(data.subarray(from, from + w * 4), row * w * 4);
        }
        return await pdf.embedPng(encodePng({ width: w, height: h, data: out, channels: 4, depth: 8 }));
      }
    }
  } catch (e) {
    console.error('image trim failed, using it as uploaded', e);
  }
  return await pdf.embedPng(bytes);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    if (!callerIsServiceRole(req)) throw new HttpError(403, 'Forbidden.');
    const admin = adminClient();
    const { attempt_id, student_id, course_id, score_pct, cert_type, breakdown, report } = (await req.json()) as {
      attempt_id?: string;
      student_id?: string;
      course_id?: string;
      score_pct?: number;
      /** Per-certificate type (e.g. "Merit"); falls back to the course's cert_type. */
      cert_type?: string;
      /** Composite assessment marks; when present the certificate reports total marks, not exam %. */
      breakdown?: { online: number; viva: number; simulation: number; piloting: number; total: number; max: number };
      /** Per-module report card snapshot (marks, pass marks, cleared flags) from finalize-assessment. */
      report?: {
        modules: { key: string; label: string; marks: number; max: number; pass: number; cleared: boolean }[];
        total: number;
        max: number;
        clearedAll: boolean;
        failed: string[];
      };
    };
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
    // A random tail makes certificate numbers impossible to enumerate from the public verify page.
    const tail = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
    const certId = `${org.cert_id_prefix}-${course.course_code}-${year}-${String(seq ?? 1).padStart(6, '0')}-${tail}`;
    const base = String(org.verify_base_url || '').replace(/\/+$/, '');
    const verifyUrl = `${base}/verify/${certId}`;
    const issuedAt = new Date();
    const certType = String(cert_type || course.cert_type || 'Participation');

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

    // The signatory's signature and the company seal, set in Company Settings. A missing or broken
    // image must never stop a certificate being issued.
    let signatureImg: Awaited<ReturnType<typeof embedTrimmedImage>> | null = null;
    let sealImg: Awaited<ReturnType<typeof embedTrimmedImage>> | null = null;
    if (org.signatory_image_url) {
      try {
        signatureImg = await embedTrimmedImage(pdf, org.signatory_image_url);
      } catch (e) {
        console.error('signature embed failed', e);
      }
    }
    if (org.company_seal_url) {
      try {
        sealImg = await embedTrimmedImage(pdf, org.company_seal_url);
      } catch (e) {
        console.error('seal embed failed', e);
      }
    }

    if (backgroundImg) {
      // Branded background (logo, borders and the printed signatory name are baked in) with the
      // dynamic fields, signature and seal placed on top, positions tuned to this exact template.
      page.drawImage(backgroundImg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

      const artX = PAGE_W / 2000;
      const artY = PAGE_H / 1414;

      // Signature on the template's signing line (x 1400-1648, y 1135 of the 2000x1414 art, above the
      // printed name) and the company seal just to its left, like a stamp beside the signature.
      const drawArt = (img: NonNullable<typeof sealImg>, cx: number, widthArt: number, opts: { bottom?: number; centerY?: number; opacity?: number }) => {
        const w = widthArt * artX;
        const h = (w * img.height) / img.width;
        const y = opts.centerY !== undefined ? PAGE_H - opts.centerY * artY - h / 2 : PAGE_H - opts.bottom! * artY;
        page.drawImage(img, { x: cx * artX - w / 2, y, width: w, height: h, opacity: opts.opacity ?? 1 });
      };
      if (sealImg) drawArt(sealImg, 1524, 235, { centerY: 1040, opacity: 0.9 });
      if (signatureImg) drawArt(signatureImg, 1524, 290, { bottom: 1130 });
      // Cover only the template's own gold "OF" (x 681-754, y 394-428 of the 2000x1414 art,
      // on a pure-white background) so the certificate type can replace it. Anything wider
      // shows up as a white patch over the sky and mountains.
      page.drawRectangle({ x: 672 * artX, y: PAGE_H - 434 * artY, width: 92 * artX, height: 46 * artY, color: rgb(0.996, 0.996, 0.996) });
      // Centre the type between the template's two gold rules (x 641-1325, y 413), shrinking
      // long names so they never run into the rules.
      const ofText = `OF ${certType.toUpperCase()}`;
      const ofMaxW = (1325 - 641 - 60) * artX;
      const ofSize = Math.min(20, (20 * ofMaxW) / serifBold.widthOfTextAtSize(ofText, 20));
      const ofCapH = serifBold.heightAtSize(ofSize, { descender: false });
      page.drawText(ofText, {
        x: ((641 + 1325) / 2) * artX - serifBold.widthOfTextAtSize(ofText, ofSize) / 2,
        y: PAGE_H - 413 * artY - ofCapH / 2,
        size: ofSize,
        font: serifBold,
        color: gold,
      });

      centre(student.full_name || student.email, PAGE_H * 0.585, serifBold, 22, navy);

      const scoreLine = breakdown
        ? ` and achieved a total score of ${breakdown.total} out of ${breakdown.max} in the final assessment.`
        : score_pct != null
          ? ` and achieved a score of ${Number(score_pct)}% in the certification exam.`
          : '.';
      const blurb =
        `has successfully completed the ${course.title} program conducted by ${org.org_name}${scoreLine}`;
      let by = PAGE_H * 0.465;
      for (const line of wrap(blurb, reg, 12, PAGE_W * 0.55)) {
        centre(line, by, reg, 12, rgb(0.2, 0.2, 0.2));
        by -= 18;
      }

      // QR code straight to the public verification page — sits in the open sky area
      // top-right that the template's own corner-bracket flourish already marks out,
      // clear of the mountain art and the "Small Drones Big Dreams" script below it.
      // No caption text on purpose — the QR code alone is enough.
      try {
        const qrDataUrl: string = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 300 });
        const qrPng = await pdf.embedPng(qrDataUrl);
        const qrSize = 58;
        const qrRight = PAGE_W * 0.95;
        const qrTop = PAGE_H * 0.975;
        const qrX = qrRight - qrSize;
        const qrY = qrTop - qrSize;
        page.drawImage(qrPng, { x: qrX, y: qrY, width: qrSize, height: qrSize });
      } catch (e) {
        console.error('certificate QR render failed', e);
      }

      const footerX = PAGE_W * 0.06 + 28;
      page.drawText(`Certificate ID`, { x: footerX, y: PAGE_H * 0.135, size: 9, font: bold, color: navy });
      page.drawText(certId, { x: footerX + bold.widthOfTextAtSize('Certificate ID  ', 9), y: PAGE_H * 0.135, size: 9, font: reg, color: rgb(0.3, 0.3, 0.3) });
      page.drawText(`Date of issue`, { x: footerX, y: PAGE_H * 0.11, size: 9, font: bold, color: navy });
      page.drawText(issuedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), {
        x: footerX + bold.widthOfTextAtSize('Date of issue  ', 9),
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

      if (sealImg) {
        const w = 80;
        const h = (w * sealImg.height) / sealImg.width;
        page.drawImage(sealImg, { x: 470 - w / 2, y: 135 - h / 2, width: w, height: h, opacity: 0.9 });
      }
      if (signatureImg) {
        const w = 130;
        const h = (w * signatureImg.height) / signatureImg.width;
        page.drawImage(signatureImg, { x: 620 - w / 2, y: 124, width: w, height: h });
      }
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
      cert_type: cert_type ? certType : null,
      report: report ?? null,
    });
    if (insErr) throw new HttpError(500, insErr.message);

    await admin.from('notifications').insert({
      recipient_id: student_id,
      title: breakdown ? `${certType} certificate issued — ${course.title}` : `Certificate issued — ${course.title}`,
      body: breakdown
        ? `Your final score is ${breakdown.total} out of ${breakdown.max} — ${report ? (report.clearedAll ? 'you cleared every module' : `not cleared: ${report.failed.join(', ')}`) : 'see your report'}. Your Certificate of ${certType} (${certId}) and your report card are ready.`
        : `You passed ${course.title} with ${Number(score_pct ?? 0)}%. Certificate ${certId} is ready to download.`,
      kind: 'exam_passed',
      link: report ? '/app/report-card' : '/app/certificates',
    });

    const isMerit = certType.toLowerCase() === 'merit';
    const cell = 'padding:6px 14px 6px 0;border-bottom:1px solid #eee';
    // Module-by-module report card in the email: marks, pass mark and a clear Cleared / Not cleared.
    const marksTable = report
      ? `<table style="border-collapse:collapse;margin:0 0 16px;font-size:14px;color:#444;width:100%">` +
        `<tr style="text-align:left;color:#888;font-size:12px"><th style="${cell}">Module</th><th style="${cell}">Your marks</th><th style="${cell}">Pass mark</th><th style="${cell}">Status</th></tr>` +
        report.modules
          .map(
            (m) =>
              `<tr><td style="${cell}">${esc(m.label)}</td><td style="${cell};font-weight:600">${m.marks} / ${m.max}</td><td style="${cell}">${m.pass}</td>` +
              `<td style="${cell};font-weight:600;color:${m.cleared ? '#15803d' : '#b91c1c'}">${m.cleared ? 'Cleared' : 'Not cleared'}</td></tr>`,
          )
          .join('') +
        `<tr><td style="padding:8px 14px 4px 0"><strong>Total</strong></td><td style="padding:8px 14px 4px 0;font-weight:700" colspan="3">${report.total} / ${report.max}</td></tr></table>`
      : breakdown
        ? `<table style="border-collapse:collapse;margin:0 0 16px;font-size:14px;color:#444">` +
          (
            [
              ['Online exam', breakdown.online],
              ['Viva', breakdown.viva],
              ['Simulation', breakdown.simulation],
              ['Free flight', breakdown.piloting],
            ] as [string, number][]
          )
            .map(([k, v]) => `<tr><td style="padding:3px 24px 3px 0">${k}</td><td style="padding:3px 0;font-weight:600">${v}</td></tr>`)
            .join('') +
          `<tr><td style="padding:6px 24px 3px 0;border-top:1px solid #e5e5e5"><strong>Total</strong></td><td style="padding:6px 0 3px;border-top:1px solid #e5e5e5;font-weight:700">${breakdown.total} / ${breakdown.max}</td></tr></table>`
        : '';
    const notCleared =
      report && !report.clearedAll
        ? `<p style="margin:0 0 16px;color:#444">To earn a Certificate of Merit a student has to clear <strong>every</strong> module, whatever the total. You did not clear: <strong>${esc(report.failed.join(', '))}</strong>.</p>`
        : '';
    const intro = breakdown
      ? isMerit
        ? `<h1 style="font-size:20px;margin:0 0 12px;color:#0a0a0a">Congratulations, ${esc(student.full_name || 'there')}! 🎉</h1>` +
          `<p style="margin:0 0 16px;color:#444">You cleared every module and earned a <strong>Certificate of Merit</strong> for <strong>${esc(course.title)}</strong>. Here is your report card:</p>`
        : `<h1 style="font-size:20px;margin:0 0 12px;color:#0a0a0a">Thank you for taking part, ${esc(student.full_name || 'there')}!</h1>` +
          `<p style="margin:0 0 16px;color:#444">You completed <strong>${esc(course.title)}</strong>. Here is your Certificate of Participation and your report card:</p>`
      : `<h1 style="font-size:20px;margin:0 0 12px;color:#0a0a0a">Congratulations, ${esc(student.full_name || 'there')}! 🎉</h1>` +
        `<p style="margin:0 0 16px;color:#444">You passed <strong>${esc(course.title)}</strong> with a score of ${Number(score_pct ?? 0)}%.</p>`;

    await sendEmail({
      to: student.email,
      subject: breakdown
        ? `Your ${org.org_name} Certificate of ${certType} - ${course.title}`
        : `Your ${org.org_name} certificate - ${course.title}`,
      html: emailShell(
        intro +
          marksTable +
          notCleared +
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
