import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { DocumentPlacement } from '../types';

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return rgb(0.06, 0.09, 0.16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return rgb(r, g, b);
}

export async function exportSignedPdf(
  originalPdfBytes: Uint8Array,
  placements: DocumentPlacement[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const item of placements) {
    const page = pages[item.pageIndex];
    if (!page) continue;

    const { width: pageWidth, height: pageHeight } = page.getSize();
    const boxWidth = item.widthPct * pageWidth;
    const boxHeight = item.heightPct * pageHeight;
    const x = item.xPct * pageWidth;
    // PDF coordinate origin is bottom-left; UI origin is top-left
    const y = pageHeight - (item.yPct * pageHeight + boxHeight);

    if ((item.type === 'signature' || item.type === 'initials') && item.dataUrl) {
      const pngImage = await pdfDoc.embedPng(item.dataUrl);
      const scale = Math.min(boxWidth / pngImage.width, boxHeight / pngImage.height);
      const drawW = pngImage.width * scale;
      const drawH = pngImage.height * scale;
      const offsetX = (boxWidth - drawW) / 2;
      const offsetY = (boxHeight - drawH) / 2;

      page.drawImage(pngImage, {
        x: x + offsetX,
        y: y + offsetY,
        width: drawW,
        height: drawH,
      });
    } else if ((item.type === 'date' || item.type === 'text') && item.text) {
      const fontSize = Math.max(9, Math.min(24, boxHeight * 0.55));
      page.drawText(item.text, {
        x: x + 4,
        y: y + (boxHeight - fontSize) / 2 + 2,
        size: fontSize,
        font: helvetica,
        color: hexToRgb(item.color || '#0f172a'),
      });
    }
  }

  return await pdfDoc.save();
}

export function downloadPdfBytes(bytes: Uint8Array, fileName: string): void {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.startsWith('signed-') ? fileName : `signed-${fileName}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
