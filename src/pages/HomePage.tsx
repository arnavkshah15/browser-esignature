import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ShieldCheck, Smartphone, UploadCloud, ArrowRight } from 'lucide-react';
import { PRESET_DOCUMENTS } from '../config/documents';
import { loadPdfBytesFromFile, LoadedDocument } from '../utils/documentLoader';
import { PdfSigner } from '../components/PdfSigner';

export const HomePage: React.FC = () => {
  const [loadedDoc, setLoadedDoc] = useState<LoadedDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const doc = await loadPdfBytesFromFile(file);
      setLoadedDoc(doc);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file.');
    } finally {
      setLoading(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  if (loadedDoc) {
    return (
      <PdfSigner
        pdfBytes={loadedDoc.bytes}
        fileName={loadedDoc.fileName}
        title={loadedDoc.fileName}
        onBack={() => setLoadedDoc(null)}
        backLabel="Upload another document"
      />
    );
  }

  return (
    <div className="page-container">
      <div className="hero">
        <h1>Sign PDFs &amp; Docs in Your Browser</h1>
        <p>
          Upload any PDF or Word (.docx) document, draw or type your signature on mobile or desktop,
          and download the signed PDF instantly. Nothing leaves your device.
        </p>
      </div>

      <div
        className={`upload-dropzone ${dragging ? 'dragging' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={onInputChange}
          style={{ display: 'none' }}
        />

        <div className="upload-icon-wrap">
          {loading ? <div className="spinner" /> : <UploadCloud size={26} />}
        </div>

        <h2>{loading ? 'Preparing document...' : 'Tap or drop a document to sign'}</h2>
        <p>Supports PDF, Word (.docx), TXT, PNG, and JPG</p>

        {!loading && (
          <button type="button" className="btn btn-primary">
            Choose File
          </button>
        )}

        <div className="badge-row">
          <span className="badge">
            <ShieldCheck size={13} /> 100% Private (In-Browser)
          </span>
          <span className="badge">
            <Smartphone size={13} /> Touch &amp; Mobile Friendly
          </span>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {PRESET_DOCUMENTS.length > 0 && (
        <>
          <div className="section-heading">
            <h2>Ready-to-Sign Documents</h2>
            <span className="badge badge-primary">{PRESET_DOCUMENTS.length} available</span>
          </div>

          <div className="docs-grid">
            {PRESET_DOCUMENTS.map((doc) => (
              <div key={doc.slug} className="doc-card">
                <div>
                  <span className="badge">
                    <FileText size={12} /> {doc.category || 'PDF Document'}
                  </span>
                  <h3>{doc.title}</h3>
                  <p>{doc.description}</p>
                </div>
                <Link to={`/doc/${doc.slug}`} className="btn btn-secondary">
                  Open &amp; Sign <ArrowRight size={15} />
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
