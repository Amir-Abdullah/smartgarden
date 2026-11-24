import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createSuiteSession, assertCleanRuntime } from '../helpers/e2e-context.js';

describe('E2E: Public Pages, Dark Mode & Coming Soon Modals', () => {
  let session;
  let page;

  before(async () => {
    session = await createSuiteSession();
    page = await session.browser.newPage();
  });

  after(async () => {
    if (page) await page.close();
    if (session) await session.teardown();
  });

  it('Landing page (/) renders hero, stats, F1-F24 cards, 3-step guide, 6-plant preview, testimonials, FAQ, CTA, and dark mode toggle', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/`);
    await page.waitForText('Grow Smarter. Cultivate Resilient Gardens.');

    const body = await page.getBodyText();

    // Stat strip
    for (const stat of ['32+', '15 Live', '3 Tiers', '9 Soon']) {
      assert.ok(body.includes(stat), `Landing page missing stat "${stat}"`);
    }

    // F1-F24 feature cards
    assert.ok(body.includes('Accounts & Security'), 'Missing F1 feature card');
    assert.ok(body.includes('Zone Crop Inventory'), 'Missing F5 feature card');
    assert.ok(body.includes('Recurring Care Tasks & Watering'), 'Missing F6 feature card');
    assert.ok(body.includes('Automation Rule Engine'), 'Missing F10 feature card');
    assert.ok(body.includes('Weather-Aware Planning & Spatial Cache'), 'Missing F11 feature card');
    assert.ok(body.includes('Companion Planting Advisor'), 'Missing F15 feature card');
    assert.ok(body.includes('Public Profiles & Scoped API Keys'), 'Missing F24 feature card');

    // Filter tabs: Live Now (F1-F15) vs Upcoming (F16-F24)
    await page.clickButton('Live Now (F1–F15)');
    await page.waitForTextGone('Growth Journal & Photo Timeline');
    assert.ok((await page.getBodyText()).includes('Accounts & Security'));
    assert.ok((await page.getBodyText()).includes('Weather-Aware Planning & Spatial Cache'));

    await page.clickButton('Upcoming (F16–F24)');
    await page.waitForText('Growth Journal & Photo Timeline');
    assert.ok(!(await page.getBodyText()).includes('Accounts & Security'));

    // Click an upcoming feature card -> opens ComingSoonModal
    await page.eval(() => {
      const cards = Array.from(document.querySelectorAll('#features div, #features a'));
      const f16 = cards.find((el) => (el.innerText || '').includes('Growth Journal & Photo Timeline') && el.className.includes('cursor-pointer'));
      if (f16) f16.click();
    });
    await page.waitForText('Planned Capabilities');
    await page.waitForText('Coming in Sprint 4');
    await page.clickButton('Close', { within: '[role="dialog"]' });
    await page.waitForTextGone('Planned Capabilities');

    await page.clickButton('All (24)');
    await page.waitForText('Accounts & Security');

    // 3-step guide
    const fullBody = await page.getBodyText();
    assert.ok(fullBody.includes('From Blank Plot to Balanced Polyculture in Three Steps'));
    assert.ok(fullBody.includes('Define Gardens & Microclimates'));
    assert.ok(fullBody.includes('Select Species from the Catalog'));
    assert.ok(fullBody.includes('Balance Capacity & Companions'));

    // 6-plant preview
    assert.ok(fullBody.includes('Reference Species Preview'));
    for (const plant of ['Roma Tomato', 'Sweet Basil', 'Nantes Carrot', 'English Lavender', 'Alpine Strawberry', 'French Marigold']) {
      assert.ok(fullBody.includes(plant), `Missing preview plant "${plant}"`);
    }

    // Testimonials
    assert.ok(fullBody.includes('Trusted by Backyard Gardeners & Community Plots'));
    for (const person of ['Elena Vance', 'Marcus Chen', 'Priya Nair']) {
      assert.ok(fullBody.includes(person), `Missing testimonial from "${person}"`);
    }

    // FAQ accordion
    assert.ok(fullBody.includes('Frequently Asked Questions'));
    await page.clickButton('How does SmartGarden detect bed overcrowding?');
    await page.waitForText('ZONE_OVERCROWDED');

    // Bottom CTA
    assert.ok((await page.getBodyText()).includes('Ready to plan your healthiest harvest yet?'));

    // Dark-mode toggle switches <html> dark class and toggles back
    const initialDark = await page.eval(() => document.documentElement.classList.contains('dark'));
    await page.clickSelector('header button[aria-label*="Switch to" i]');
    await page.waitFor(
      (prev) => document.documentElement.classList.contains('dark') !== prev,
      { message: 'Dark mode class on <html> did not toggle on first click' },
      initialDark
    );
    const toggledDark = await page.eval(() => document.documentElement.classList.contains('dark'));
    assert.notEqual(toggledDark, initialDark);

    await page.clickSelector('header button[aria-label*="Switch to" i]');
    await page.waitFor(
      (expected) => document.documentElement.classList.contains('dark') === expected,
      { message: 'Dark mode class on <html> did not toggle back on second click' },
      initialDark
    );

    assertCleanRuntime(page);
  });

  it('Contact page (/contact) validates inputs and shows preview toast on valid submit', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/contact`);
    await page.waitForText('Get in Touch with SmartGarden');

    // Submit empty -> client-side validation errors
    await page.clickButton('Send Message');
    await page.waitForText('Please enter your name.');
    await page.waitForText('Please enter a valid email address.');
    await page.waitForText('Message must be at least 10 characters.');

    // Fill valid inputs and submit
    await page.fillByLabel('Full Name', 'E2E Tester');
    await page.fillByLabel('Email Address', 'e2e@example.com');
    await page.fillByLabel('Message', 'Testing the SmartGarden contact preview form end to end.');
    await page.waitForTextGone('Please enter your name.');
    await page.clickButton('Send Message');

    await page.waitForText('Messaging backend coming in a later sprint');
    assertCleanRuntime(page);
  });

  it('About page (/about) renders sprint roadmap derived from FEATURES', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/about`);
    await page.waitForText('Building Calm, Science-Backed Tools for Modern Growers');
    await page.waitForText('Sprint Roadmap (F1–F24)');

    const body = await page.getBodyText();
    assert.ok(body.includes('Sprint 1 — Live Foundation'));
    assert.ok(body.includes('Sprint 2 — Live Operations & Telemetry'));
    assert.ok(body.includes('Sprint 3 — Live Horticultural Intelligence'));
    assert.ok(body.includes('Sprint 4 — Planned'));
    assert.ok(body.includes('Sprint 5 — Planned'));
    assert.ok(body.includes('Accounts & Security'));
    assert.ok(body.includes('Public Profiles & Scoped API Keys'));

    // Clicking a planned feature card opens ComingSoonModal
    await page.clickElementFromFn(
      () => {
        const cards = Array.from(document.querySelectorAll('#roadmap div'));
        return cards.find((el) => (el.innerText || '').includes('Growth Journal & Photo Timeline') && el.className.includes('cursor-pointer')) || null;
      },
      'Roadmap F16 card not found'
    );
    await page.waitForText('Planned Capabilities');
    await page.sleep(250);
    await page.clickButton('Close', { within: '[role="dialog"]' });
    await page.waitForTextGone('Planned Capabilities');

    assertCleanRuntime(page);
  });

  it('Public Plant Catalog (/catalog) renders cleanly unauthenticated with filters and detail modal', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/catalog`);
    await page.waitForText('Botanical Plant Catalog');
    await page.waitForText('Showing Public Reference Preview');
    await page.waitForText('Roma Tomato');
    await page.waitForText('Boston Fern');

    // Filter by category
    await page.clickButton('Herbs');
    await page.waitForText('Sweet Basil');
    await page.waitForTextGone('Nantes Carrot');

    // Reset filters
    await page.clickButton('Reset');
    await page.waitForText('Nantes Carrot');

    // Open plant detail modal
    await page.eval(() => {
      const cards = Array.from(document.querySelectorAll('div, article'));
      const card = cards.find((el) => (el.innerText || '').includes('Roma Tomato') && el.className.includes('cursor-pointer'));
      if (card) card.click();
    });
    await page.waitForText('Watering Cadence');
    await page.waitForText('Synergistic Companions');
    await page.clickButton('Close', { within: '[role="dialog"]' });
    await page.waitForTextGone('Watering Cadence');

    assertCleanRuntime(page);
  });

  it('Pricing (/pricing) and Coming Soon header/footer actions render polished views/modals', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/pricing`);
    await page.waitForText('Pricing & Plans');
    await page.waitForText('Under Development');
    await page.waitForText('Coming in Sprint 3');
    await page.clickButton('Notify Me');
    await page.waitForText('Interest noted!');

    // Header Pricing [Soon] and Footer Privacy Policy [Soon] open ComingSoonModal
    await page.goto(`${session.baseUrl}/`);
    await page.waitForText('Grow Smarter. Cultivate Resilient Gardens.');
    await page.clickButton('Pricing', { within: 'header' });
    await page.waitForText('Pricing & Plans');
    await page.waitForText('Planned Capabilities');
    await page.clickButton('Close', { within: '[role="dialog"]' });
    await page.waitForTextGone('Planned Capabilities');

    await page.clickButton('Privacy Policy');
    await page.waitForText('Zero third-party telemetry resale');
    await page.clickButton('Close');
    await page.waitForTextGone('Zero third-party telemetry resale');

    assertCleanRuntime(page);
  });
});
