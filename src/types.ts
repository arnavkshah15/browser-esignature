export interface PresetDocument {
  /** URL-safe slug used in /#/doc/<slug> */
  slug: string;
  /** Display title shown on the page header & directory */
  title: string;
  /** Short description of the document */
  description: string;
  /** Relative path to the PDF in public/ (e.g. './docs/sample-agreement.pdf') */
  fileUrl: string;
  /** Optional category badge */
  category?: string;
}

export type PlacementType = 'signature' | 'initials' | 'date' | 'text';

export interface DocumentPlacement {
  id: string;
  type: PlacementType;
  /** 0-based page index */
  pageIndex: number;
  /** Normalized coordinates (0..1) relative to page width/height */
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  /** PNG data URL for signature / initials */
  dataUrl?: string;
  /** Text content for date / text */
  text?: string;
  /** Hex color for text */
  color?: string;
}

export interface PendingPlacement {
  type: PlacementType;
  dataUrl?: string;
  text?: string;
  color?: string;
  defaultWidthPct: number;
  defaultHeightPct: number;
}
