import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createSuiteSession, assertCleanRuntime, loginAsDemo } from '../helpers/e2e-context.js';

describe('E2E: Sprint 5 F21-F24, Public Pages & Three.js 3D Visualizations', () => {
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

  it('Three.js Hero Diorama & GardenPlot3D Twin render interactive canvases with lighting toggles & zero errors', async () => {
    page.clearDiagnostics();

    await page.goto(`${session.baseUrl}/`);
    await page.waitFor(() => {
      const c = document.querySelector('[data-testid="hero-3d-canvas"]');
      return Boolean(c && c.getBoundingClientRect().width > 100 && c.getBoundingClientRect().height > 100);
    });
    await page.clickButton('Night Glow');
    await page.clickButton('Daylight');

    await page.goto(`${session.baseUrl}/dashboard/gardens/1`);
    await page.waitForText('Sunny Backyard Oasis');
    await page.clickButton('3D Twin');
    await page.waitFor(() => {
      const c = document.querySelector('[data-testid="garden-plot-3d-canvas"]');
      return Boolean(c && c.getBoundingClientRect().width > 100 && c.getBoundingClientRect().height > 100);
    });
    await page.clickButton('South Raised Bed');
    await page.waitForText('RAISED_BED');

    assertCleanRuntime(page);
  });

  it('F21 & F24 Settings (/dashboard/settings): manages notifications inbox, SSRF-checked webhook, & issues sg_pat_ API key', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/dashboard/settings`);
    await page.waitForText('Multi-Channel Notifications & Webhooks (F21)');
    await page.waitForText('Forecast Advisory: Gentle Rain Window');

    // SSRF unsafe URL rejected
    await page.fillByLabel('Public HTTPS Webhook URL', 'https://127.0.0.1/hook', {
      within: '[data-testid="settings-notifications-card"]'
    });
    await page.clickButton('Save Notification Preferences');
    await page.waitForText('Invalid Preference');

    // Valid HTTPS URL + Test Webhook
    await page.fillByLabel('Public HTTPS Webhook URL', 'https://hooks.example.org/smartgarden-e2e', {
      within: '[data-testid="settings-notifications-card"]'
    });
    await page.clickButton('Save Notification Preferences');
    await page.waitForText('Notification Preferences Saved');
    await page.clickButton('Send Test Webhook');
    await page.waitForText('Test Webhook Dispatched');

    // Create sg_pat_ API key
    await page.eval(() => {
      const card = document.querySelector('[data-testid="settings-api-keys-card"]');
      const input = card?.querySelector('input');
      if (input) {
        input.focus();
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, 'E2E Home Assistant Key');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.clickButton('Generate sg_pat_ Key');
    await page.waitForText('Copy Your Personal Access Token Now (Shown Once)');

    assertCleanRuntime(page, { allow4xxConsole: true });
  });

  it('F22 SustainabilityView (/dashboard/sustainability): displays scorecard and logs conservation impact', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/dashboard/sustainability`);
    await page.waitForText('Water & Sustainability Metrics');
    await page.waitForText('Sustainability Grade:');
    await page.waitForText('220 L');

    await page.fillByLabel('Quantity', '85', { within: '[data-testid="sustainability-log-form"]' });
    await page.fillByLabel('Notes', 'E2E autumn cistern collection', { within: '[data-testid="sustainability-log-form"]' });
    await page.clickButton('Log Conservation Impact');

    await page.waitForText('Sustainability Log Recorded');
    await page.waitForText('E2E autumn cistern collection');

    assertCleanRuntime(page);
  });

  it('F23 SeedVaultView (/dashboard/seed-vault): displays packets, adds new packet & sows directly into zone', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/dashboard/seed-vault`);
    await page.waitForText('Seed Vault & Germination Logs');
    await page.waitForText('San Marzano Heirloom Tomato');

    await page.clickButton('Add Seed Packet');
    await page.waitForText('Variety Name');
    await page.fillByLabel('Variety Name', 'Black Krim E2E Tomato', { within: '[role="dialog"]' });
    await page.clickButton('Save Packet', { within: '[role="dialog"]' });
    await page.waitForText('Seed Packet Saved');
    await page.waitForText('Black Krim E2E Tomato');

    // Sow newly created packet into zone
    await page.clickElementFromFn(
      () => {
        const cards = Array.from(document.querySelectorAll('[data-testid^="seed-packet-"]'));
        const card = cards.find((c) => (c.innerText || '').includes('Black Krim E2E Tomato'));
        return card ? Array.from(card.querySelectorAll('button')).find((b) => (b.innerText || '').includes('Sow into Zone')) : null;
      },
      'Sow into Zone button not found on Black Krim E2E Tomato packet'
    );
    await page.waitForText('Confirm Sow Allocation');
    await page.clickButton('Confirm Sow Allocation', { within: '[role="dialog"]' });
    await page.waitForText('Seeds Sown into Zone');

    assertCleanRuntime(page);
  });

  it('F24 Public Grower Showcase (/u/demo-gardener) & All 7 Public Content Pages render cleanly', async () => {
    page.clearDiagnostics();

    await page.goto(`${session.baseUrl}/u/demo-gardener`);
    await page.waitForText('@demo-gardener');
    await page.waitForText('Demo Gardener');
    await page.waitForText('Sunny Backyard Oasis');
    await page.waitFor(() => Boolean(document.querySelector('[data-testid="garden-plot-3d-canvas"]')));

    const pages = [
      { path: '/docs', text: 'Developer & Hardware Documentation' },
      { path: '/blog', text: 'Agronomy Blog' },
      { path: '/changelog', text: 'Release Changelog' },
      { path: '/help', text: 'Help Center' },
      { path: '/privacy', text: 'Privacy Policy' },
      { path: '/terms', text: 'Terms of Service' }
    ];
    for (const item of pages) {
      await page.goto(`${session.baseUrl}${item.path}`);
      await page.waitForText(item.text);
    }

    assertCleanRuntime(page);
  });
});
