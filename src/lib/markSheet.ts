import { slugify } from './slug';

/**
 * Printable / editable mark sheets for instructors who examine offline (viva, simulation,
 * piloting) and write marks on paper first. The heavy PDF/Excel libraries are loaded only when
 * an export is actually requested, so they never weigh down the rest of the app.
 */
export type SheetPart = 'viva' | 'simulation' | 'piloting' | 'all';
export type SheetFormat = 'xlsx' | 'pdf';

export interface SheetStudent {
  name: string;
  email: string;
  viva?: number;
  simulation?: number;
  piloting?: number;
  online?: number;
}

export interface SheetOptions {
  course: string;
  part: SheetPart;
  max: { viva: number; simulation: number; piloting: number; online: number };
  /** Fill in marks already entered; otherwise the mark boxes are left blank for handwriting. */
  withMarks: boolean;
  withEmail: boolean;
  students: SheetStudent[];
}

const PART_LABEL: Record<Exclude<SheetPart, 'all'>, string> = { viva: 'Viva', simulation: 'Simulation', piloting: 'Real FPV piloting' };

function layout(o: SheetOptions) {
  const parts = (o.part === 'all' ? ['viva', 'simulation', 'piloting'] : [o.part]) as Exclude<SheetPart, 'all'>[];
  const total = o.part === 'all' ? o.max.viva + o.max.simulation + o.max.piloting + o.max.online : o.max[o.part];
  const title = o.part === 'all' ? `${o.course} — mark sheet` : `${o.course} — ${PART_LABEL[o.part]} mark sheet`;
  const subtitle =
    o.part === 'all'
      ? `Viva ${o.max.viva} · Simulation ${o.max.simulation} · Real piloting ${o.max.piloting} · Online exam ${o.max.online} · Total ${total}`
      : `${PART_LABEL[o.part]} — out of ${total} marks`;
  const headers = [
    'No.',
    'Student',
    ...(o.withEmail ? ['Email'] : []),
    ...parts.map((p) => `${PART_LABEL[p]} (/${o.max[p]})`),
    ...(o.part === 'all' && o.withMarks ? [`Online (/${o.max.online})`, `Total (/${total})`] : []),
    'Remarks',
  ];
  const body = o.students.map((s, i) => {
    const partValues = parts.map((p) => (o.withMarks && s[p] !== undefined ? s[p]! : ''));
    const sum = o.part === 'all' && o.withMarks && s.viva !== undefined && s.simulation !== undefined && s.piloting !== undefined && s.online !== undefined
      ? Math.round((s.viva + s.simulation + s.piloting + s.online) * 100) / 100
      : '';
    return [
      i + 1,
      s.name,
      ...(o.withEmail ? [s.email] : []),
      ...partValues,
      ...(o.part === 'all' && o.withMarks ? [s.online ?? '', sum] : []),
      '',
    ];
  });
  return { parts, total, title, subtitle, headers, body };
}

const stamp = () => new Date().toISOString().slice(0, 10);
const fileBase = (o: SheetOptions) => `${slugify(o.course)}-${o.part === 'all' ? 'all-parts' : o.part}-marksheet-${stamp()}`;

export interface BuiltSheet {
  blob: Blob;
  filename: string;
}

/** Builds the file in memory (separate from downloading so it can be tested). */
export async function buildMarkSheet(format: SheetFormat, o: SheetOptions): Promise<BuiltSheet> {
  return format === 'xlsx' ? buildXlsx(o) : buildPdf(o);
}

export async function exportMarkSheet(format: SheetFormat, o: SheetOptions) {
  const { blob, filename } = await buildMarkSheet(format, o);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function buildXlsx(o: SheetOptions): Promise<BuiltSheet> {
  const { default: writeXlsxFile } = await import('write-excel-file/universal');
  const { title, subtitle, headers, body, parts } = layout(o);
  const border = { borderColor: '#9ca3af', borderStyle: 'thin' as const };
  const nCols = headers.length;
  const filler = (n: number) => Array.from({ length: n }, () => null);

  const sheetData = [
    [{ value: title, fontWeight: 'bold' as const, fontSize: 14, columnSpan: nCols }, ...filler(nCols - 1)],
    [{ value: subtitle, textColor: '#4b5563', columnSpan: nCols }, ...filler(nCols - 1)],
    [{ value: 'Examiner: ______________________      Date: ______________', columnSpan: nCols }, ...filler(nCols - 1)],
    filler(nCols),
    headers.map((h) => ({ value: h, fontWeight: 'bold' as const, backgroundColor: '#1a1a1a', textColor: '#ffffff', align: 'center' as const, alignVertical: 'center' as const, wrap: true, height: 30, ...border })),
    ...body.map((row) =>
      row.map((v, c) => {
        const isMark = c >= (o.withEmail ? 3 : 2) && c < (o.withEmail ? 3 : 2) + parts.length;
        const isNumber = typeof v === 'number';
        return {
          value: v === '' ? null : v,
          type: isNumber ? Number : String,
          align: c === 0 || isMark || (typeof v === 'number' && c > 1) ? ('center' as const) : ('left' as const),
          alignVertical: 'center' as const,
          height: 24,
          wrap: true,
          ...border,
        };
      }),
    ),
  ];

  const widths = [6, 30, ...(o.withEmail ? [34] : []), ...parts.map(() => 16), ...(o.part === 'all' && o.withMarks ? [14, 14] : []), 36];
  const blob = await writeXlsxFile(sheetData as never, {
    sheet: o.part === 'all' ? 'Mark sheet' : PART_LABEL[o.part],
    columns: widths.map((width) => ({ width })),
    stickyRowsCount: 5,
    orientation: nCols > 6 ? 'landscape' : 'portrait',
  } as never).toBlob();
  return { blob, filename: `${fileBase(o)}.xlsx` };
}

async function buildPdf(o: SheetOptions): Promise<BuiltSheet> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const { title, subtitle, headers, body, parts } = layout(o);
  const landscape = headers.length > 6;
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  // The built-in PDF fonts only cover Latin text; Excel keeps every character.
  // Dashes and curly quotes become their plain look-alikes first so titles stay readable.
  const safe = (v: unknown) =>
    String(v)
      .replace(/[–—]/g, '-')
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[^\u0000-ÿ]/g, '?');

  doc.setFont('helvetica', 'bold').setFontSize(15).text(safe(title), 14, 16);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(90).text(safe(subtitle), 14, 22);
  doc.setTextColor(30).text('Examiner: ______________________', 14, 30).text('Date: ______________', w - 14 - 50, 30);

  const markStart = o.withEmail ? 3 : 2;
  // Fixed widths for everything but Remarks, which takes whatever is left: that is the column
  // people actually write in.
  const columnStyles: Record<number, Record<string, unknown>> = {
    0: { cellWidth: 12, halign: 'center' },
    1: { cellWidth: landscape ? 56 : 54 },
  };
  if (o.withEmail) columnStyles[2] = { cellWidth: landscape ? 50 : 44, fontSize: 8.5 };
  parts.forEach((_, i) => (columnStyles[markStart + i] = { cellWidth: landscape ? 25 : 28, halign: 'center' }));
  if (o.part === 'all' && o.withMarks) {
    columnStyles[markStart + parts.length] = { cellWidth: 22, halign: 'center' };
    columnStyles[markStart + parts.length + 1] = { cellWidth: 22, halign: 'center' };
  }

  autoTable(doc, {
    startY: 35,
    head: [headers.map(safe)],
    body: body.map((r) => r.map(safe)),
    theme: 'grid',
    rowPageBreak: 'avoid', // never split a student's row across two pages
    margin: { left: 14, right: 14, bottom: 16 },
    styles: { fontSize: 10, cellPadding: 2.5, minCellHeight: 11, valign: 'middle', lineColor: [150, 150, 150], lineWidth: 0.2, textColor: 30 },
    headStyles: { fillColor: [26, 26, 26], textColor: 255, halign: 'center', fontStyle: 'bold' },
    columnStyles,
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8).setTextColor(130);
    doc.text(safe(`EgireRobotics · ${o.course} · printed ${new Date().toLocaleDateString('en-GB')}`), 14, h - 8);
    doc.text(`Page ${p} of ${pages}`, w - 14, h - 8, { align: 'right' });
  }
  return { blob: doc.output('blob'), filename: `${fileBase(o)}.pdf` };
}
