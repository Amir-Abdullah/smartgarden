import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createSuiteSession, assertCleanRuntime, loginAsDemo } from '../helpers/e2e-context.js';

describe('E2E: Sprint 4 F16-F20 (Journal, Analytics, AI Diagnosis/Assistant & Community)', () => {
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

  it('F16 Growth Journal (/dashboard/journal): displays seeded height timeline and saves a new entry', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/dashboard/journal`);
    await page.waitForText('Growth Journal & Photo Timeline');
    await page.waitForText('First yellow flower trusses setting cleanly');
    await page.waitForText('41.5 cm');

    await page.fillByLabel('Height (cm)', '52.5', { within: '[data-testid="journal-entry-card"]' });
    await page.fillByLabel('Field Notes', 'Pruned lower suckers and checked fruit set.', {
      within: '[data-testid="journal-entry-card"]'
    });
    await page.clickButton('Save Journal Entry', { within: '[data-testid="journal-entry-card"]' });

    await page.waitForText('Journal Entry Saved');
    await page.waitForText('Pruned lower suckers and checked fruit set.');
    await page.waitForText('52.5 cm');

    assertCleanRuntime(page);
  });

  it('F17 Analytics & Export (/dashboard/analytics): renders KPIs, daily telemetry rollups, CSV & PDF exports', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/dashboard/analytics`);
    await page.waitForText('Analytics & Data Export');
    await page.waitForText('Water Applied (30d)');
    await page.waitForText('Daily Moisture & Temperature Rollup');
    await page.waitForText('South Raised Bed');

    await page.clickSelector('[data-testid="export-csv-btn"]');
    await page.waitForText('CSV Report Ready');

    await page.clickSelector('[data-testid="export-pdf-btn"]');
    await page.waitForText('PDF Report Ready');

    assertCleanRuntime(page);
  });

  it('F18 AI Leaf Diagnosis (/dashboard/ai-diagnosis): uploads sample leaf PNG and renders structured treatment report', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/dashboard/ai-diagnosis`);
    await page.waitForText('AI Leaf Disease & Pest Diagnosis');
    await page.waitForText('Ready for Leaf Inspection');

    await page.clickButton('Analyze Sample Leaf');
    await page.waitForText('Leaf Diagnosis Complete');
    await page.waitFor(() => Boolean(document.querySelector('[data-testid="diagnosis-report-card"]')));

    const body = await page.getBodyText();
    assert.ok(body.includes('Powdery Mildew'), 'Expected Powdery Mildew diagnosis from symptoms');
    assert.ok(body.toLowerCase().includes('organic & biological treatments'), 'Missing organic treatments card');
    assert.ok(body.includes('deterministic-fallback'), 'Missing provider badge');

    assertCleanRuntime(page);
  });

  it('F19 AI Gardening Assistant (/dashboard/ai-assistant): grounds replies in live garden context', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/dashboard/ai-assistant`);
    await page.waitForText('AI Gardening Assistant');
    await page.waitForText('Should I water my tomatoes today?');

    await page.clickButton('Should I water my tomatoes today?');
    await page.waitFor(
      () => {
        const text = document.querySelector('[data-testid="ai-chat-thread"]')?.innerText || '';
        return text.includes('Sunny Backyard Oasis') && text.includes('deterministic-fallback');
      },
      { message: 'AI chat reply did not render live garden context' }
    );

    const threadText = await page.eval(
      () => document.querySelector('[data-testid="ai-chat-thread"]')?.innerText || ''
    );
    assert.ok(threadText.includes('Sunny Backyard Oasis'), 'Assistant reply should mention Sunny Backyard Oasis');

    assertCleanRuntime(page);
  });

  it('F20 Community Hub (/dashboard/community): publishes post, toggles like, adds comment & follows Maya Lin', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/dashboard/community`);
    await page.waitForText('Community Hub & Social Feed');
    await page.waitForText('Spring Cedar Bed Polyculture Setup');
    await page.waitForText('Maya Lin');

    // Follow Maya Lin on her seeded post
    await page.clickElementFromFn(
      () => Array.from(document.querySelectorAll('button')).find((b) => (b.innerText || '').trim() === 'Follow') || null,
      'Follow button for Maya Lin not found'
    );
    await page.waitForText('Following Maya Lin');

    // Open New Post composer & publish
    await page.clickButton('New Post');
    await page.waitForText('Share With Fellow Growers');
    await page.fillByLabel('Post Title', 'E2E Vermicompost Top Dressing Note', {
      within: '[data-testid="community-composer-card"]'
    });
    await page.fillByLabel('Post Content', 'Testing aerated compost tea around basil borders this week.', {
      within: '[data-testid="community-composer-card"]'
    });
    await page.clickButton('Publish Post', { within: '[data-testid="community-composer-card"]' });

    await page.waitForText('Post Published');
    await page.waitForText('E2E Vermicompost Top Dressing Note');

    // Like & comment on the newly published post (first card in feed or find matching card)
    await page.clickElementFromFn(
      () => {
        const cards = Array.from(document.querySelectorAll('[data-testid^="community-post-"]'));
        const card = cards.find((c) => (c.innerText || '').includes('E2E Vermicompost Top Dressing Note'));
        return card ? Array.from(card.querySelectorAll('button')).find((b) => (b.innerText || '').includes('Like (')) : null;
      },
      'Like button on created post not found'
    );
    await page.waitFor(
      () => {
        const cards = Array.from(document.querySelectorAll('[data-testid^="community-post-"]'));
        const card = cards.find((c) => (c.innerText || '').includes('E2E Vermicompost Top Dressing Note'));
        return Boolean(card && (card.innerText || '').includes('Like (1)'));
      },
      { message: 'Post like count did not increment to 1' }
    );

    await page.clickElementFromFn(
      () => {
        const cards = Array.from(document.querySelectorAll('[data-testid^="community-post-"]'));
        const card = cards.find((c) => (c.innerText || '').includes('E2E Vermicompost Top Dressing Note'));
        return card ? Array.from(card.querySelectorAll('button')).find((b) => (b.innerText || '').includes('Comments (')) : null;
      },
      'Comments toggle on created post not found'
    );

    await page.waitFor(
      () => Boolean(document.querySelector('input[placeholder="Write a comment..."]'))
    );
    const commentInputExists = await page.eval(() => {
      const el = document.querySelector('input[placeholder="Write a comment..."]');
      if (!el) return false;
      el.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, 'Looking forward to the harvest weight update!');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    });
    assert.ok(commentInputExists);

    await page.clickButton('Post Comment');
    await page.waitForText('Looking forward to the harvest weight update!');

    assertCleanRuntime(page);
  });
});
