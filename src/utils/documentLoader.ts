import { renderAsync } from 'docx-preview';
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

async function docxToPdfBytes(arrayBuffer: ArrayBuffer): Promise<Uint8Array> {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = '1200px';
  host.style.background = '#ffffff';
  document.body.appendChild(host);

  try {
    await renderAsync(arrayBuffer, host, undefined, {
      className: 'docx',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      useBase64URL: true,
    });

    // Wait a tick for embedded images/fonts to finish layout
    await new Promise((r) => setTimeout(r, 150));

    const sections = Array.from(host.querySelectorAll('section.docx')) as HTMLElement[];
    const targets = sections.length > 0 ? sections : [host];

    let pdf: jsPDF | null = null;

    for (let i = 0; i < targets.length; i++) {
      const el = targets[i];
      // Remove box-shadow from docx-preview wrapper so it doesn't show in PDF
      el.style.boxShadow = 'none';
      el.style.margin = '0';

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      // Convert px (96 DPI) to PDF points (72 DPI)
      const ptWidth = (el.offsetWidth || 794) * 0.75;
      const ptHeight = (canvas.height * ptWidth) / canvas.width;
      const orientation = ptWidth > ptHeight ? 'landscape' : 'portrait';

      if (!pdf) {
        pdf = new jsPDF({
          unit: 'pt',
          format: [ptWidth, ptHeight],
          orientation,
        });
      } else {
        pdf.addPage([ptWidth, ptHeight], orientation);
      }

      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, ptWidth, ptHeight);
    }

    if (!pdf) {
      throw new Error('Could not render Word document.');
    }

    return new Uint8Array(pdf.output('arraybuffer'));
  } finally {
    document.body.removeChild(host);
  }
}

async function htmlToPdfBytes(htmlContent: string): Promise<Uint8Array> {
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
  container.innerHTML = htmlContent;
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

    return new Uint8Array(pdf.output('arraybuffer'));
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
    const bytes = await docxToPdfBytes(buf);
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
      .map((line) => `<p style="margin:0 0 8px;">${escapeHtml(line) || '&nbsp;'}</p>`)
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
