import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  Calendar,
  Download,
  PenTool,
  Type,
  ZoomIn,
  ZoomOut,
  X,
  ArrowLeft,
  Maximize2,
  FileSignature,
} from 'lucide-react';
import { DocumentPlacement, PendingPlacement } from '../types';
import { SignatureModal } from './SignatureModal';
import { exportSignedPdf, downloadPdfBytes } from '../utils/pdfExporter';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfSignerProps {
  pdfBytes: Uint8Array;
  fileName: string;
  title?: string;
  onBack?: () => void;
  backLabel?: string;
}

interface PageMeta {
  pageIndex: number;
  width: number;
  height: number;
}

export const PdfSigner: React.FC<PdfSignerProps> = ({
  pdfBytes,
  fileName,
  title,
  onBack,
  backLabel = 'Back',
}) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pagesMeta, setPagesMeta] = useState<PageMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [zoom, setZoom] = useState<number>(1);
  const [baseWidth, setBaseWidth] = useState<number>(720);

  const [placements, setPlacements] = useState<DocumentPlacement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPlacement | null>(null);

  const [sigModalMode, setSigModalMode] = useState<'signature' | 'initials' | null>(null);
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const [exporting, setExporting] = useState(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Compute responsive base width on mount/resize
  useEffect(() => {
    const updateWidth = () => {
      const vw = viewportRef.current?.clientWidth || window.innerWidth;
      const target = Math.max(280, Math.min(820, vw - 24));
      setBaseWidth(target);
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Load PDF document via pdfjs
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPlacements([]);
    setSelectedId(null);
    setPending(null);

    const load = async () => {
      try {
        // Pass a copy so pdfjs worker doesn't detach the original Uint8Array needed by pdf-lib
        const copy = new Uint8Array(pdfBytes);
        const loadingTask = pdfjsLib.getDocument({ data: copy });
        const doc = await loadingTask.promise;
        if (cancelled) return;

        const metas: PageMeta[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const vp = page.getViewport({ scale: 1 });
          metas.push({ pageIndex: i - 1, width: vp.width, height: vp.height });
        }
        if (cancelled) return;

        setPdfDoc(doc);
        setPagesMeta(metas);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render PDF.');
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [pdfBytes]);

  // Render each page onto its canvas when doc, baseWidth, or zoom changes
  useEffect(() => {
    if (!pdfDoc || pagesMeta.length === 0) return;
    let cancelled = false;

    const renderPages = async () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (const meta of pagesMeta) {
        if (cancelled) return;
        const canvas = canvasRefs.current.get(meta.pageIndex);
        if (!canvas) continue;

        const page = await pdfDoc.getPage(meta.pageIndex + 1);
        const displayWidth = baseWidth * zoom;
        const scale = displayWidth / meta.width;
        const viewport = page.getViewport({ scale });

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        await page.render({
          canvasContext: ctx,
          viewport,
          annotationMode: pdfjsLib.AnnotationMode.ENABLE_STORAGE,
        }).promise;
      }
    };

    renderPages();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pagesMeta, baseWidth, zoom]);

  const handlePageTap = (pageIndex: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (!pending) {
      setSelectedId(null);
      return;
    }

    const pageEl = pageRefs.current.get(pageIndex);
    if (!pageEl) return;
    const rect = pageEl.getBoundingClientRect();

    const clickXPct = (e.clientX - rect.left) / rect.width;
    const clickYPct = (e.clientY - rect.top) / rect.height;

    const w = pending.defaultWidthPct;
    const h = pending.defaultHeightPct;
    const xPct = Math.max(0.01, Math.min(1 - w - 0.01, clickXPct - w / 2));
    const yPct = Math.max(0.01, Math.min(1 - h - 0.01, clickYPct - h / 2));

    const newItem: DocumentPlacement = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: pending.type,
      pageIndex,
      xPct,
      yPct,
      widthPct: w,
      heightPct: h,
      dataUrl: pending.dataUrl,
      text: pending.text,
      color: pending.color,
    };

    setPlacements((prev) => [...prev, newItem]);
    setSelectedId(newItem.id);
    setPending(null);
  };

  const startDrag = useCallback(
    (id: string, pageIndex: number, e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      setSelectedId(id);

      const pageEl = pageRefs.current.get(pageIndex);
      if (!pageEl) return;
      const pageRect = pageEl.getBoundingClientRect();

      const item = placements.find((p) => p.id === id);
      if (!item) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const origX = item.xPct;
      const origY = item.yPct;

      const onMove = (ev: PointerEvent) => {
        const dxPct = (ev.clientX - startX) / pageRect.width;
        const dyPct = (ev.clientY - startY) / pageRect.height;

        setPlacements((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  xPct: Math.max(0, Math.min(1 - p.widthPct, origX + dxPct)),
                  yPct: Math.max(0, Math.min(1 - p.heightPct, origY + dyPct)),
                }
              : p
          )
        );
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [placements]
  );

  const startResize = useCallback(
    (id: string, pageIndex: number, e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const pageEl = pageRefs.current.get(pageIndex);
      if (!pageEl) return;
      const pageRect = pageEl.getBoundingClientRect();

      const item = placements.find((p) => p.id === id);
      if (!item) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const origW = item.widthPct;
      const origH = item.heightPct;

      const onMove = (ev: PointerEvent) => {
        const dwPct = (ev.clientX - startX) / pageRect.width;
        const dhPct = (ev.clientY - startY) / pageRect.height;

        setPlacements((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  widthPct: Math.max(0.08, Math.min(1 - p.xPct, origW + dwPct)),
                  heightPct: Math.max(0.03, Math.min(1 - p.yPct, origH + dhPct)),
                }
              : p
          )
        );
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [placements]
  );

  const handleDeletePlacement = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPlacements((prev) => prev.filter((p) => p.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleSaveSignature = (dataUrl: string) => {
    const mode = sigModalMode || 'signature';
    setSigModalMode(null);
    setPending({
      type: mode,
      dataUrl,
      defaultWidthPct: mode === 'initials' ? 0.14 : 0.28,
      defaultHeightPct: mode === 'initials' ? 0.065 : 0.09,
    });
  };

  const handleAddDate = () => {
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    setPending({
      type: 'date',
      text: today,
      color: '#0f172a',
      defaultWidthPct: 0.2,
      defaultHeightPct: 0.04,
    });
  };

  const handleAddTextConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const val = customText.trim();
    if (!val) return;
    setTextModalOpen(false);
    setCustomText('');
    setPending({
      type: 'text',
      text: val,
      color: '#0f172a',
      defaultWidthPct: Math.min(0.45, Math.max(0.18, val.length * 0.015)),
      defaultHeightPct: 0.04,
    });
  };

  const handleDownload = async () => {
    setExporting(true);
    try {
      const signedBytes = await exportSignedPdf(pdfBytes, placements);
      downloadPdfBytes(signedBytes, fileName);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not export signed PDF.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="signer-shell">
      <div className="signer-topbar">
        <div className="signer-doc-meta">
          {onBack && (
            <button type="button" className="btn btn-secondary btn-icon" onClick={onBack} title={backLabel}>
              <ArrowLeft size={18} />
            </button>
          )}
          <span className="signer-doc-title">{title || fileName}</span>
          {pagesMeta.length > 0 && (
            <span className="badge hide-mobile">{pagesMeta.length} {pagesMeta.length === 1 ? 'page' : 'pages'}</span>
          )}
        </div>

        <div className="signer-controls">
          <div className="zoom-pill">
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
              aria-label="Zoom out"
            >
              <ZoomOut size={16} />
            </button>
            <span className="zoom-label">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={() => setZoom((z) => Math.min(2.2, +(z + 0.15).toFixed(2)))}
              aria-label="Zoom in"
            >
              <ZoomIn size={16} />
            </button>
          </div>
          <button
            type="button"
            className="btn btn-primary hide-mobile"
            disabled={loading || exporting}
            onClick={handleDownload}
          >
            <Download size={16} />
            {exporting ? 'Preparing...' : 'Download Signed PDF'}
          </button>
        </div>
      </div>

      {pending && (
        <div className="placement-banner">
          <span>
            Tap anywhere on the document to place your{' '}
            <strong>{pending.type}</strong>
          </span>
          <button type="button" onClick={() => setPending(null)}>
            Cancel
          </button>
        </div>
      )}

      <div className="pdf-viewport" ref={viewportRef}>
        {loading && (
          <div style={{ padding: '4rem 1rem', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 0.75rem' }} />
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading document...</div>
          </div>
        )}

        {error && <div className="alert-error">{error}</div>}

        {!loading &&
          !error &&
          pagesMeta.map((meta) => {
            const pageWidth = baseWidth * zoom;
            const pageHeight = (pageWidth * meta.height) / meta.width;
            const pagePlacements = placements.filter((p) => p.pageIndex === meta.pageIndex);

            return (
              <div
                key={meta.pageIndex}
                ref={(el) => {
                  if (el) pageRefs.current.set(meta.pageIndex, el);
                  else pageRefs.current.delete(meta.pageIndex);
                }}
                className={`pdf-page-wrapper ${pending ? 'placing' : ''}`}
                style={{ width: pageWidth, height: pageHeight }}
                onClick={(e) => handlePageTap(meta.pageIndex, e)}
              >
                <canvas
                  ref={(el) => {
                    if (el) canvasRefs.current.set(meta.pageIndex, el);
                    else canvasRefs.current.delete(meta.pageIndex);
                  }}
                  className="pdf-page-canvas"
                />

                <span className="page-number-tag">
                  {meta.pageIndex + 1} / {pagesMeta.length}
                </span>

                {pagePlacements.map((item) => {
                  const isSelected = selectedId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`placed-item ${isSelected ? 'selected' : ''}`}
                      style={{
                        left: `${item.xPct * 100}%`,
                        top: `${item.yPct * 100}%`,
                        width: `${item.widthPct * 100}%`,
                        height: `${item.heightPct * 100}%`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(item.id);
                      }}
                      onPointerDown={(e) => startDrag(item.id, meta.pageIndex, e)}
                    >
                      {(item.type === 'signature' || item.type === 'initials') && item.dataUrl && (
                        <img src={item.dataUrl} alt={item.type} />
                      )}

                      {(item.type === 'date' || item.type === 'text') && (
                        <div
                          className="placed-text-box"
                          style={{
                            color: item.color || '#0f172a',
                            fontSize: `${Math.max(10, Math.min(22, pageHeight * item.heightPct * 0.55))}px`,
                          }}
                        >
                          {item.text}
                        </div>
                      )}

                      {isSelected && (
                        <>
                          <button
                            type="button"
                            className="placed-delete-btn"
                            aria-label="Remove item"
                            onClick={(e) => handleDeletePlacement(item.id, e)}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            <X size={14} />
                          </button>
                          <div
                            className="placed-resize-handle"
                            aria-label="Resize item"
                            onPointerDown={(e) => startResize(item.id, meta.pageIndex, e)}
                          >
                            <Maximize2 size={11} />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="bottom-toolbar">
        <div className="bottom-toolbar-inner">
          <button
            type="button"
            className="tool-btn"
            onClick={() => setSigModalMode('signature')}
            disabled={loading}
          >
            <PenTool size={19} />
            <span>Sign</span>
          </button>

          <button
            type="button"
            className="tool-btn"
            onClick={() => setSigModalMode('initials')}
            disabled={loading}
          >
            <FileSignature size={19} />
            <span>Initials</span>
          </button>

          <button type="button" className="tool-btn" onClick={handleAddDate} disabled={loading}>
            <Calendar size={19} />
            <span>Date</span>
          </button>

          <button
            type="button"
            className="tool-btn"
            onClick={() => setTextModalOpen(true)}
            disabled={loading}
          >
            <Type size={19} />
            <span>Text</span>
          </button>

          <button
            type="button"
            className="tool-btn primary-action"
            onClick={handleDownload}
            disabled={loading || exporting}
          >
            <Download size={19} />
            <span>{exporting ? 'Saving...' : 'Download'}</span>
          </button>
        </div>
      </div>

      {sigModalMode && (
        <SignatureModal
          mode={sigModalMode}
          onClose={() => setSigModalMode(null)}
          onSave={handleSaveSignature}
        />
      )}

      {textModalOpen && (
        <div className="modal-backdrop" onClick={() => setTextModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Text</h3>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setTextModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddTextConfirm}>
              <input
                type="text"
                className="text-input"
                placeholder="Enter name, title, or note..."
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                autoFocus
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setTextModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!customText.trim()}>
                  Place Text
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
