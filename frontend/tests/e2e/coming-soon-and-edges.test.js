import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createSuiteSession, assertCleanRuntime, loginAsDemo } from '../helpers/e2e-context.js';

describe('E2E: Live Help Route, Legacy Redirects & 404 Edge Routes', () => {
  let session;
  let page;

  before(async () => {
    session = await createSuiteSession();
    page = await session.browser.newPage();
    await loginAsDemo(page, session.baseUrl);
  });

  after(async () => {
    if (page) await page.close();
    if (session) await session.teardown();
  });

  it('Live Help Center (/dashboard/help) and Sprint 5 routes (/dashboard/sustainability, /dashboard/seed-vault) render cleanly', async () => {
    page.clearDiagnostics();

    await page.goto(`${session.baseUrl}/dashboard/help`);
    await page.waitForText('Help Center');
    await page.waitForText('Knowledge Base');
    await page.waitForText('ZONE_OVERCROWDED');

    await page.goto(`${session.baseUrl}/dashboard/analytics?feature=F22`);
    await page.waitForText('Water & Sustainability Metrics');

    await page.goto(`${session.baseUrl}/dashboard/calendar?feature=F23`);
    await page.waitForText('Seed Vault & Germination Logs');

    assertCleanRuntime(page);
  });

  it('Legacy redirects (/gardens, /gardens/1, /zones/1/plants) resolve to /dashboard/* paths cleanly', async () => {
    page.clearDiagnostics();

    await page.goto(`${session.baseUrl}/gardens`);
    await page.waitForUrl('/dashboard/gardens');
    await page.waitForText('Sunny Backyard Oasis');

    await page.goto(`${session.baseUrl}/gardens/1`);
    await page.waitForUrl('/dashboard/gardens/1');
    await page.waitForText('South Raised Bed');

    const zoneHref = await page.eval(() => {
      const link = document.querySelector('a[href*="/dashboard/zones/"][href$="/plants"]');
      return link ? link.getAttribute('href') : '';
    });
    const legacyZonePath = zoneHref.replace('/dashboard', '');
    assert.ok(legacyZonePath.startsWith('/zones/'), `Expected zone href, got "${zoneHref}"`);

    await page.goto(`${session.baseUrl}${legacyZonePath}`);
    await page.waitForUrl(`/dashboard${legacyZonePath}`);
    await page.waitForText('Zone Crop Inventory');

    assertCleanRuntime(page);
  });

  it('Unknown route (/non-existent-route) renders 404 NotFoundView cleanly', async () => {
    page.clearDiagnostics();

    await page.goto(`${session.baseUrl}/non-existent-route`);
    await page.waitForText('404 • Route Not Found');
    await page.waitForText('This garden path doesn’t exist');

    const body = await page.getBodyText();
    assert.ok(body.includes('Back to Home'));
    assert.ok(body.includes('Open Dashboard'));

    assertCleanRuntime(page);
  });
});
