/* E2E smoke test for the new Map page — run against a live dev server.
   Logs in as the seeded citizen, exercises search + capture, and verifies the
   report form is pre-filled. Writes screenshots to ./e2e-shots/. */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'http://localhost:5173';
const SHOTS = 'e2e-shots';

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  // 1) Log in as the seeded citizen.
  await page.goto(BASE + '/login');
  await page.getByLabel('Email').fill('citizen@example.com');
  await page.getByLabel('Password').fill('User@123');
  await page.getByRole('button', { name: /log in|sign in|login/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 15000 });

  // 2) Open the map and wait for Leaflet to render.
  await page.goto(BASE + '/map');
  await page.waitForSelector('.leaflet-container', { timeout: 20000 });

  // Tiles + markers need a moment.
  await page.waitForTimeout(2500);
  const markerCount = await page.locator('.leaflet-marker-icon').count();
  const myReportsHeader = await page.getByText('My reports').count();

  // Sidebar cards (seeded citizen has reports).
  const sidebarCards = await page.locator('.glass-card, .glass-card-hover').count();

  // 3) Search → select → selection box + camera appear.
  await page.getByPlaceholder(/search a location/i).fill('Koteshwor');
  await page.waitForTimeout(600);
  await page.locator('li button:has-text("Koteshwor")').first().click();
  await page.waitForTimeout(2000); // flyTo animation

  const boxVisible = await page.getByRole('application', { name: 'Map capture area' }).count();
  const cameraVisible = await page.getByRole('button', { name: 'Capture selected map area' }).count();
  const nearbyPill = await page.getByText(/potholes? nearby/).count();
  await page.screenshot({ path: `${SHOTS}/1-map-after-search.png`, fullPage: false });

  // 4) Capture → should land on the pre-filled report form.
  await page.getByRole('button', { name: 'Capture selected map area' }).click();
  await page.waitForURL(/\/(report|login)/, { timeout: 20000 });

  if (!page.url().includes('/report')) {
    console.log('CAPTURE_RESULT: redirected to ' + page.url() + ' (not /report) — capture may have failed');
  } else {
    await page.waitForTimeout(2500); // draft apply + preview load
    const mapCaptureBadge = await page.getByText('Map capture', { exact: true }).count();
    const locationCaptured = await page.getByText('Location captured from the map').count();
    const titleVal = await page.getByPlaceholder(/deep pothole/i).inputValue();
    const roadVal = await page.getByPlaceholder('Road / street').inputValue();
    const coordsText = await page.locator('.font-mono').count();
    await page.screenshot({ path: `${SHOTS}/2-report-prefilled.png`, fullPage: true });
    console.log('CAPTURE_RESULT: OK — pre-filled form reached');
    console.log('  title        =', titleVal);
    console.log('  roadName     =', roadVal);
    console.log('  mapBadge     =', mapCaptureBadge);
    console.log('  locCaptured  =', locationCaptured);
    console.log('  coordsShown  =', coordsText);
  }

  console.log('LAYOUT: markers=', markerCount, 'sidebarCards=', sidebarCards, 'myReportsHeader=', myReportsHeader);
  console.log('SEARCH: box=', boxVisible, 'camera=', cameraVisible, 'nearbyPill=', nearbyPill);
  console.log('JS_ERRORS:', errors.length === 0 ? 'none' : errors.join('\n  '));

  await browser.close();
  process.exit(0);
}

main().catch((e) => { console.error('E2E FAILED:', e); process.exit(1); });
