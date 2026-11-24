import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createSuiteSession, assertCleanRuntime, loginAsDemo } from '../helpers/e2e-context.js';

const COMING_SOON_ROUTES = [
  { path: '/dashboard/analytics?feature=F22', title: 'Water & Sustainability Metrics', code: 'F22', sprint: 'Coming in Sprint 5' },
  { path: '/dashboard/calendar?feature=F23', title: 'Seed Vault & Germination Logs', code: 'F23', sprint: 'Coming in Sprint 5' },
  { path: '/dashboard/help', title: 'Help Center', code: null, sprint: 'Coming in Sprint 2' }
];

describe('E2E: F22-F23 Coming Soon Routes, Legacy Redirects & 404 Edge Routes', () => {
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

  it('All F16-F23 and Help dashboard Coming Soon routes render polished "Under Development" views', async () => {
    page.clearDiagnostics();

    for (const item of COMING_SOON_ROUTES) {
      await page.goto(`${session.baseUrl}${item.path}`);
      await page.waitForText(item.title);
      await page.waitForText('Under Development');
      await page.waitForText(item.sprint);
      const body = await page.getBodyText();
      if (item.code) {
        assert.ok(body.includes(item.code), `Route ${item.path} missing badge ${item.code}`);
      }
      assert.ok(body.includes('Back to Overview'), `Route ${item.path} missing Back to Overview button`);
    }

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
