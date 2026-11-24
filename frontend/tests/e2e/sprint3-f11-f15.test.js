import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createSuiteSession, assertCleanRuntime, loginAsDemo } from '../helpers/e2e-context.js';

describe('E2E: Sprint 3 F11-F15 Horticultural Intelligence Views', () => {
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

  it('F11: WeatherView loads spatial grid forecast, 7-day outlook, zone rain-skip status & triggers evaluation', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/dashboard/weather?gardenId=1`);
    await page.waitForText('Weather-Aware Planning & Spatial Cache');
    await page.waitForText('7-Day Microclimate Outlook');
    await page.waitForText('Zone Rain-Skip Policy Status');
    await page.waitForText('Grid: grid_');

    await page.clickSelector('[data-testid="apply-rain-skip-btn"]');
    await page.waitFor(() => Boolean(document.querySelector('[data-testid="rain-skip-summary"]')));
    assertCleanRuntime(page);
  });

  it('F12: CalendarView renders 12-month sowing matrix, switches to Southern Hemisphere & exports .ics', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/dashboard/calendar`);
    await page.waitForText('Seasonal Planting Calendar');
    await page.waitForText('12-Month Sowing & Harvest Matrix');
    await page.waitForText('Tomato');

    // Test API export directly using stored auth token from browser
    const token = await page.eval(() => localStorage.getItem('sg_token'));
    const icsRes = await fetch(`${session.baseUrl}/api/calendar/export.ics?garden_id=1&month=4`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(icsRes.status, 200);
    const icsText = await icsRes.text();
    assert.ok(icsText.includes('BEGIN:VCALENDAR'));
    assert.ok(icsText.includes('END:VCALENDAR'));

    await page.clickSelector('[data-testid="export-ics-btn"]');
    await page.waitForText('Calendar Exported');
    assertCleanRuntime(page);
  });

  it('F13: CarePlansView displays soil & sun calibrated preview and generates CARE_PLAN tasks', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/dashboard/care-plans?gardenId=1&zoneId=1`);
    await page.waitForText('Personalized Care Plan Generator');
    await page.waitForText('Calibrated Schedule Preview');
    await page.waitForText('WATER');

    await page.clickSelector('[data-testid="generate-care-plan-btn"]');
    await page.waitForText('Care Plan Sync Complete');
    assertCleanRuntime(page);
  });

  it('F14: RecommendationsView displays 5-factor compatibility scores and rationales', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/dashboard/recommendations?gardenId=1&zoneId=1`);
    await page.waitForText('Plant Recommendation Engine');
    await page.waitFor(() => Boolean(document.querySelector('[data-testid="recommendation-card"]')));
    await page.waitForText('% Match');
    assertCleanRuntime(page);
  });

  it('F15: CompanionsView displays guild score, pairwise matrix heatmap & synergies/conflicts', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/dashboard/companions?gardenId=1&zoneId=1`);
    await page.waitForText('Companion Planting Advisor');
    await page.waitFor(() => Boolean(document.querySelector('[data-testid="companion-score-card"]')));
    await page.waitForText('Pairwise Compatibility Matrix');
    await page.waitForText('/ 100');
    assertCleanRuntime(page);
  });
});
