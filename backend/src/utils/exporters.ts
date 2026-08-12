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

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;
    const H = doc.page.height;
    const M = 48;
    const CW = W - M * 2;
    const FOOTER_H = 52;
    const pageBottom = () => H - FOOTER_H;
    let pageIndex = 0;
    let y = 0;

    const formatWhen = (iso: string) =>
      new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

    const drawFooter = () => {
      const fy = H - FOOTER_H;
      doc.rect(0, fy, W, FOOTER_H).fill('#0B1F3A');
      doc.fillColor('#FFFFFF').font('Helvetica').fontSize(8).text('Municipal Road Division · roadguard.gov.np', M, fy + 10);
      doc.font('Helvetica-Bold').fontSize(8).text(data.ref, M, fy + 24, { width: CW, align: 'right' });
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .text(`Generated ${new Date().toLocaleString()} — keep this receipt to track your report.`, M, fy + 36, {
          width: CW,
        });
    };

    const drawMainHeader = () => {
      doc.rect(0, 0, W, 76).fill('#0B1F3A');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(22).text('RoadGuard', M, 18);
      doc
        .font('Helvetica')
        .fontSize(9)
        .text('Smart Pothole Detection & Reporting System', M, 44, { width: CW * 0.52 });

      const boxX = M + CW * 0.56;
      const boxW = CW * 0.44;
      doc.roundedRect(boxX, 14, boxW, 48, 5).fill('#153B6B');
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('OFFICIAL REPORT RECEIPT', boxX + 12, 22, { width: boxW - 24, align: 'right' });
      doc.font('Helvetica-Bold').fontSize(8.5).text(data.ref, boxX + 12, 36, { width: boxW - 24, align: 'right' });
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .text(formatWhen(data.createdAt), boxX + 12, 50, { width: boxW - 24, align: 'right' });
    };

    const drawContinuedHeader = () => {
      doc.rect(0, 0, W, 40).fill('#0B1F3A');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10).text(`RoadGuard · ${data.ref}`, M, 14);
      doc
        .font('Helvetica')
        .fontSize(8)
        .text('Report receipt (continued)', W - M - 160, 16, { width: 160, align: 'right' });
    };

    const startPage = (continued: boolean) => {
      if (pageIndex > 0) {
        drawFooter();
        doc.addPage();
      }
      pageIndex += 1;
      if (continued) {
        drawContinuedHeader();
        y = 52;
      } else {
        drawMainHeader();
        y = 92;
      }
    };

    const ensureSpace = (needed: number) => {
      if (y + needed > pageBottom()) startPage(true);
    };

    startPage(false);

    // ---- Report identity ----
    doc.fillColor('#0B1F3A').font('Helvetica-Bold').fontSize(15).text(data.title, M, y, { width: CW });
    y += doc.heightOfString(data.title, { width: CW }) + 8;

    if (data.description) {
      doc.fillColor('#475569').font('Helvetica').fontSize(9).text(data.description, M, y, { width: CW });
      y += doc.heightOfString(data.description, { width: CW }) + 14;
    }

    // Summary strip — reference + key dates.
    ensureSpace(36);
    const stripH = 32;
    doc.roundedRect(M, y, CW, stripH, 4).fill('#F8FAFC');
    doc.rect(M, y, 3, stripH).fill('#00B4D8');
    const stripCols = [
      ['Reference', data.ref],
      ['Submitted', formatWhen(data.createdAt)],
      ['Last updated', formatWhen(data.updatedAt)],
    ];
    const stripColW = CW / stripCols.length;
    stripCols.forEach(([label, value], i) => {
      const x = M + 12 + i * stripColW;
      doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(6.5).text(label.toUpperCase(), x, y + 7, { width: stripColW - 16 });
      doc.fillColor('#0B1F3A').font('Helvetica-Bold').fontSize(8.5).text(value, x, y + 17, { width: stripColW - 16 });
    });
    y += stripH + 16;

    // Status + severity chips (equal columns).
    ensureSpace(40);
    const chipW = (CW - 16) / 2;
    drawChip(doc, M, y, 'Status', STATUS_LABEL[data.status], STATUS_COLOR[data.status], chipW);
    drawChip(doc, M + chipW + 16, y, 'Severity', SEVERITY_LABEL[data.severity], SEVERITY_COLOR[data.severity], chipW);
    y += 40;

    // ---- Location / details (two-column grid, dynamic row heights) ----
    ensureSpace(48);
    y = sectionTitle(doc, 'Location & details', M, CW, y);
    const leftDetails: [string, string][] = [
      ['Road', data.roadName],
      ['Municipality', data.municipality],
      ['Ward', data.ward],
      ['Landmark', data.landmark || '—'],
    ];
    const rightDetails: [string, string][] = [
      [
        'Coordinates',
        data.latitude != null && data.longitude != null
          ? `${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}`
          : '—',
      ],
      ['Reporter', data.reporterName || '—'],
      ['Priority score', String(data.priorityScore)],
      ['Flagged duplicate', data.duplicate ? 'Yes' : 'No'],
    ];
    const colW = (CW - 20) / 2;
    const labelW = 78;
    const rowCount = Math.max(leftDetails.length, rightDetails.length);
    for (let i = 0; i < rowCount; i++) {
      ensureSpace(22);
      const left = leftDetails[i];
      const right = rightDetails[i];
      const leftH = left ? measureDetailRow(doc, left[0], left[1], colW, labelW) : 0;
      const rightH = right ? measureDetailRow(doc, right[0], right[1], colW, labelW) : 0;
      const rowH = Math.max(leftH, rightH, 14);
      if (left) drawDetailRow(doc, M, y, left[0], left[1], colW, labelW, rowH);
      if (right) drawDetailRow(doc, M + colW + 20, y, right[0], right[1], colW, labelW, rowH);
      y += rowH + 6;
    }
    y += 6;

    // ---- Timeline (stacked — no overlapping columns) ----
    ensureSpace(40);
    y = sectionTitle(doc, 'Status timeline', M, CW, y);
    if (data.history.length === 0) {
      doc.font('Helvetica').fontSize(9).fillColor('#94A3B8').text('No status changes recorded.', M, y);
      y += 20;
    } else {
      for (const h of data.history) {
        const remarksH = h.remarks ? doc.heightOfString(h.remarks, { width: CW - 28 }) + 6 : 0;
        ensureSpace(28 + remarksH);
        const dotY = y + 6;
        doc.circle(M + 6, dotY, 4).fill(STATUS_COLOR[h.status] ?? '#94A3B8');
        doc
          .fillColor('#0B1F3A')
          .font('Helvetica-Bold')
          .fontSize(9.5)
          .text(STATUS_LABEL[h.status] ?? h.status, M + 20, y, { width: CW - 28 });
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#64748B')
          .text(`${h.updatedBy ?? 'System'} · ${formatWhen(h.createdAt)}`, M + 20, y + 13, { width: CW - 28 });
        if (h.remarks) {
          doc
            .font('Helvetica-Oblique')
            .fontSize(8.5)
            .fillColor('#475569')
            .text(h.remarks, M + 20, y + 26, { width: CW - 28 });
          y += 26 + remarksH + 10;
        } else {
          y += 34;
        }
      }
    }

    // ---- Photographic evidence (equal-height boxes, images fitted inside) ----
    const photoH = 132;
    ensureSpace(photoH + 36);
    y = sectionTitle(doc, 'Photographic evidence', M, CW, y);
    const photoW = (CW - 16) / 2;
    const photoTop = y + 14;
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748B').text('BEFORE REPAIR', M, y, { width: photoW });
    doc.text('AFTER REPAIR', M + photoW + 16, y, { width: photoW });
    drawPhotoBox(doc, before, M, photoTop, photoW, photoH, 'Photo unavailable');
    drawPhotoBox(
      doc,
      after,
      M + photoW + 16,
      photoTop,
      photoW,
      photoH,
      data.status === 'COMPLETED' ? 'No completion photo attached' : 'Awaiting repair'
    );
    y = photoTop + photoH + 16;

    // ---- Rejection reason ----
    if (data.status === Status.REJECTED && data.rejectionReason) {
      ensureSpace(48);
      y = sectionTitle(doc, 'Rejection reason', M, CW, y);
      doc.roundedRect(M, y, CW, doc.heightOfString(data.rejectionReason, { width: CW - 24 }) + 16, 4).fill('#FEF2F2');
      doc.font('Helvetica').fontSize(9).fillColor('#B91C1C').text(data.rejectionReason, M + 12, y + 8, { width: CW - 24 });
      y += doc.heightOfString(data.rejectionReason, { width: CW - 24 }) + 24;
    }

    drawFooter();
    doc.end();
  });
}

/** Accent-underlined section heading; returns the y where content starts. */
function sectionTitle(doc: PDFKit.PDFDocument, title: string, margin: number, width: number, y: number): number {
  const top = y + 6;
  doc.fillColor('#0B1F3A').font('Helvetica-Bold').fontSize(10).text(title.toUpperCase(), margin, top, { width });
  const textH = doc.heightOfString(title.toUpperCase(), { width });
  const lineY = top + textH + 5;
  doc.moveTo(margin, lineY).lineTo(margin + width, lineY).lineWidth(1).strokeColor('#00B4D8').stroke();
  return lineY + 12;
}

/** Small labelled badge (status / severity). */
function drawChip(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  label: string,
  value: string,
  color: string,
  width = 118
): void {
  const h = 34;
  doc.roundedRect(x, y, width, h, 6).fill('#F1F4F8');
  doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(7).text(label.toUpperCase(), x + 10, y + 6, { width: width - 20 });
  doc.fillColor(color).font('Helvetica-Bold').fontSize(10).text(value, x + 10, y + 18, { width: width - 20 });
}

function measureDetailRow(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  colW: number,
  labelW: number
): number {
  const valueW = colW - labelW - 8;
  doc.font('Helvetica-Bold').fontSize(7.5);
  const labelH = doc.heightOfString(label.toUpperCase(), { width: labelW });
  doc.font('Helvetica').fontSize(9);
  const valueH = doc.heightOfString(value, { width: valueW });
  return Math.max(labelH, valueH, 12);
}

function drawDetailRow(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  label: string,
  value: string,
  colW: number,
  labelW: number,
  rowH: number
): void {
  const valueW = colW - labelW - 8;
  const valueX = x + labelW + 8;
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748B').text(label.toUpperCase(), x, y + 1, { width: labelW });
  doc.font('Helvetica').fontSize(9).fillColor('#1E293B').text(value, valueX, y + 1, { width: valueW });
  doc
    .moveTo(x, y + rowH + 2)
    .lineTo(x + colW, y + rowH + 2)
    .lineWidth(0.5)
    .strokeColor('#E2E8F0')
    .stroke();
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
  doc.roundedRect(x, y, w, h, 4).fill('#F8FAFC');
  if (buf) {
    doc.save();
    doc.roundedRect(x + 1, y + 1, w - 2, h - 2, 3).clip();
    doc.image(buf, x + 1, y + 1, { fit: [w - 2, h - 2], align: 'center', valign: 'center' });
    doc.restore();
  } else {
    doc.fillColor('#94A3B8').font('Helvetica').fontSize(8).text(placeholderText, x, y + h / 2 - 6, { align: 'center', width: w });
  }
  doc.roundedRect(x, y, w, h, 4).lineWidth(0.75).strokeColor('#CBD5E1').stroke();
}
