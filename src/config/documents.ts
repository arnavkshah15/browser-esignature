import { PresetDocument } from '../types';

/**
 * Registry of dedicated document pages.
 *
 * To add a new PDF with its own dedicated signing page:
 * 1. Put the PDF file in `public/docs/<your-file>.pdf`
 * 2. Add an entry below with a unique `slug` and `fileUrl: './docs/<your-file>.pdf'`
 * 3. Its dedicated page will automatically be live at `/#/doc/<slug>`
 */
export const PRESET_DOCUMENTS: PresetDocument[] = [
  {
    slug: 'sample-agreement',
    title: 'Sample Service Agreement',
    description:
      'Example pre-loaded PDF document. Review the terms below, tap to place your signature, and download the signed copy.',
    fileUrl: './docs/sample-agreement.pdf',
    category: 'Example',
  },
];
