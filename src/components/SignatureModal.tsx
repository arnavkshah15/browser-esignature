import React, { useEffect, useRef, useState } from 'react';
import { Eraser, PenTool, Type, Upload, X, Check } from 'lucide-react';

interface SignatureModalProps {
  mode: 'signature' | 'initials';
  onClose: () => void;
  onSave: (dataUrl: string) => void;
}

type Tab = 'draw' | 'type' | 'upload';

const COLORS = [
  { label: 'Black', value: '#0f172a' },
  { label: 'Navy', value: '#1e3a8a' },
  { label: 'Blue', value: '#2563eb' },
];

const FONTS = [
  { label: 'Dancing Script', family: "'Dancing Script', cursive" },
  { label: 'Caveat', family: "'Caveat', cursive" },
  { label: 'Great Vibes', family: "'Great Vibes', cursive" },
];

function trimCanvas(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');

  const { width, height } = canvas;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let hasPixels = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 10) {
        hasPixels = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasPixels) return '';

  const pad = 16;
  const sx = Math.max(0, minX - pad);
  const sy = Math.max(0, minY - pad);
  const sw = Math.min(width - sx, maxX - minX + pad * 2);
  const sh = Math.min(height - sy, maxY - minY + pad * 2);

  const trimmed = document.createElement('canvas');
  trimmed.width = sw;
  trimmed.height = sh;
  const tCtx = trimmed.getContext('2d');
  if (tCtx) {
    tCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  }
  return trimmed.toDataURL('image/png');
}

export const SignatureModal: React.FC<SignatureModalProps> = ({ mode, onClose, onSave }) => {
  const [tab, setTab] = useState<Tab>('draw');
  const [color, setColor] = useState(COLORS[0].value);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Typed state
  const [typedName, setTypedName] = useState('');
  const [selectedFont, setSelectedFont] = useState(FONTS[0].family);

  // Uploaded state
  const [uploadedUrl, setUploadedUrl] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (tab !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = mode === 'initials' ? 3 : 2.8;
      ctx.strokeStyle = color;
    }
    setHasDrawn(false);
  }, [tab, mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = color;
    }
  }, [color]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const pt = getPoint(e);
    lastPointRef.current = pt;

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x + 0.01, pt.y + 0.01);
      ctx.stroke();
      setHasDrawn(true);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !lastPointRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const pt = getPoint(e);
    const midX = (lastPointRef.current.x + pt.x) / 2;
    const midY = (lastPointRef.current.y + pt.y) / 2;

    ctx.quadraticCurveTo(lastPointRef.current.x, lastPointRef.current.y, midX, midY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(midX, midY);

    lastPointRef.current = pt;
    setHasDrawn(true);
  };

  const handlePointerUp = () => {
    drawingRef.current = false;
    lastPointRef.current = null;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setUploadedUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = () => {
    if (tab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const trimmed = trimCanvas(canvas);
      if (trimmed) onSave(trimmed);
      return;
    }

    if (tab === 'type') {
      const text = typedName.trim();
      if (!text) return;
      const canvas = document.createElement('canvas');
      canvas.width = 700;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = color;
        ctx.font = `600 84px ${selectedFont}`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
      }
      const trimmed = trimCanvas(canvas);
      if (trimmed) onSave(trimmed);
      return;
    }

    if (tab === 'upload' && uploadedUrl) {
      // Normalize uploaded image to PNG via canvas so pdf-lib embedPng always works
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        onSave(canvas.toDataURL('image/png'));
      };
      img.src = uploadedUrl;
    }
  };

  const canSave =
    (tab === 'draw' && hasDrawn) ||
    (tab === 'type' && typedName.trim().length > 0) ||
    (tab === 'upload' && Boolean(uploadedUrl));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{mode === 'initials' ? 'Create Initials' : 'Create Signature'}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="tabs">
          <button
            className={`tab-btn ${tab === 'draw' ? 'active' : ''}`}
            onClick={() => setTab('draw')}
            type="button"
          >
            <PenTool size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />
            Draw
          </button>
          <button
            className={`tab-btn ${tab === 'type' ? 'active' : ''}`}
            onClick={() => setTab('type')}
            type="button"
          >
            <Type size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />
            Type
          </button>
          <button
            className={`tab-btn ${tab === 'upload' ? 'active' : ''}`}
            onClick={() => setTab('upload')}
            type="button"
          >
            <Upload size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />
            Upload
          </button>
        </div>

        {tab === 'draw' && (
          <div>
            <div className="sig-pad-wrap">
              <canvas
                ref={canvasRef}
                className="sig-pad-canvas"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
              <div className="sig-pad-guide" />
            </div>
            <div className="color-row">
              <div className="color-dots">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    aria-label={c.label}
                    className={`color-dot ${color === c.value ? 'active' : ''}`}
                    style={{ background: c.value }}
                    onClick={() => setColor(c.value)}
                  />
                ))}
              </div>
              <button type="button" className="btn btn-secondary" onClick={handleClear}>
                <Eraser size={15} />
                Clear
              </button>
            </div>
          </div>
        )}

        {tab === 'type' && (
          <div>
            <input
              type="text"
              className="text-input"
              placeholder={mode === 'initials' ? 'Type your initials (e.g. A.S.)' : 'Type your full name'}
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              autoFocus
            />
            {FONTS.map((f) => (
              <button
                key={f.label}
                type="button"
                className={`font-option ${selectedFont === f.family ? 'active' : ''}`}
                style={{ fontFamily: f.family, color }}
                onClick={() => setSelectedFont(f.family)}
              >
                <span>{typedName.trim() || (mode === 'initials' ? 'A.S.' : 'Your Signature')}</span>
              </button>
            ))}
            <div className="color-row">
              <div className="color-dots">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    aria-label={c.label}
                    className={`color-dot ${color === c.value ? 'active' : ''}`}
                    style={{ background: c.value }}
                    onClick={() => setColor(c.value)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'upload' && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              <Upload size={16} />
              Choose Signature Image (PNG / JPG)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>
            {uploadedUrl && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 8 }}>
                <img
                  src={uploadedUrl}
                  alt="Uploaded signature preview"
                  style={{ maxHeight: 120, maxWidth: '100%', objectFit: 'contain' }}
                />
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canSave}
            onClick={handleConfirm}
          >
            <Check size={16} />
            Use {mode === 'initials' ? 'Initials' : 'Signature'}
          </button>
        </div>
      </div>
    </div>
  );
};
