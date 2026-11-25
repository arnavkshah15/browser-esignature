# SignFlow — Browser eSignature

A mobile-friendly, 100% client-side e-signature web app built for **GitHub Pages**.

## Features
- **Upload & Sign**: Supports `.pdf`, `.docx` (Word), `.txt`, `.png`, and `.jpg` directly in the browser.
- **Mobile-First Signing**: Smooth touch/stylus signature pad, typed handwriting fonts, or image upload. Tap anywhere on the document to place, drag to reposition, and resize with touch-friendly handles.
- **Dedicated Document Pages**: Each pre-configured PDF gets its own shareable URL (`/#/doc/<slug>`).
- **100% Private**: All rendering and PDF embedding (`pdfjs-dist` + `pdf-lib`) happens locally in the user's browser.

## Adding Dedicated Pages for New PDFs
1. Place your PDF file in `public/docs/` (for example, `public/docs/nda.pdf`).
2. Add an entry to `PRESET_DOCUMENTS` in [`src/config/documents.ts`](src/config/documents.ts):
   ```ts
   {
     slug: 'nda',
     title: 'Non-Disclosure Agreement',
     description: 'Please review and sign the NDA.',
     fileUrl: './docs/nda.pdf',
     category: 'Legal',
   }
   ```
3. Commit and push — your dedicated signing page will be live at:
   `https://<username>.github.io/browser-esignature/#/doc/nda`

## Local Development
```bash
npm install
npm run dev
```

## GitHub Pages Deployment
This repo includes `.github/workflows/deploy.yml`.
In your GitHub repository, go to **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**. Every push to `main` will automatically build and deploy.
