import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PRESET_DOCUMENTS } from '../config/documents';
import { loadPdfBytesFromUrl } from '../utils/documentLoader';
import { PdfSigner } from '../components/PdfSigner';

export const PresetDocPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const doc = PRESET_DOCUMENTS.find((d) => d.slug === slug);

  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!doc) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    loadPdfBytesFromUrl(doc.fileUrl)
      .then((bytes) => {
        if (!cancelled) {
          setPdfBytes(bytes);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load document.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [doc]);

  if (!doc) {
    return (
      <div className="page-container">
        <div className="alert-error">
          Document &ldquo;{slug}&rdquo; was not found.
        </div>
        <div style={{ marginTop: '1rem' }}>
          <Link to="/" className="btn btn-primary">
            Go to Upload Page
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <div className="spinner" style={{ margin: '0 auto 0.75rem' }} />
        <p style={{ color: 'var(--text-muted)' }}>Loading {doc.title}...</p>
      </div>
    );
  }

  if (error || !pdfBytes) {
    return (
      <div className="page-container">
        <div className="alert-error">{error || 'Unable to load document.'}</div>
        <div style={{ marginTop: '1rem' }}>
          <Link to="/" className="btn btn-secondary">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PdfSigner
      pdfBytes={pdfBytes}
      fileName={`${doc.slug}.pdf`}
      title={doc.title}
      onBack={() => navigate('/')}
      backLabel="All Documents"
    />
  );
};
