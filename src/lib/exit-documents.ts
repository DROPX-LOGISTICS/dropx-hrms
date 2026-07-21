import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";

export type ExitDocumentValues = Record<string, string>;

export function fillExitTemplate(template: string, values: ExitDocumentValues) {
  return template.replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (_, key: string) => values[key] ?? "");
}

function wrapLine(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (!text) return [""];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) current = candidate;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines;
}

export async function createExitPdf(input: {
  title: string;
  body: string;
  companyName: string;
  registeredAddress?: string | null;
  footerText?: string | null;
  signatoryName?: string | null;
  signatoryTitle?: string | null;
}) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = 595.28;
  const height = 841.89;
  const margin = 58;
  let page = pdf.addPage([width, height]);
  let y = height - 62;

  const header = () => {
    page.drawRectangle({ x: 0, y: height - 12, width, height: 12, color: rgb(0.82, 0.12, 0.21) });
    page.drawText(input.companyName, { x: margin, y, size: 18, font: bold, color: rgb(0.13, 0.13, 0.13) });
    y -= 18;
    if (input.registeredAddress) {
      for (const line of wrapLine(input.registeredAddress, regular, 8.5, width - margin * 2)) {
        page.drawText(line, { x: margin, y, size: 8.5, font: regular, color: rgb(0.42, 0.42, 0.42) });
        y -= 11;
      }
    }
    y -= 9;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
    y -= 34;
  };
  const newPage = () => { page = pdf.addPage([width, height]); y = height - 62; header(); };
  header();
  const titleWidth = bold.widthOfTextAtSize(input.title, 16);
  page.drawText(input.title, { x: Math.max(margin, (width - titleWidth) / 2), y, size: 16, font: bold, color: rgb(0.82, 0.12, 0.21) });
  y -= 38;

  for (const paragraph of input.body.replace(/\r/g, "").split("\n")) {
    const lines = wrapLine(paragraph, regular, 10.5, width - margin * 2);
    for (const line of lines) {
      if (y < 118) newPage();
      page.drawText(line, { x: margin, y, size: 10.5, font: regular, color: rgb(0.15, 0.15, 0.15) });
      y -= 16;
    }
    y -= 6;
  }
  if (input.signatoryName || input.signatoryTitle) {
    if (y < 145) newPage();
    y -= 26;
    page.drawText(input.signatoryName || "Authorised signatory", { x: margin, y, size: 10.5, font: bold });
    y -= 15;
    if (input.signatoryTitle) page.drawText(input.signatoryTitle, { x: margin, y, size: 9.5, font: regular, color: rgb(0.35, 0.35, 0.35) });
  }
  const pages = pdf.getPages();
  pages.forEach((item, index) => {
    item.drawLine({ start: { x: margin, y: 52 }, end: { x: width - margin, y: 52 }, thickness: .6, color: rgb(0.88, 0.88, 0.88) });
    const footer = input.footerText || "System-generated document from DropX People";
    item.drawText(footer, { x: margin, y: 36, size: 7.5, font: regular, color: rgb(0.48, 0.48, 0.48), maxWidth: width - margin * 2 - 42 });
    item.drawText(`${index + 1}/${pages.length}`, { x: width - margin - 25, y: 36, size: 7.5, font: regular, color: rgb(0.48, 0.48, 0.48) });
  });
  return pdf.save();
}
