import { Severity, Status } from '@prisma/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import type { ReportExportRow } from '../repositories/admin.repo.js';

/** Export column headers — shared by all three formats. */
const COLUMNS = [
  'Reference',
  'Title',
  'Status',
  'Severity',
  'Road Name',
  'Municipality',
  'Ward',
  'Reporter',
  'Priority',
  'Created At',
  'Updated At',
] as const;

const CELL_WIDTHS = [14, 34, 14, 10, 26, 20, 8, 22, 10, 22, 22]; // pdfkit table columns

function toCells(row: ReportExportRow): string[] {
  return [
    row.ref,
    row.title,
    row.status,
    row.severity,
    row.roadName,
    row.municipality,
    row.ward,
    row.reporterName ?? '—',
    String(row.priorityScore),
    row.createdAt.toISOString(),
    row.updatedAt.toISOString(),
  ];
}

// ---------------------------------------------------------------------------
// CSV (RFC 4180) — hand-rolled so exports need no runtime dependency.
// ---------------------------------------------------------------------------

function escapeCsv(value: string): string {
  // Quote when the field contains a comma, quote, or newline; double inner quotes.
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: ReportExportRow[]): string {
  const header = COLUMNS.join(',');
  const body = rows.map((r) => toCells(r).map(escapeCsv).join(',')).join('\r\n');
  return `${header}\r\n${body}`;
}

// ---------------------------------------------------------------------------
// XLSX — exceljs (streamed to the client by the route).
// ---------------------------------------------------------------------------

export async function buildXlsx(rows: ReportExportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RoadGuard';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Reports');

  sheet.columns = COLUMNS.map((header, i) => ({
    header,
    key: String(i),
    width: CELL_WIDTHS[i] ?? 20,
  }));

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0B1F3A' }, // brand primary
  };
  sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + COLUMNS.length)}1` };

  rows.forEach((row) => {
    sheet.addRow(toCells(row));
  });

  sheet.eachRow((r) => {
    r.alignment = { vertical: 'middle' };
    r.height = 20;
  });

  // Write into a buffer for the response.
  const buf: Buffer = await workbook.xlsx.writeBuffer() as unknown as Buffer;
  return buf;
}

// ---------------------------------------------------------------------------
// PDF — pdfkit, landscape A4 with a simple column grid and page breaks.
// ---------------------------------------------------------------------------

export async function buildPdf(rows: ReportExportRow[]): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 36;
    const rowHeight = 20;
    const tableTop = 96;
    const colStarts = cumulativeColStarts(CELL_WIDTHS, pageWidth - margin * 2);

    // Header band
    doc.rect(0, 0, pageWidth, 96).fill('#0B1F3A');
    doc.fill('#FFFFFF').font('Helvetica-Bold').fontSize(18);
    doc.text('RoadGuard — Reports Export', margin, 30, { width: pageWidth - margin * 2 });
    doc.font('Helvetica').fontSize(9);
    doc.text(`Generated ${new Date().toLocaleString()}  ·  ${rows.length} report(s)`, margin, 56);

    let y = tableTop;

    const drawHeaderRow = (top: number) => {
      doc.fill('#153B6B');
      doc.rect(margin, top, pageWidth - margin * 2, rowHeight).fill();
      doc.fill('#FFFFFF').font('Helvetica-Bold').fontSize(8);
      colStarts.forEach((x, i) => {
        const header = COLUMNS[i];
        if (header) doc.text(header, margin + x + 4, top + 6, { width: (CELL_WIDTHS[i] ?? 20) - 6 });
      });
    };

    let zebra = false;
    const drawDataRow = (row: ReportExportRow, top: number) => {
      if (zebra) {
        doc.fillColor('#F1F4F8'); // subtle zebra stripe
        doc.rect(margin, top, pageWidth - margin * 2, rowHeight).fill();
      }
      zebra = !zebra;

      doc.font('Helvetica').fontSize(7.5);
      toCells(row).forEach((value, i) => {
        const x = margin + (colStarts[i] ?? 0) + 4;
        const width = (CELL_WIDTHS[i] ?? 20) - 6;
        doc.fillColor(i === 0 ? '#153B6B' : '#333333'); // emphasize the reference column
        doc.text(truncate(value, width), x, top + 6, { width });
      });
    };

    drawHeaderRow(y);
    y += rowHeight;

    for (const row of rows) {
      if (y + rowHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
        drawHeaderRow(y);
        y += rowHeight;
      }
      drawDataRow(row, y);
      y += rowHeight;
    }

    doc.end();
  });
}

function cumulativeColStarts(widths: readonly number[], totalWidth: number): number[] {
  // Scales the fixed widths to the actual printable width so the grid fits.
  const sum = widths.reduce((a, b) => a + b, 0);
  const scale = totalWidth / sum;
  const starts: number[] = [];
  let acc = 0;
  for (const w of widths) {
    starts.push(acc);
    acc += w * scale;
  }
  return starts;
}

function truncate(value: string, width: number): string {
  // Rough char-width heuristic for the small pdfkit cells.
  const maxChars = Math.max(8, Math.floor(width / 0.75));
  return value.length > maxChars ? `${value.slice(0, maxChars - 1)}…` : value;
}

// ---------------------------------------------------------------------------
// Citizen receipt — a single official A4 PDF for one report (FR-20).
// ---------------------------------------------------------------------------

/** One status-history step shown on the receipt timeline. */
export interface ReceiptHistoryEntry {
  status: Status;
  remarks: string | null;
  updatedBy: string | null;
  createdAt: string; // ISO
}

/** Everything the receipt renderer needs, already denormalized. */
export interface ReceiptData {
  ref: string;
  title: string;
  description: string;
  status: Status;
  severity: Severity;
  roadName: string;
  municipality: string;
  ward: string;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  reporterName: string | null;
  duplicate: boolean;
  priorityScore: number;
  imageUrl: string;
  completionImageUrl: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  history: ReceiptHistoryEntry[];
}

// Status/severity display metadata — mirrors frontend/src/lib/constants.ts.
const STATUS_LABEL: Record<Status, string> = {
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  REMOVED: 'Removed',
};

const STATUS_COLOR: Record<Status, string> = {
  PENDING: '#FFA500',
  VERIFIED: '#2563EB',
  ASSIGNED: '#7C3AED',
  IN_PROGRESS: '#F97316',
  COMPLETED: '#28A745',
  REJECTED: '#6B7280',
  REMOVED: '#DC2626',
};
const SEVERITY_LABEL: Record<Severity, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};
const SEVERITY_COLOR: Record<Severity, string> = {
  LOW: '#28A745',
  MEDIUM: '#FFA500',
  HIGH: '#DC3545',
  CRITICAL: '#9D174D',
};

/**
 * Loads a stored report image for embedding. `/uploads/...` reads from local
 * disk; absolute URLs (Cloudinary) are fetched. Images are stored as WebP,
 * which pdfkit cannot embed, so every buffer is converted to PNG via sharp.
 * Fails soft (null) — a missing photo draws a placeholder instead of failing
 * the whole receipt.
 */
async function loadImageForPdf(source: string): Promise<Buffer | null> {
  try {
    let raw: Buffer;
    if (source.startsWith('/uploads/')) {
      const filePath = path.resolve(process.cwd(), 'uploads', source.slice('/uploads/'.length));
      raw = await fs.readFile(filePath);
    } else if (/^https?:\/\//.test(source)) {
      const res = await fetch(source);
      if (!res.ok) return null;
      raw = Buffer.from(await res.arrayBuffer());
    } else {
      return null;
    }
    return await sharp(raw).png().toBuffer();
  } catch {
    return null;
  }
}

/** Renders one report as an official portrait-A4 receipt with photos + timeline. */
export async function buildReceiptPdf(data: ReceiptData): Promise<Buffer> {
  const before = await loadImageForPdf(data.imageUrl);
  const after = data.completionImageUrl ? await loadImageForPdf(data.completionImageUrl) : null;
  const beforeMeta = before ? await sharp(before).metadata() : null;
  const afterMeta = after ? await sharp(after).metadata() : null;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;
    const M = 48;
    const CW = W - M * 2;
    let y = 0;

    // ---- Header band ----
    doc.rect(0, 0, W, 68).fill('#0B1F3A');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20).text('RoadGuard', M, 14);
    doc.font('Helvetica').fontSize(9.5).text('Smart Pothole Detection & Reporting System', M, 34);
    doc.font('Helvetica-Bold').fontSize(11).text('OFFICIAL REPORT RECEIPT', W - M - 210, 16, { width: 210, align: 'right' });
    doc.font('Helvetica').fontSize(8.5).text(`${data.ref}  ·  ${new Date().toLocaleString()}`, W - M - 210, 32, { width: 210, align: 'right' });

    y = 86;

    // ---- Report identity ----
    doc.fillColor('#0B1F3A').font('Helvetica-Bold').fontSize(16).text(data.title, M, y, { width: CW });
    y += 24;
    if (data.description) {
      doc.fillColor('#444444').font('Helvetica').fontSize(9.5).text(data.description, M, y, { width: CW });
      y += doc.heightOfString(data.description, { width: CW }) + 10;
    }

    // Status + severity chips.
    drawChip(doc, M, y, 'Status', STATUS_LABEL[data.status], STATUS_COLOR[data.status]);
    drawChip(doc, M + 140, y, 'Severity', SEVERITY_LABEL[data.severity], SEVERITY_COLOR[data.severity]);
    y += 42;

    // ---- Location / details ----
    y = sectionTitle(doc, 'Location & details', M, CW, y);
    const details: [string, string][] = [
      ['Road', data.roadName],
      ['Municipality', data.municipality],
      ['Ward', data.ward],
      ['Landmark', data.landmark || '—'],
      ['Coordinates', data.latitude != null && data.longitude != null ? `${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}` : '—'],
      ['Reporter', data.reporterName || '—'],
      ['Priority score', String(data.priorityScore)],
      ['Flagged duplicate', data.duplicate ? 'Yes' : 'No'],
    ];
    const half = Math.ceil(details.length / 2);
    const colW = (CW - 24) / 2;
    details.forEach(([key, value], i) => {
      const col = i < half ? 0 : 1;
      const idx = i < half ? i : i - half;
      const x = M + col * (colW + 24);
      const rowY = y + idx * 17;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0B1F3A').text(key.toUpperCase(), x, rowY, { width: colW });
      doc.font('Helvetica').fontSize(9.5).fillColor('#333333').text(value, x + 96, rowY, { width: colW - 96 });
    });
    y += half * 17 + 8;

    // ---- Timeline ----
    y = sectionTitle(doc, 'Status timeline', M, CW, y);
    if (data.history.length === 0) {
      doc.font('Helvetica').fontSize(9).fillColor('#888888').text('No status changes recorded.', M, y);
      y += 18;
    } else {
      for (const h of data.history) {
        doc.circle(M + 4, y + 4, 3.5).fill(STATUS_COLOR[h.status] ?? '#888888');
        doc.fillColor('#0B1F3A').font('Helvetica-Bold').fontSize(9).text(STATUS_LABEL[h.status] ?? h.status, M + 14, y);
        doc.font('Helvetica').fontSize(8).fillColor('#666666').text(
          `${h.updatedBy ?? 'System'} · ${new Date(h.createdAt).toLocaleString()}`,
          M + 170, y, { width: CW - 190 }
        );
        if (h.remarks) {
          doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#555555').text(h.remarks, M + 14, y + 12, { width: CW - 20 });
          y += 12 + doc.heightOfString(h.remarks, { width: CW - 20 }) + 8;
        } else {
          y += 18;
        }
      }
    }

    // ---- Photographic evidence ----
    y = sectionTitle(doc, 'Photographic evidence', M, CW, y);
    const photoW = (CW - 20) / 2;
    const photoTop = y + 12;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0B1F3A').text('BEFORE REPAIR', M, y, { width: photoW });
    const beforeH = displayHeight(beforeMeta, photoW);
    drawPhotoBox(doc, before, M, photoTop, photoW, beforeH, 'Photo unavailable');
    doc.text('AFTER REPAIR', M + photoW + 20, y, { width: photoW });
    const afterH = displayHeight(afterMeta, photoW);
    drawPhotoBox(doc, after, M + photoW + 20, photoTop, photoW, afterH, data.status === 'COMPLETED' ? 'No completion photo attached' : 'Awaiting repair');
    y += Math.max(beforeH, afterH, 120) + 12;

    // ---- Rejection reason ----
    if (data.status === Status.REJECTED && data.rejectionReason) {
      y = sectionTitle(doc, 'Rejection reason', M, CW, y);
      doc.font('Helvetica').fontSize(9).fillColor('#B91C1C').text(data.rejectionReason, M, y, { width: CW });
    }

    // ---- Footer band ----
    doc.rect(0, doc.page.height - 40, W, 40).fill('#0B1F3A');
    doc.fillColor('#FFFFFF').font('Helvetica').fontSize(8)
      .text('Municipal Road Division · roadguard.gov.np', M, doc.page.height - 28);
    doc.font('Helvetica-Bold').fontSize(8)
      .text(data.ref, W - M, doc.page.height - 28, { width: 200, align: 'right' });
    doc.font('Helvetica').fontSize(7.5)
      .text(`Generated ${new Date().toLocaleString()} — keep this receipt to track your report.`, M, doc.page.height - 16);

    doc.end();
  });
}

/** Accent-underlined section heading; returns the y where content starts. */
function sectionTitle(doc: PDFKit.PDFDocument, title: string, margin: number, width: number, y: number): number {
  const top = y + 10;
  doc.fillColor('#0B1F3A').font('Helvetica-Bold').fontSize(11).text(title.toUpperCase(), margin, top);
  doc.moveTo(margin, top + 5).lineTo(margin + width, top + 5).lineWidth(1.2).strokeColor('#00B4D8').stroke();
  return top + 14;
}

/** Small labelled badge (status / severity). */
function drawChip(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  label: string,
  value: string,
  color: string
): void {
  const w = 118;
  const h = 30;
  doc.roundedRect(x, y, w, h, 6).fill('#F1F4F8');
  doc.fillColor('#0B1F3A').font('Helvetica-Bold').fontSize(7).text(label.toUpperCase(), x + 10, y + 5, { width: w - 20 });
  doc.fillColor(color).font('Helvetica-Bold').fontSize(10).text(value, x + 10, y + 13, { width: w - 20 });
}

/** Display height (pt) for a photo at the given width, capped to keep the page sane. */
function displayHeight(meta: sharp.Metadata | null, width: number): number {
  if (!meta?.width) return 120;
  const h = width * ((meta.height ?? 1) / meta.width);
  return Math.min(Math.max(h, 60), 320);
}

/** Draws the image (or a placeholder) inside a light-bordered box. */
function drawPhotoBox(
  doc: PDFKit.PDFDocument,
  buf: Buffer | null,
  x: number,
  y: number,
  w: number,
  h: number,
  placeholderText: string
): void {
  doc.rect(x, y, w, h).lineWidth(0.6).strokeColor('#CBD5E1').stroke();
  if (buf) {
    doc.image(buf, x, y, { width: w });
  } else {
    doc.rect(x, y, w, h).fill('#F1F4F8');
    doc.fillColor('#94A3B8').font('Helvetica').fontSize(8).text(placeholderText, x, y + h / 2 - 5, { align: 'center', width: w });
  }
}
