import mammoth from 'mammoth';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';

export interface LoadedDocument {
  bytes: Uint8Array;
  fileName: string;
  sourceType: 'pdf' | 'docx' | 'image' | 'text';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function htmlToPdfBytes(htmlContent: string): Promise<Uint8Array> {
  // Render off-screen at A4 width (794px at 96 DPI) for clean, consistent pagination
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.padding = '56px 64px';
  container.style.background = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = "'Inter', Arial, sans-serif";
  container.style.fontSize = '14px';
  container.style.lineHeight = '1.6';
  container.innerHTML = `
    <style>
      .docx-render h1 { font-size: 22px; margin: 0 0 12px; }
      .docx-render h2 { font-size: 18px; margin: 18px 0 8px; }
      .docx-render h3 { font-size: 15px; margin: 14px 0 6px; }
      .docx-render p { margin: 0 0 10px; }
      .docx-render table { border-collapse: collapse; width: 100%; margin: 12px 0; }
      .docx-render td, .docx-render th { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
      .docx-render ul, .docx-render ol { margin: 0 0 10px; padding-left: 22px; }
    </style>
    <div class="docx-render">${htmlContent}</div>
  `;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const totalImgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = totalImgHeight;
    let position = 0;
    const imgData = canvas.toDataURL('image/png');

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, totalImgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 1) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, totalImgHeight);
      heightLeft -= pageHeight;
    }

    const arrayBuffer = pdf.output('arraybuffer');
    return new Uint8Array(arrayBuffer);
  } finally {
    document.body.removeChild(container);
  }
}

export async function loadPdfBytesFromFile(file: File): Promise<LoadedDocument> {
  const lower = file.name.toLowerCase();
  const baseName = file.name.replace(/\.[^/.]+$/, '');

  if (lower.endsWith('.pdf')) {
    const buf = await file.arrayBuffer();
    return {
      bytes: new Uint8Array(buf),
      fileName: `${baseName}.pdf`,
      sourceType: 'pdf',
    };
  }

  if (lower.endsWith('.docx')) {
    const buf = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer: buf });
    const bytes = await htmlToPdfBytes(result.value || '<p>(Empty document)</p>');
    return {
      bytes,
      fileName: `${baseName}.pdf`,
      sourceType: 'docx',
    };
  }

  if (lower.endsWith('.doc')) {
    throw new Error(
      'Legacy binary .doc files cannot be converted in the browser. Please save as .docx or .pdf and upload again.'
    );
  }

  if (lower.endsWith('.txt')) {
    const text = await file.text();
    const html = text
      .split(/\r?\n/)
      .map((line) => `<p>${escapeHtml(line) || '&nbsp;'}</p>`)
      .join('');
    const bytes = await htmlToPdfBytes(html);
    return {
      bytes,
      fileName: `${baseName}.pdf`,
      sourceType: 'text',
    };
  }

  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    const buf = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.create();
    const image = lower.endsWith('.png')
      ? await pdfDoc.embedPng(buf)
      : await pdfDoc.embedJpg(buf);
    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    const bytes = await pdfDoc.save();
    return {
      bytes,
      fileName: `${baseName}.pdf`,
      sourceType: 'image',
    };
  }

  throw new Error('Unsupported file format. Please upload a PDF, DOCX, TXT, PNG, or JPG file.');
}

export async function loadPdfBytesFromUrl(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not load document (${res.status} ${res.statusText}).`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}
