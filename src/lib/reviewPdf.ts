export interface ReviewPdfItem {
  prompt: string;
  your_answers: string[];
  correct_answers: string[];
  explanation: string;
}

export interface ReviewPdfInput {
  studentName: string;
  courseTitle: string;
  /** e.g. "Score 62% - 31/50 correct" */
  summary: string;
  items: ReviewPdfItem[];
}

// The built-in PDF fonts only cover Latin text. Dashes and curly quotes become their plain look-alikes first
// so questions stay readable; anything else outside Latin-1 becomes "?".
const safe = (v: unknown) =>
  String(v ?? '')
    .replace(/₹/g, 'Rs. ')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\u0000-ÿ]/g, '?');

/** A study sheet of the questions a student got wrong, with the correct answer and the explanation. Built in the browser. */
export async function downloadReviewPdf(input: ReviewPdfInput) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 16;
  const textW = W - margin * 2;
  let y = margin;

  const ensure = (needed: number) => {
    if (y + needed > H - 14) {
      doc.addPage();
      y = margin;
    }
  };

  // Writes wrapped text, breaking across pages line by line so a long explanation never runs off the sheet.
  const para = (text: string, size: number, style: 'normal' | 'bold', color: [number, number, number], indent = 0, gap = 1.2) => {
    doc.setFont('helvetica', style).setFontSize(size).setTextColor(...color);
    const lineH = size * 0.42 + 1.1;
    for (const line of doc.splitTextToSize(safe(text), textW - indent) as string[]) {
      ensure(lineH);
      doc.text(line, margin + indent, y);
      y += lineH;
    }
    y += gap;
  };

  para('Exam review - questions to revisit', 17, 'bold', [20, 20, 20], 0, 0.5);
  para(input.courseTitle, 11, 'normal', [70, 70, 70], 0, 0);
  para(`${input.studentName}  ·  ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, 9, 'normal', [120, 120, 120], 0, 0);
  para(input.summary, 10, 'bold', [40, 40, 40], 0, 3);

  doc.setDrawColor(210).line(margin, y, W - margin, y);
  y += 5;

  input.items.forEach((r, i) => {
    ensure(34);
    para(`Question ${i + 1}`, 8, 'bold', [140, 140, 140], 0, 0.2);
    para(r.prompt, 11, 'bold', [20, 20, 20], 0, 1.6);
    para('Your answer', 8, 'bold', [185, 28, 28], 3, 0);
    para(r.your_answers.length ? r.your_answers.join(', ') : 'Not answered', 10, 'normal', [120, 30, 30], 3, 1.4);
    para('Correct answer', 8, 'bold', [21, 128, 61], 3, 0);
    para(r.correct_answers.join(', '), 10, 'bold', [21, 100, 50], 3, 1.4);
    if (r.explanation) {
      para('Why - explanation and example', 8, 'bold', [29, 78, 216], 3, 0);
      para(r.explanation, 10, 'normal', [60, 60, 60], 3, 1.4);
    }
    y += 2;
    doc.setDrawColor(230).line(margin, y, W - margin, y);
    y += 5;
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(150);
    doc.text(safe(`EgireRobotics · ${input.courseTitle}`), margin, H - 8);
    doc.text(`Page ${p} of ${pages}`, W - margin, H - 8, { align: 'right' });
  }

  const file = `exam-review-${safe(input.courseTitle).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'course'}.pdf`;
  doc.save(file);
}
