import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { ReportExportRow } from '../../src/repositories/admin.repo.js';
import { buildPdf, buildReceiptPdf, buildXlsx, toCsv } from '../../src/utils/exporters.js';

function makeRow(overrides: Partial<ReportExportRow> = {}): ReportExportRow {
  return {
    ref: 'RG-000001',
    title: 'Deep pothole on Ashok Road',
    status: 'PENDING',
    severity: 'HIGH',
    roadName: 'Ashok Road',
    municipality: 'Kathmandu',
    ward: '10',
    priorityScore: 58,
    reporterName: 'Sita Shrestha',
    createdAt: new Date('2026-08-06T09:00:00Z'),
    updatedAt: new Date('2026-08-06T12:30:00Z'),
    ...overrides,
  };
}

const HEADER = [
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
].join(',');

describe('toCsv', () => {
  it('emits the shared RFC4180 header row', () => {
    const csv = toCsv([]);
    expect(csv.split('\r\n')[0]).toBe(HEADER);
  });

  it('writes one CRLF-delimited line per report', () => {
    const csv = toCsv([makeRow(), makeRow({ ref: 'RG-000002' })]);
    expect(csv.split('\r\n')).toHaveLength(3); // header + 2 rows
  });

  it('quotes fields containing commas, quotes or newlines and doubles inner quotes', () => {
    const row = makeRow({ title: 'Deep, "dangerous" pothole\non Ashok Road' });
    const csv = toCsv([row]);
    expect(csv).toContain('"Deep, ""dangerous"" pothole\non Ashok Road"');
  });

  it('renders a missing reporter as an em dash', () => {
    const csv = toCsv([makeRow({ reporterName: null })]);
    expect(csv).toContain(',—,');
  });

  it('serialises dates as UTC ISO strings', () => {
    const csv = toCsv([makeRow()]);
    expect(csv).toContain('2026-08-06T09:00:00.000Z');
    expect(csv).toContain('2026-08-06T12:30:00.000Z');
  });
});

describe('buildXlsx', () => {
  it('produces a loadable workbook with a header row and one row per report', async () => {
    const buf = await buildXlsx([makeRow(), makeRow({ ref: 'RG-000002' })]);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buf);
    const sheet = workbook.getWorksheet('Reports');
    expect(sheet).toBeDefined();
    expect(sheet!.rowCount).toBe(3);
    expect(sheet!.getCell('A1').value).toBe('Reference');
    expect(sheet!.getCell('A2').value).toBe('RG-000001');
    expect(sheet!.getCell('A3').value).toBe('RG-000002');
  });
});

describe('buildPdf', () => {
  it('returns a buffer starting with the PDF magic bytes', async () => {
    const buf = await buildPdf([makeRow()]);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
  });
});

describe('buildReceiptPdf', () => {
  it('returns a valid PDF for a full receipt payload', async () => {
    const buf = await buildReceiptPdf({
      ref: 'RG-000042',
      title: 'Large pothole near the school crossing with a very long title that wraps cleanly',
      description: 'Several centimetres deep and widening after each rain. Traffic slows to a crawl here.',
      status: 'VERIFIED',
      severity: 'HIGH',
      roadName: 'Tripureshwor Marg',
      municipality: 'Kathmandu Metropolitan City',
      ward: '12',
      landmark: 'Opposite the community health post',
      latitude: 27.69345,
      longitude: 85.31298,
      reporterName: 'Ram Bahadur',
      duplicate: false,
      priorityScore: 72,
      imageUrl: '/uploads/missing.webp',
      completionImageUrl: null,
      rejectionReason: null,
      createdAt: '2026-08-06T09:00:00.000Z',
      updatedAt: '2026-08-06T12:30:00.000Z',
      history: [
        {
          status: 'PENDING',
          remarks: 'Submitted by citizen via mobile app.',
          updatedBy: 'Ram Bahadur',
          createdAt: '2026-08-06T09:00:00.000Z',
        },
        {
          status: 'VERIFIED',
          remarks: 'Verified by municipal road inspector after field review.',
          updatedBy: 'Admin User',
          createdAt: '2026-08-06T12:30:00.000Z',
        },
      ],
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
    expect(buf.length).toBeGreaterThan(1500);
  });
});
