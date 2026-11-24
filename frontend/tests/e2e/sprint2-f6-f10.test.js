import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createSuiteSession, assertCleanRuntime, loginAsDemo } from '../helpers/e2e-context.js';

const DEMO_BED_DEVICE_KEY = 'sg_live_demo_south_bed_node_01_abcdef1234567890';

async function apiRequest(baseUrl, apiPath, { method = 'GET', token, deviceKey, cronSecret, body } = {}) {
  const normalized = apiPath.startsWith('/api') ? apiPath : `/api${apiPath.startsWith('/') ? '' : '/'}${apiPath}`;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (deviceKey) headers['X-Device-Key'] = deviceKey;
  if (cronSecret) headers['X-Cron-Secret'] = cronSecret;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${baseUrl}${normalized}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function getSeededWaterTabName() {
  const utcToday = new Date().toISOString().slice(0, 10);
  const laToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
  if (utcToday === laToday) return 'Today';
  return utcToday > laToday ? 'Upcoming' : 'Overdue';
}

describe('E2E: Sprint 2 F6-F10 Live Operations, Telemetry, Realtime, Alerts, Automations & RBAC', () => {
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

  it('F6: Care Tasks CRUD, recurrence auto-reschedule, water logging & ZonePlantsView Care Tasks tab', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/dashboard/care-tasks?gardenId=1`);
    await page.waitForText('Care Tasks & Watering');
    await page.waitForText('Sunny Backyard Oasis');

    // Verify seeded Sprint 2 care tasks & water usage logs
    const seededTab = getSeededWaterTabName();
    if (seededTab !== 'Today') {
      await page.clickButton(seededTab);
    }
    await page.waitForText('Deep water cherry tomatoes and basil border');

    await page.clickButton('Upcoming');
    await page.waitForText('Apply organic kelp emulsion around tomato base');

    await page.clickButton('Completed');
    await page.waitForText('Completed baseline irrigation cycle');
    await page.waitForText('Total: 13.5 L');

    // Create a recurring WATER task due today (defaults to garden timezone today)
    await page.clickButton('Today');
    await page.clickSelector('[data-testid="create-task-btn"]');
    await page.waitForText('Create Care Task');

    await page.fillByLabel('Recurrence (Days)', '4', { within: '[role="dialog"]' });
    await page.fillByLabel('Notes', 'E2E Recurring Soak', { within: '[role="dialog"]' });
    await page.clickButton('Create Task', { within: '[role="dialog"]' });
    await page.waitForTextGone('Create Care Task');

    await page.waitFor(
      () =>
        Array.from(document.querySelectorAll('[data-testid="task-row"]')).some((r) =>
          (r.innerText || '').includes('E2E Recurring Soak')
        ),
      { message: 'Newly created E2E Recurring Soak task row not found' }
    );

    // Complete WATER task -> logs 6.5 L and spawns next recurring task (+4d)
    await page.clickElementFromFn(
      () => {
        const row = Array.from(document.querySelectorAll('[data-testid="task-row"]')).find((r) =>
          (r.innerText || '').includes('E2E Recurring Soak')
        );
        return row ? row.querySelector('[data-testid="complete-task-btn"]') : null;
      },
      'Complete button for E2E Recurring Soak not found'
    );
    await page.waitForText('Complete Watering Task');
    await page.fillInput('[role="dialog"] [data-testid="water-volume-input"]', '6.5');
    await page.selectByLabel('Irrigation Method', 'Drip Irrigation', { within: '[role="dialog"]' });
    await page.fillByLabel('Watering Notes', 'E2E Drip Run', { within: '[role="dialog"]' });
    await page.clickButton('Complete & Log', { within: '[role="dialog"]' });

    await page.waitForText('Watering task completed');
    await page.waitForText('Total: 20.0 L');
    await page.waitForText('E2E Drip Run');

    // Verify auto-rescheduled task in Upcoming and completed task in Completed
    await page.clickButton('Upcoming');
    await page.waitFor(
      () =>
        Array.from(document.querySelectorAll('[data-testid="task-row"]')).some((r) =>
          (r.innerText || '').includes('E2E Recurring Soak') && (r.innerText || '').includes('Every 4d')
        ),
      { message: 'Auto-rescheduled recurring task not found in Upcoming tab' }
    );
    await page.clickElementFromFn(
      () => {
        const row = Array.from(document.querySelectorAll('[data-testid="task-row"]')).find((r) =>
          (r.innerText || '').includes('E2E Recurring Soak')
        );
        return row ? row.querySelector('button[aria-label="Delete task"]') : null;
      },
      'Delete button for rescheduled E2E Recurring Soak not found'
    );
    await page.waitForText('Task deleted');

    await page.clickButton('Completed');
    await page.waitFor(
      () =>
        Array.from(document.querySelectorAll('[data-testid="task-row"]')).some((r) =>
          (r.innerText || '').includes('E2E Recurring Soak') && (r.innerText || '').includes('6.5 L applied')
        ),
      { message: 'Completed E2E Recurring Soak with 6.5 L applied not found in Completed tab' }
    );
    await page.clickElementFromFn(
      () => {
        const row = Array.from(document.querySelectorAll('[data-testid="task-row"]')).find((r) =>
          (r.innerText || '').includes('E2E Recurring Soak')
        );
        return row ? row.querySelector('button[aria-label="Delete task"]') : null;
      },
      'Delete button for completed E2E Recurring Soak not found'
    );
    await page.waitForText('Task deleted');

    // Manual water log modal
    await page.clickButton('Log Water Usage');
    await page.waitForText('Record standalone irrigation volume for a zone.');
    await page.fillByLabel('Liters Applied', '2.5', { within: '[role="dialog"]' });
    await page.fillByLabel('Notes', 'E2E Manual Can', { within: '[role="dialog"]' });
    await page.clickButton('Save Water Log', { within: '[role="dialog"]' });
    await page.waitForText('Total: 22.5 L');
    await page.waitForText('E2E Manual Can');

    // ZonePlantsView Care Tasks tab
    await page.goto(`${session.baseUrl}/dashboard/zones/1/plants`);
    await page.waitForText('South Raised Bed');
    await page.clickButton('Care Tasks', { within: '[role="tablist"]' });
    await page.waitForText('Zone Care Tasks (F6)');

    await page.clickSelector('[data-testid="create-task-btn"]');
    await page.waitForText('Create Zone Care Task');
    await page.selectByLabel('Task Type', 'FERTILIZE', { within: '[role="dialog"]' });
    await page.fillByLabel('Notes', 'E2E Zone Tab Feed', { within: '[role="dialog"]' });
    await page.clickButton('Create Task', { within: '[role="dialog"]' });
    await page.waitForText('E2E Zone Tab Feed');

    await page.clickElementFromFn(
      () => {
        const row = Array.from(document.querySelectorAll('[data-testid="task-row"]')).find((r) =>
          (r.innerText || '').includes('E2E Zone Tab Feed')
        );
        return row ? row.querySelector('[data-testid="complete-task-btn"]') : null;
      },
      'Complete button for E2E Zone Tab Feed not found'
    );
    await page.waitForText('Task completed');

    await page.clickButton('Completed');
    await page.waitForText('E2E Zone Tab Feed');
    await page.clickElementFromFn(
      () => {
        const row = Array.from(document.querySelectorAll('[data-testid="task-row"]')).find((r) =>
          (r.innerText || '').includes('E2E Zone Tab Feed')
        );
        return row ? row.querySelector('button[aria-label="Delete task"]') : null;
      },
      'Delete button for E2E Zone Tab Feed not found'
    );
    await page.waitForTextGone('E2E Zone Tab Feed');

    assertCleanRuntime(page);
  });

  it('F7: Device registration, once-shown sg_live_ key, ingest validation, key rotation, revocation & TelemetryChart', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/dashboard/sensors?gardenId=1`);
    await page.waitForText('IoT Sensors & Telemetry');
    await page.waitForText('Sunny Backyard Oasis');
    await page.waitForText('SG-DEMO-BED-01');
    await page.waitForText('ONLINE');

    const hasChart = await page.eval(() => Boolean(document.querySelector('[data-testid="telemetry-chart"] svg')));
    assert.ok(hasChart, 'Expected TelemetryChart SVG on SensorsView');
    const rowCount = await page.eval(() => document.querySelectorAll('[data-testid="sensor-reading-row"]').length);
    assert.ok(rowCount >= 1, 'Expected seeded sensor reading rows');

    // Metric & timeframe switches on TelemetryChart
    await page.clickButton('Temperature', { within: '[data-testid="telemetry-chart"]' });
    await page.waitFor(
      () => document.querySelector('[data-testid="telemetry-chart"] svg[aria-label="Temperature telemetry chart"]'),
      { message: 'TelemetryChart did not switch aria-label to Temperature telemetry chart' }
    );
    await page.clickButton('30d Daily');
    await page.waitForText('30-Day Daily Aggregates');
    await page.waitFor(
      () => document.querySelectorAll('[data-testid="sensor-reading-row"]').length === 7,
      { message: 'Expected 7 seeded daily aggregate rows in 30d Daily view' }
    );
    await page.clickButton('24h');
    await page.waitForText('Recent Sensor Readings');
    await page.clickButton('Soil Moisture', { within: '[data-testid="telemetry-chart"]' });

    // Register E2E device
    await page.clickSelector('[data-testid="register-device-btn"]');
    await page.waitForText('Add Sensor Device');
    await page.fillByLabel('Device Name', 'E2E Probe Alpha', { within: '[role="dialog"]' });
    await page.selectByLabel('Device Type', 'Simulator (SIMULATOR)', { within: '[role="dialog"]' });
    await page.clickButton('Register Device', { within: '[role="dialog"]' });

    await page.waitFor(
      () => Boolean(document.querySelector('[data-testid="device-key-banner"] code')),
      { message: 'One-time device key banner did not appear' }
    );
    const key1 = await page.eval(
      () => document.querySelector('[data-testid="device-key-banner"] code')?.innerText?.trim() || ''
    );
    assert.ok(key1.startsWith('sg_live_'), `Expected sg_live_ key, got "${key1}"`);

    // Valid ingest + out-of-range 400 validation
    const ingestOk = await apiRequest(session.baseUrl, '/sensors/ingest', {
      method: 'POST',
      deviceKey: key1,
      body: {
        soilMoisture: 52.4,
        temperature: 22.8,
        humidity: 60.2,
        lightLux: 21000,
        batteryPercent: 94,
        signalRssi: -58
      }
    });
    assert.equal(ingestOk.status, 201);
    assert.equal(ingestOk.json?.data?.status, 'PROCESSED');

    const ingestBad = await apiRequest(session.baseUrl, '/sensors/ingest', {
      method: 'POST',
      deviceKey: key1,
      body: {
        soilMoisture: 150,
        temperature: 22,
        humidity: 60,
        lightLux: 1000
      }
    });
    assert.equal(ingestBad.status, 400);
    assert.equal(ingestBad.json?.error?.code, 'METRIC_OUT_OF_RANGE');

    // Rotate key on E2E Probe Alpha
    await page.clickElementFromFn(
      () => {
        const rows = Array.from(document.querySelectorAll('tr'));
        const row = rows.find((r) => (r.innerText || '').includes('E2E Probe Alpha'));
        return row ? row.querySelector('[data-testid="rotate-key-btn"]') : null;
      },
      'Rotate key button for E2E Probe Alpha not found'
    );
    await page.waitForText('Device key rotated');
    const key2 = await page.eval(
      () => document.querySelector('[data-testid="device-key-banner"] code')?.innerText?.trim() || ''
    );
    assert.ok(key2.startsWith('sg_live_'), `Expected rotated sg_live_ key, got "${key2}"`);
    assert.notEqual(key2, key1, 'Rotated key must differ from initial key');

    const oldKeyIngest = await apiRequest(session.baseUrl, '/sensors/ingest', {
      method: 'POST',
      deviceKey: key1,
      body: { soilMoisture: 50, temperature: 22, humidity: 58, lightLux: 18000 }
    });
    assert.equal(oldKeyIngest.status, 401);

    const newKeyIngest = await apiRequest(session.baseUrl, '/sensors/ingest', {
      method: 'POST',
      deviceKey: key2,
      body: { soilMoisture: 51.2, temperature: 22.4, humidity: 59, lightLux: 19000 }
    });
    assert.equal(newKeyIngest.status, 201);

    // Dismiss once-shown banner & verify reload does not show key again
    await page.clickButton('Dismiss', { within: '[data-testid="device-key-banner"]' });
    await page.waitForTextGone('Device API Key Generated');
    await page.goto(`${session.baseUrl}/dashboard/sensors?gardenId=1`);
    await page.waitForText('E2E Probe Alpha');
    const bannerAfterReload = await page.eval(() => Boolean(document.querySelector('[data-testid="device-key-banner"]')));
    assert.equal(bannerAfterReload, false, 'Once-shown key banner must not reappear on reload');

    // Revoke E2E Probe Alpha
    await page.clickElementFromFn(
      () => {
        const rows = Array.from(document.querySelectorAll('tr'));
        const row = rows.find((r) => (r.innerText || '').includes('E2E Probe Alpha'));
        return row ? row.querySelector('[data-testid="revoke-device-btn"]') : null;
      },
      'Revoke button for E2E Probe Alpha not found'
    );
    await page.waitForText('Revoke Device Key');
    await page.clickButton('Revoke Device', { within: '[role="dialog"]' });
    await page.waitForText('Device revoked');

    const revokedRowText = await page.eval(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const row = rows.find((r) => (r.innerText || '').includes('E2E Probe Alpha'));
      return row ? row.innerText : '';
    });
    assert.ok(revokedRowText.includes('REVOKED'), `Expected REVOKED badge on row, got: ${revokedRowText}`);

    const revokedIngest = await apiRequest(session.baseUrl, '/sensors/ingest', {
      method: 'POST',
      deviceKey: key2,
      body: { soilMoisture: 50, temperature: 22, humidity: 58, lightLux: 18000 }
    });
    assert.equal(revokedIngest.status, 401);

    assertCleanRuntime(page);
  });

  it('F8: Real-time WebSocket live status, sensor telemetry & alert UI updates without page reload', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/dashboard`);
    await page.waitForText('Welcome back, Demo Gardener');

    const needsOverviewSwitch = await page.eval(() =>
      Array.from(document.querySelectorAll('button[role="combobox"]')).some((b) =>
        (b.innerText || '').includes('Urban Balcony & Indoor Studio')
      )
    );
    if (needsOverviewSwitch) {
      await page.clickElementFromFn(
        () =>
          Array.from(document.querySelectorAll('button[role="combobox"]')).find((b) =>
            (b.innerText || '').includes('Urban Balcony & Indoor Studio')
          ) || null,
        'Overview Live Garden selector not found'
      );
      await page.clickElementFromFn(
        () =>
          Array.from(document.querySelectorAll('[role="option"]')).find((o) =>
            (o.innerText || '').includes('Sunny Backyard Oasis')
          ) || null,
        'Sunny Backyard Oasis option not found in Overview selector'
      );
    }

    await page.waitFor(
      () => {
        const badge = document.querySelector('[data-testid="realtime-status-badge"]')?.innerText || '';
        const sensors = document.querySelector('[data-testid="overview-live-sensors"]')?.innerText || '';
        return badge.includes('Live') && sensors.includes('South Raised Bed');
      },
      { message: 'Expected Overview realtime badge to connect via WebSocket for Sunny Backyard Oasis' }
    );

    const beforeUnread = await page.eval(() => {
      const el = document.querySelector('[data-testid="alert-unread-badge"]');
      return el ? Number(el.innerText.trim()) : 0;
    });

    // Ingest low soil moisture (<35%) with safe temperature (22.5°C) to trigger SENSOR_UPDATE + 1 ALERT_TRIGGERED over WS
    const ingestAlertRes = await apiRequest(session.baseUrl, '/sensors/ingest', {
      method: 'POST',
      deviceKey: DEMO_BED_DEVICE_KEY,
      body: { soilMoisture: 19.3, temperature: 22.5, humidity: 41.0, lightLux: 29500 }
    });
    assert.equal(ingestAlertRes.status, 201);

    await page.waitFor(
      () => {
        const txt = document.querySelector('[data-testid="overview-live-sensors"]')?.innerText || '';
        return txt.includes('19.3%') && txt.includes('22.5°C');
      },
      { message: 'Overview live sensors card did not update via WS without reload' }
    );
    await page.waitForText('Alert: South Raised Bed');

    await page.waitFor(
      (prev) => {
        const el = document.querySelector('[data-testid="alert-unread-badge"]');
        return el && Number(el.innerText.trim()) >= prev + 1;
      },
      { message: 'Unread alert badge did not increment via WS without reload' },
      beforeUnread
    );

    // SensorsView live WS update without reload
    await page.goto(`${session.baseUrl}/dashboard/sensors?gardenId=1`);
    await page.waitForText('Sunny Backyard Oasis');
    await page.waitFor(
      () => (document.querySelector('[data-testid="realtime-status-badge"]')?.innerText || '').includes('Live (WS)'),
      { message: 'Expected SensorsView realtime status badge to display Live (WS)' }
    );

    const ingestSafeRes = await apiRequest(session.baseUrl, '/sensors/ingest', {
      method: 'POST',
      deviceKey: DEMO_BED_DEVICE_KEY,
      body: { soilMoisture: 54.6, temperature: 21.7, humidity: 63.0, lightLux: 18400 }
    });
    assert.equal(ingestSafeRes.status, 201);

    await page.waitFor(
      () => {
        const firstRow = document.querySelector('[data-testid="sensor-reading-row"]')?.innerText || '';
        return firstRow.includes('54.6%') && document.body.innerText.includes('54.6%');
      },
      { message: 'SensorsView gauge & readings table did not update to 54.6% via WS without reload' }
    );

    assertCleanRuntime(page);
  });

  it('F9: AlertsView thresholds, quiet hours suppression, bell popover & mark read / read-all', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/dashboard`);
    await page.waitForText('Welcome back, Demo Gardener');

    // Bell popover -> View all alerts
    await page.clickSelector('[data-testid="alert-bell-btn"]');
    await page.waitForText('Unread Alerts');
    await page.clickButton('View all alerts');
    await page.waitForUrl('/dashboard/alerts');
    await page.waitForText('Smart Threshold Alerts');
    await page.selectByLabel('Garden', 'Sunny Backyard Oasis');
    await page.waitForText('Catalog plant baseline for SOIL_MOISTURE:');

    // Switch to TEMPERATURE metric to avoid SOIL_MOISTURE cooldown and configure 00:00-23:59 quiet hours
    await page.selectByLabel('Metric', 'Temperature (°C)', { within: '[data-testid="alert-config-form"]' });
    await page.waitForText('Catalog plant baseline for TEMPERATURE:');
    await page.fillByLabel('Min Threshold', '18', { within: '[data-testid="alert-config-form"]' });
    await page.fillByLabel('Max Threshold', '25', { within: '[data-testid="alert-config-form"]' });
    await page.fillByLabel('Cooldown (Minutes)', '1', { within: '[data-testid="alert-config-form"]' });

    const quietChecked = await page.eval(
      () => document.querySelector('[data-testid="quiet-hours-toggle"]')?.getAttribute('aria-checked') === 'true'
    );
    if (!quietChecked) {
      await page.clickSelector('[data-testid="quiet-hours-toggle"]');
    }
    await page.waitForText('Quiet Start (HH:mm)');
    await page.fillByLabel('Quiet Start (HH:mm)', '00:00', { within: '[data-testid="alert-config-form"]' });
    await page.fillByLabel('Quiet End (HH:mm)', '23:59', { within: '[data-testid="alert-config-form"]' });
    await page.clickButton('Save Alert Configuration', { within: '[data-testid="alert-config-form"]' });
    await page.waitForText('Alert configuration saved');

    // Trigger TEMPERATURE breach -> suppressed by quiet hours
    const breachRes = await apiRequest(session.baseUrl, '/sensors/ingest', {
      method: 'POST',
      deviceKey: DEMO_BED_DEVICE_KEY,
      body: { soilMoisture: 55, temperature: 39.5, humidity: 60, lightLux: 15000 }
    });
    assert.equal(breachRes.status, 201);

    await page.goto(`${session.baseUrl}/dashboard/alerts?gardenId=1`);
    await page.waitForText('Smart Threshold Alerts');
    await page.waitForText('Sunny Backyard Oasis');
    await page.clickButton('Suppressed (Quiet Hours)');
    await page.waitForText('Quiet Hours Suppressed');

    // Restore TEMPERATURE quiet hours to default overnight window
    await page.selectByLabel('Metric', 'Temperature (°C)', { within: '[data-testid="alert-config-form"]' });
    await page.fillByLabel('Quiet Start (HH:mm)', '22:00', { within: '[data-testid="alert-config-form"]' });
    await page.fillByLabel('Quiet End (HH:mm)', '07:00', { within: '[data-testid="alert-config-form"]' });
    await page.clickButton('Save Alert Configuration', { within: '[data-testid="alert-config-form"]' });
    await page.waitForText('Alert configuration saved');

    // Mark single alert read, then Mark All Read
    await page.clickButton('All Alerts');
    await page.waitFor(
      () => Boolean(document.querySelector('[data-testid="mark-alert-read-btn"]')),
      { message: 'Expected at least one unread alert with Mark Read button' }
    );
    const beforeUnread = await page.eval(() => {
      const el = document.querySelector('[data-testid="alert-unread-badge"]');
      return el ? Number(el.innerText.trim()) : 0;
    });
    await page.clickSelector('[data-testid="mark-alert-read-btn"]');
    await page.waitFor(
      (prev) => {
        const el = document.querySelector('[data-testid="alert-unread-badge"]');
        const now = el ? Number(el.innerText.trim()) : 0;
        return now === Math.max(0, prev - 1);
      },
      { message: 'Unread badge did not decrement after marking one alert read' },
      beforeUnread
    );

    const hasRemainingUnread = await page.eval(() => Boolean(document.querySelector('[data-testid="mark-all-read-btn"]')));
    if (hasRemainingUnread) {
      await page.clickSelector('[data-testid="mark-all-read-btn"]');
      await page.waitForText('All alerts marked as read');
    }

    await page.clickButton('Unread Only');
    await page.waitForText('No alerts match the current filter');
    const badgeExists = await page.eval(() => Boolean(document.querySelector('[data-testid="alert-unread-badge"]')));
    assert.equal(badgeExists, false, 'Alert unread badge should disappear when all alerts are read');

    assertCleanRuntime(page);
  });

  it('F10: AutomationsView rule builder, toggle, edit, cron evaluation & daily execution cap', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/dashboard/automations?gardenId=1`);
    await page.waitForText('Automation Rule Engine');
    await page.waitForText('Sunny Backyard Oasis');
    await page.waitForText('Auto-Schedule Watering When Dry');
    await page.waitForText('0 / 3 today');

    // Create rule using PRUNE task_type so Zone 1 seeded WATER/FERTILIZE tasks do not deduplicate it
    await page.clickSelector('[data-testid="create-rule-btn"]');
    await page.waitForText('Create Automation Rule');
    await page.fillByLabel('Rule Name', 'E2E Low Humidity Mist', { within: '[role="dialog"]' });
    await page.selectByLabel('IF Metric', 'Humidity (%)', { within: '[role="dialog"]' });
    await page.selectByLabel('Operator', 'Less Than (<)', { within: '[role="dialog"]' });
    await page.fillByLabel('Threshold Value', '45', { within: '[role="dialog"]' });
    await page.selectByLabel('AND Weather Condition', 'Any Weather (ANY)', { within: '[role="dialog"]' });
    await page.selectByLabel('THEN Action', 'Create Care Task (CREATE_TASK)', { within: '[role="dialog"]' });
    await page.selectByLabel('Task Type to Create', 'PRUNE', { within: '[role="dialog"]' });
    await page.fillByLabel('Cooldown (Minutes)', '15', { within: '[role="dialog"]' });
    await page.fillByLabel('Max Daily Executions', '2', { within: '[role="dialog"]' });

    const previewText = await page.eval(() => document.querySelector('[role="dialog"]')?.innerText || '');
    assert.ok(
      previewText.includes('IF HUMIDITY<45% AND Any Weather THEN Create PRUNE Task') ||
        previewText.includes('IF HUMIDITY < 45% AND Any Weather THEN Create PRUNE Task'),
      `Unexpected rule dialog preview text: ${previewText}`
    );
    await page.clickButton('Create Rule', { within: '[role="dialog"]' });
    await page.waitForText('Automation rule created');
    await page.waitForText('E2E Low Humidity Mist');
    await page.waitForText('0 / 2 today');

    // Toggle rule pause/enable specifically on E2E Low Humidity Mist row
    await page.clickElementFromFn(
      () => {
        const row = Array.from(document.querySelectorAll('[data-testid="rule-row"]')).find((r) =>
          (r.innerText || '').includes('E2E Low Humidity Mist')
        );
        return row ? row.querySelector('[data-testid="rule-toggle-switch"]') : null;
      },
      'Toggle switch for E2E Low Humidity Mist not found'
    );
    await page.waitForText('Rule paused');

    await page.clickElementFromFn(
      () => {
        const row = Array.from(document.querySelectorAll('[data-testid="rule-row"]')).find((r) =>
          (r.innerText || '').includes('E2E Low Humidity Mist')
        );
        return row ? row.querySelector('[data-testid="rule-toggle-switch"]') : null;
      },
      'Toggle switch for E2E Low Humidity Mist not found (re-enable)'
    );
    await page.waitForText('Rule enabled');

    // Edit rule threshold 45 -> 48
    await page.clickElementFromFn(
      () => {
        const row = Array.from(document.querySelectorAll('[data-testid="rule-row"]')).find((r) =>
          (r.innerText || '').includes('E2E Low Humidity Mist')
        );
        return row ? row.querySelector('button[aria-label="Edit rule"]') : null;
      },
      'Edit button for E2E Low Humidity Mist not found'
    );
    await page.waitForText('Edit Automation Rule');
    await page.fillByLabel('Threshold Value', '48', { within: '[role="dialog"]' });
    await page.clickButton('Save Rule', { within: '[role="dialog"]' });
    await page.waitForText('Automation rule updated');
    await page.waitForText('48%');

    // Ingest humidity=32 (<48) and evaluate rules via cron endpoint
    const ingestRes = await apiRequest(session.baseUrl, '/sensors/ingest', {
      method: 'POST',
      deviceKey: DEMO_BED_DEVICE_KEY,
      body: { soilMoisture: 55, temperature: 22, humidity: 32, lightLux: 15000 }
    });
    assert.equal(ingestRes.status, 201);

    const cronSecret = process.env.CRON_SECRET || 'e2e_cron_secret_at_least_32_characters_long';
    const eval1 = await apiRequest(session.baseUrl, '/jobs/evaluate-rules', {
      method: 'POST',
      cronSecret
    });
    assert.equal(eval1.status, 200);
    assert.ok((eval1.json?.data?.triggered || 0) >= 1, `Expected triggered >= 1, got ${JSON.stringify(eval1.json)}`);

    // Immediate second run must skip due to open PRUNE task without burning daily cap
    const eval2 = await apiRequest(session.baseUrl, '/jobs/evaluate-rules', {
      method: 'POST',
      cronSecret
    });
    assert.equal(eval2.status, 200);

    await page.goto(`${session.baseUrl}/dashboard/automations?gardenId=1`);
    await page.waitForText('E2E Low Humidity Mist');
    const execText = await page.eval(() => {
      const row = Array.from(document.querySelectorAll('[data-testid="rule-row"]')).find((r) =>
        (r.innerText || '').includes('E2E Low Humidity Mist')
      );
      return row?.querySelector('[data-testid="rule-executions-badge"]')?.innerText?.trim() || '';
    });
    assert.equal(execText, '1 / 2 today');

    // Delete E2E rule and clean up the PRUNE task it created
    await page.clickElementFromFn(
      () => {
        const row = Array.from(document.querySelectorAll('[data-testid="rule-row"]')).find((r) =>
          (r.innerText || '').includes('E2E Low Humidity Mist')
        );
        return row ? row.querySelector('button[aria-label="Delete rule"]') : null;
      },
      'Delete button for E2E Low Humidity Mist not found'
    );
    await page.waitForText('Automation rule deleted');
    await page.waitForTextGone('E2E Low Humidity Mist');

    const ownerToken = await page.eval(() => localStorage.getItem('sg_token'));
    const tasksRes = await apiRequest(session.baseUrl, '/zones/1/tasks', { token: ownerToken });
    for (const t of tasksRes.json?.data?.tasks || []) {
      if (t.task_type === 'PRUNE' && String(t.notes || '').includes('E2E Low Humidity Mist')) {
        await apiRequest(session.baseUrl, `/zones/1/tasks/${t.id}`, { method: 'DELETE', token: ownerToken });
      }
    }

    assertCleanRuntime(page);
  });

  it('Sprint 2 RBAC Matrix: GUEST member gets read-only UI and HTTP 403 across F6-F10 mutations & rules', async () => {
    page.clearDiagnostics();
    const guestEmail = `e2e-s2-guest-${Date.now()}@smartgarden.test`;
    const guestPage = await session.browser.newPage();

    try {
      await guestPage.goto(`${session.baseUrl}/register`);
      await guestPage.waitForText('Create your SmartGarden account');
      await guestPage.fillByLabel('Full Name', 'E2E S2 Guest');
      await guestPage.fillByLabel('Email address', guestEmail);
      await guestPage.fillByLabel('Password (min 8 characters)', 'GuestPass123!');
      await guestPage.clickButton('Create account');
      await guestPage.waitForUrl('/dashboard');
      await guestPage.waitForText('Welcome back, E2E S2 Guest');

      // Owner invites guest as GUEST on Garden 1
      await page.goto(`${session.baseUrl}/dashboard/gardens/1`);
      await page.waitForText('Sunny Backyard Oasis');
      await page.clickButton('Invitations');
      await page.waitForText('Invite Collaborator');
      await page.fillByLabel('Collaborator Email', guestEmail);
      await page.selectByLabel('Role', 'GUEST');
      await page.clickButton('Send Invite');
      await page.waitForText('Shareable Invitation Link Created');

      const invitePath = await page.eval(() => document.querySelector('code')?.innerText?.trim() || '');
      const fullInviteUrl = invitePath.startsWith('http') ? invitePath : `${session.baseUrl}${invitePath}`;

      await guestPage.goto(fullInviteUrl);
      await guestPage.waitForText('Garden Collaboration Invitation');
      await guestPage.clickButton('Accept Invitation');
      await guestPage.waitForUrl('/dashboard/gardens/1');
      await guestPage.waitForText('Sunny Backyard Oasis');

      guestPage.clearDiagnostics();

      // F6 CareTasksView guest read-only
      await guestPage.goto(`${session.baseUrl}/dashboard/care-tasks?gardenId=1`);
      await guestPage.waitForText('Read-Only Guest Access');
      const taskBtns = await guestPage.eval(() => ({
        create: Boolean(document.querySelector('[data-testid="create-task-btn"]')),
        complete: Boolean(document.querySelector('[data-testid="complete-task-btn"]'))
      }));
      assert.deepEqual(taskBtns, { create: false, complete: false });

      // F7 SensorsView guest read-only
      await guestPage.goto(`${session.baseUrl}/dashboard/sensors?gardenId=1`);
      await guestPage.waitForText('SG-DEMO-BED-01');
      const sensorBtns = await guestPage.eval(() => ({
        register: Boolean(document.querySelector('[data-testid="register-device-btn"]')),
        rotate: Boolean(document.querySelector('[data-testid="rotate-key-btn"]')),
        revoke: Boolean(document.querySelector('[data-testid="revoke-device-btn"]'))
      }));
      assert.deepEqual(sensorBtns, { register: false, rotate: false, revoke: false });

      // F9 AlertsView guest read-only config
      await guestPage.goto(`${session.baseUrl}/dashboard/alerts?gardenId=1`);
      await guestPage.waitForText('Owner Permissions Required to Edit');
      const hasSaveConfigBtn = await guestPage.eval(() =>
        Array.from(document.querySelectorAll('button')).some((b) => (b.innerText || '').includes('Save Alert Configuration'))
      );
      assert.equal(hasSaveConfigBtn, false);

      // F10 AutomationsView guest restricted (403 on GET /zones/1/rules)
      await guestPage.goto(`${session.baseUrl}/dashboard/automations?gardenId=1`);
      await guestPage.waitForText('Guest Access Restricted');
      const hasCreateRuleBtn = await guestPage.eval(() => Boolean(document.querySelector('[data-testid="create-rule-btn"]')));
      assert.equal(hasCreateRuleBtn, false);

      // Direct API RBAC 403 checks as GUEST
      const guestToken = await guestPage.eval(() => localStorage.getItem('sg_token'));
      assert.ok(guestToken, 'Expected guest token in localStorage');

      const r1 = await apiRequest(session.baseUrl, '/zones/1/tasks', {
        method: 'POST',
        token: guestToken,
        body: { task_type: 'WATER', due_date: '2026-11-24' }
      });
      assert.equal(r1.status, 403);

      const r2 = await apiRequest(session.baseUrl, '/zones/1/devices', {
        method: 'POST',
        token: guestToken,
        body: { device_name: 'Forbidden Node' }
      });
      assert.equal(r2.status, 403);

      const r3 = await apiRequest(session.baseUrl, '/zones/1/alerts/config', {
        method: 'PUT',
        token: guestToken,
        body: { metric: 'SOIL_MOISTURE', min_threshold: 30, max_threshold: 80 }
      });
      assert.equal(r3.status, 403);

      const r4 = await apiRequest(session.baseUrl, '/zones/1/rules', {
        method: 'GET',
        token: guestToken
      });
      assert.equal(r4.status, 403);

      const r5 = await apiRequest(session.baseUrl, '/zones/1/rules', {
        method: 'POST',
        token: guestToken,
        body: {
          name: 'Forbidden Rule',
          metric: 'SOIL_MOISTURE',
          operator: 'LT',
          threshold_value: 30,
          weather_condition: 'ANY',
          action_type: 'SEND_ALERT'
        }
      });
      assert.equal(r5.status, 403);

      assertCleanRuntime(guestPage, { allow4xxConsole: true });

      // Remove guest member from Garden 1
      await page.clickButton('Members');
      await page.waitForText('E2E S2 Guest');
      await page.clickElementFromFn(
        (email) => {
          const rows = Array.from(document.querySelectorAll('tr'));
          const row = rows.find((r) => (r.innerText || '').includes(email));
          if (!row) return null;
          return Array.from(row.querySelectorAll('button')).find((b) => (b.innerText || '').includes('Remove')) || null;
        },
        `Remove button for ${guestEmail} not found`,
        guestEmail
      );
      await page.waitForText('Member removed');
      await page.waitForTextGone(guestEmail);

      assertCleanRuntime(page);
    } finally {
      await guestPage.close();
    }
  });
});
