import { PDFDocument, StandardFonts } from "pdf-lib";
export async function pdfFixture(
  text = "Built React applications with TypeScript and PostgreSQL.",
) {
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText(text, { x: 50, y: 700, size: 12, font });
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}
