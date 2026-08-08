/* E2E visual smoke test for the four-algorithm admin UI — priority queue (max
   heap), Dijkstra route map, and CNN severity. Run against the dev servers
   (frontend :5173, backend :5000). Writes screenshots to ./e2e-shots/. */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'http://localhost:5173';
const SHOTS = 'e2e-shots';

const ADMIN = { email: 'admin@roadguard.gov', password: 'Admin@123' };

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  // 1) Admin login.
  await page.goto(BASE + '/admin');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Password').fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in to admin/i }).click();
  await page.waitForURL(/\/admin\/dashboard/, { timeout: 20000 });

  // 2) Reports page — priority queue panel.
  await page.goto(BASE + '/admin/dashboard/reports');
  await page.getByText('Priority queue (max heap)').waitFor({ timeout: 20000 });

  const queueTitle = await page.getByText('Priority queue (max heap)').count();
  const queueSubtitle = await page.getByText(/open .* next up RG-/i).count();
  const subtitleText = await page.locator('div.text-sm.font-extrabold + p').first().innerText().catch(() => '(none)');
  console.log('QUEUE_SUBTITLE_TEXT: %s', subtitleText);
  const dispatchBtn = await page.getByRole('button', { name: /dispatch next/i }).count();
  const queueRows = await page.locator('ol li').count();
  const queueFirstScore = queueRows > 0
    ? (await page.locator('ol li').first().locator('div.text-right p').first().innerText()).trim()
    : '(empty)';
  console.log('QUEUE: title=%d subtitle=%d dispatchBtn=%d rows=%d topScore=%s',
    queueTitle, queueSubtitle, dispatchBtn, queueRows, queueFirstScore);
  await page.screenshot({ path: `${SHOTS}/3-priority-queue.png` });

  // 3) Open a report drawer with a CNN detection (an "AI n%" badge in the
  //    list). Keep trying rows until BOTH the AI-detection card and the
  //    Dijkstra route map render (the report must have confidence + coords).
  const aiRows = page.locator('tbody tr:has-text("AI ")');
  const aiCount = await aiRows.count();
  let routeOk = false;
  let opened = 0;
  let leaflet = 0, pin = 0, team = 0, polyline = 0, teamLabel = 0, distance = 0, eta = 0, cnnSeverity = 0, aiCard = 0;

  for (let i = 0; i < Math.min(aiCount, 8); i++) {
    const row = aiRows.nth(i);
    await row.click();
    opened++;
    let sawAi = false;
    let sawRoute = false;
    try {
      await page.getByText('AI detection').waitFor({ timeout: 6000 });
      sawAi = true;
    } catch { /* no AI card — maybe a false "AI " row match */ }
    try {
      await page.getByText('Dijkstra route').waitFor({ timeout: 6000 });
      sawRoute = true;
    } catch { /* no route for this report */ }
    if (sawAi && sawRoute) { routeOk = true; break; }
    const close = page.getByRole('button', { name: 'Close' });
    if (await close.count()) await close.click();
    await page.waitForTimeout(400);
  }

  if (!routeOk) {
    console.log('ROUTE: FAIL — no open report rendered BOTH the AI detection card and the Dijkstra route');
  } else {
    // 4) Assert the route map contents.
    leaflet = await page.locator('.leaflet-container').count();
    pin = await page.locator('.rg-map-pin').count();
    team = await page.locator('.rg-map-team').count();
    polyline = await page.locator('.leaflet-overlay-pane svg path').count();
    teamLabel = await page.getByText(/Team: .*(nearest by road|assigned)/i).count();
    const teamText = await page.getByText(/Team:/).first().innerText().catch(() => '(none)');
    console.log('ROUTE_TEAM_TEXT: %s', teamText);
    distance = await page.getByText(/[0-9]+\.[0-9]{2} km/).count();
    eta = await page.getByText(/[0-9]+\.[0-9] min/).count();
    cnnSeverity = await page.getByText('CNN severity').count();
    aiCard = await page.getByText('AI detection').count();

    console.log('ROUTE: openedDrawers=%d leaflet=%d pin=%d teamMarker=%d polyline=%d teamLabel=%d distance=%d eta=%d cnnSeverity=%d aiCard=%d',
      opened, leaflet, pin, team, polyline, teamLabel, distance, eta, cnnSeverity, aiCard);
    await page.waitForTimeout(500); // let tiles settle
    await page.screenshot({ path: `${SHOTS}/4-admin-route-map.png` });
  }

  // 5) "Dispatch next" — pops the heap peak via the UI.
  await page.goto(BASE + '/admin/dashboard/reports');
  await page.getByText('Priority queue (max heap)').waitFor({ timeout: 20000 });
  const dispatchBtn2 = page.getByRole('button', { name: /dispatch next/i });
  if (await dispatchBtn2.count()) {
    await dispatchBtn2.click();
    await page.waitForTimeout(2500);
    const dispatchedToast = await page.getByText(/Dispatched RG-|Priority queue is empty/).count();
    const queueRowsAfter = await page.locator('ol li').count();
    console.log('DISPATCH: toast=%d queueRowsAfter=%d', dispatchedToast, queueRowsAfter);
  } else {
    console.log('DISPATCH: no button found');
  }

  console.log('CONSOLE_ERRORS: %d', errors.length);
  for (const e of errors.slice(0, 5)) console.log('  ' + e);

  await browser.close();
  const ok =
    queueTitle >= 1 && queueSubtitle >= 1 && queueRows > 0 &&
    routeOk && leaflet >= 1 && pin >= 1 && team >= 1 && polyline >= 1 && distance >= 1 && eta >= 1 &&
    errors.length === 0;
  console.log(ok ? 'E2E_ALGORITHMS_PASS' : 'E2E_ALGORITHMS_FAIL');
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error('E2E error:', err);
  process.exit(1);
});
