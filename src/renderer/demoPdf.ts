// Tiny one-page PDF generator for demo attachments (e.g. "Uni lecture notes").
// Plain ASCII text only — enough to show that documents are attached to entries.

const escape = (text: string) =>
  text
    .replace(/[^\x20-\x7e]/g, (c) => (c === '—' || c === '–' ? '-' : '?'))
    .replace(/[\\()]/g, (c) => `\\${c}`);

export function makeDemoPdf(title: string, lines: string[]): Blob {
  const content = [
    'BT /F2 20 Tf 56 770 Td',
    `(${escape(title)}) Tj ET`,
    'BT /F1 12 Tf 56 735 Td 18 TL',
    ...lines.map((line, i) => `(${escape(line)}) ${i === 0 ? 'Tj' : "'"}`),
    'ET',
    'BT /F1 9 Tf 56 60 Td (Demo document created by Canopy) Tj ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)
    .join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([pdf], { type: 'application/pdf' });
}
