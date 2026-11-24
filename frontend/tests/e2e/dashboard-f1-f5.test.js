import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createSuiteSession, assertCleanRuntime, loginAsDemo } from '../helpers/e2e-context.js';

describe('E2E: Dashboard F1-F5 Live Flows (Overview, Gardens, Zones, Members, Zone Plants, Catalog, Settings)', () => {
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

  it('Overview (/dashboard) shows greeting, quick actions, live stat cards, My Gardens, and ComingSoon preview widgets', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/dashboard`);
    await page.waitForText('Welcome back, Demo Gardener');
    await page.waitForText('Sunny Backyard Oasis');
    await page.waitForText('Urban Balcony & Indoor Studio');

    const bodyLower = (await page.getBodyText()).toLowerCase();
    for (const label of ['Active Gardens', 'Microclimate Zones', 'Tracked Plantings', 'Total Plot Area']) {
      assert.ok(bodyLower.includes(label.toLowerCase()), `Overview missing stat card "${label}"`);
    }

    // Verify Sprint 2 live operational widgets + click Sprint 3 Weather Forecast ComingSoonModal
    const needsSwitch = await page.eval(() =>
      Array.from(document.querySelectorAll('button[role="combobox"]')).some((b) =>
        (b.innerText || '').includes('Urban Balcony & Indoor Studio')
      )
    );
    if (needsSwitch) {
      await page.clickElementFromFn(
        () =>
          Array.from(document.querySelectorAll('button[role="combobox"]')).find((b) =>
            (b.innerText || '').includes('Urban Balcony & Indoor Studio')
          ) || null,
        'Live Garden Operations select not found'
      );
      await page.clickElementFromFn(
        () =>
          Array.from(document.querySelectorAll('[role="option"]')).find((o) =>
            (o.innerText || '').includes('Sunny Backyard Oasis')
          ) || null,
        'Sunny Backyard Oasis option not found'
      );
    }

    await page.waitFor(
      () => {
        const badge = document.querySelector('[data-testid="realtime-status-badge"]');
        const sensors = document.querySelector('[data-testid="overview-live-sensors"]')?.innerText || '';
        return badge && (badge.innerText || '').includes('Live') && sensors.includes('South Raised Bed');
      },
      { message: 'Expected Overview realtime badge and South Raised Bed live sensors' }
    );
    const liveSensorsText = await page.eval(
      () => document.querySelector('[data-testid="overview-live-sensors"]')?.innerText || ''
    );
    assert.ok(liveSensorsText.includes('Live Sensor Readings'), 'Missing Live Sensor Readings card');
    assert.ok(liveSensorsText.includes('South Raised Bed'), 'Missing South Raised Bed telemetry');

    const liveTasksText = await page.eval(
      () => document.querySelector('[data-testid="overview-live-tasks"]')?.innerText || ''
    );
    assert.ok(liveTasksText.includes('Active Care Tasks'), 'Missing Active Care Tasks card');
    assert.ok(liveTasksText.includes('Deep water cherry tomatoes'), 'Missing seeded care task');

    const liveAlertsText = await page.eval(
      () => document.querySelector('[data-testid="overview-live-alerts"]')?.innerText || ''
    );
    assert.ok(liveAlertsText.includes('Recent Alerts'), 'Missing Recent Alerts card');
    assert.ok(liveAlertsText.includes('Soil moisture dropped below 35%'), 'Missing seeded alert');

    await page.clickElementFromFn(
      (title) => {
        const cards = Array.from(document.querySelectorAll('div'));
        return cards.find((el) => el.className.includes('cursor-pointer') && (el.innerText || '').includes(title)) || null;
      },
      'Preview widget "Multi-Channel Notifications" not found',
      'Multi-Channel Notifications'
    );
    await page.waitForText('Planned Capabilities');
    await page.waitForText('Coming in Sprint 5');
    await page.sleep(250);
    await page.clickButton('Close', { within: '[role="dialog"]' });
    await page.waitForTextGone('Planned Capabilities');

    assertCleanRuntime(page);
  });

  it('Gardens (/dashboard/gardens) creates, edits, and deletes a garden with all schema fields', async () => {
    page.clearDiagnostics();
    const gardenName = `E2E Garden ${Date.now()}`;
    const updatedGardenName = `${gardenName} Edited`;

    await page.goto(`${session.baseUrl}/dashboard/gardens`);
    await page.waitForText('Sunny Backyard Oasis');
    await page.clickButton('New Garden');
    await page.waitForText('Create New Garden');

    await page.fillByLabel('Garden Name', gardenName, { within: '[role="dialog"]' });
    await page.fillByLabel('Description', 'E2E automated test plot', { within: '[role="dialog"]' });
    await page.fillByLabel('Location Address', '500 Test Meadow Ln, Portland, OR', { within: '[role="dialog"]' });
    await page.fillByLabel('Latitude', '45.5231', { within: '[role="dialog"]' });
    await page.fillByLabel('Longitude', '-122.6765', { within: '[role="dialog"]' });
    await page.selectByLabel('IANA Timezone', 'America/Los_Angeles', { within: '[role="dialog"]' });
    await page.fillByLabel('Total Area', '18.5', { within: '[role="dialog"]' });

    await page.clickButton('Create Garden', { within: '[role="dialog"]' });
    await page.waitForUrl(/\/dashboard\/gardens\/\d+/);
    await page.waitForText(gardenName);

    // Go back to /dashboard/gardens, verify created garden card & edit it
    await page.goto(`${session.baseUrl}/dashboard/gardens`);
    await page.waitForText(gardenName);
    await page.waitForText('500 Test Meadow Ln, Portland, OR');

    await page.clickElementFromFn(
      (name) => {
        const links = Array.from(document.querySelectorAll('a'));
        const titleLink = links.find((a) => (a.innerText || '').includes(name));
        const card = titleLink?.closest('div[class*="rounded"]');
        return card?.querySelector('[aria-label="Edit garden"]') || null;
      },
      `Edit garden button for "${gardenName}" not found`,
      gardenName
    );
    await page.waitForText('Edit Garden');
    await page.fillByLabel('Garden Name', updatedGardenName, { within: '[role="dialog"]' });
    await page.fillByLabel('Total Area', '22.0', { within: '[role="dialog"]' });
    await page.clickButton('Save Changes', { within: '[role="dialog"]' });
    await page.waitForText(updatedGardenName);

    // Delete via UI Delete confirmation modal
    await page.clickElementFromFn(
      (name) => {
        const links = Array.from(document.querySelectorAll('a'));
        const titleLink = links.find((a) => (a.innerText || '').includes(name));
        const card = titleLink?.closest('div[class*="rounded"]');
        return card?.querySelector('[aria-label="Delete garden"]') || null;
      },
      `Delete garden button for "${updatedGardenName}" not found`,
      updatedGardenName
    );
    await page.waitForText('Delete Garden');
    await page.clickButton('Delete Garden', { within: '[role="dialog"]' });
    await page.waitForTextGone(updatedGardenName);

    assertCleanRuntime(page);
  });

  it('Garden Detail (/dashboard/gardens/1) supports UTabs (Zones, Members, Invitations, Devices [Live], Activity [Soon]) and Collaborator Invitations', async () => {
    page.clearDiagnostics();
    const collabEmail = `e2e-collab-${Date.now()}@smartgarden.test`;
    const revokeEmail = `e2e-revoke-${Date.now()}@smartgarden.test`;

    const collabPage = await session.browser.newPage();
    await collabPage.goto(`${session.baseUrl}/register`);
    await collabPage.waitForText('Create your SmartGarden account');
    await collabPage.fillByLabel('Full Name', 'E2E Collaborator');
    await collabPage.fillByLabel('Email address', collabEmail);
    await collabPage.fillByLabel('Password (min 8 characters)', 'CollabPass123!');
    await collabPage.clickButton('Create account');
    await collabPage.waitForUrl('/dashboard');
    await collabPage.waitForText('Welcome back, E2E Collaborator');

    try {
      await page.goto(`${session.baseUrl}/dashboard/gardens/1`);
      await page.waitForText('Sunny Backyard Oasis');
      await page.waitForText('Microclimate Growing Zones');

      // Devices (Live F7/F8) & Activity Coming Soon tabs
      await page.clickButton('Devices');
      await page.waitForText('Connected IoT Sensors & Zone Telemetry (F7/F8)');
      await page.waitForText('South Bed Moisture & Lux Node');
      await page.waitForText('Open Sensors Console');

      await page.clickButton('Activity');
      await page.waitForText('Garden Activity Feed & Field Journal (F16)');
      await page.waitForText('Open Growth Journal');

      // Members tab lists Demo Gardener as OWNER
      await page.clickButton('Members');
      await page.waitForText('Demo Gardener');
      await page.waitForText('demo@smartgarden.app');

      // Invitations & Members RBAC
      await page.clickButton('Invitations');
      await page.waitForText('Invite Collaborator');

      // Send & revoke an invitation
      await page.fillByLabel('Collaborator Email', revokeEmail);
      await page.selectByLabel('Role', 'GUEST');
      await page.clickButton('Send Invite');
      await page.waitForText('Shareable Invitation Link Created');
      await page.waitForText(revokeEmail);

      await page.clickElementFromFn(
        (email) => {
          const rows = Array.from(document.querySelectorAll('tr'));
          const row = rows.find((r) => (r.innerText || '').includes(email));
          if (!row) return null;
          return Array.from(row.querySelectorAll('button')).find((b) => (b.innerText || '').includes('Cancel')) || null;
        },
        `Cancel invite button for ${revokeEmail} not found`,
        revokeEmail
      );
      await page.waitForText('Invitation canceled');

      // Send invite to live collaborator & accept in collabPage
      await page.fillByLabel('Collaborator Email', collabEmail);
      await page.selectByLabel('Role', 'FAMILY');
      await page.clickButton('Send Invite');
      await page.waitForText('Shareable Invitation Link Created');

      const invitePath = await page.eval(() => {
        const code = document.querySelector('code');
        return code ? code.innerText.trim() : '';
      });
      assert.ok(invitePath.includes('/invitations/accept?token='), `Unexpected invite URL: ${invitePath}`);

      const fullInviteUrl = invitePath.startsWith('http') ? invitePath : `${session.baseUrl}${invitePath}`;
      await collabPage.goto(fullInviteUrl);
      await collabPage.waitForText('Garden Collaboration Invitation');
      await collabPage.clickButton('Accept Invitation');
      await collabPage.waitForUrl('/dashboard/gardens/1');
      await collabPage.waitForText('Sunny Backyard Oasis');

      // Manage member role (FAMILY -> GUEST) and remove collaborator
      await page.clickButton('Members');
      await page.waitForText('E2E Collaborator');

      await page.clickElementFromFn(
        (email) => {
          const rows = Array.from(document.querySelectorAll('tr'));
          const row = rows.find((r) => (r.innerText || '').includes(email));
          return row ? row.querySelector('button[role="combobox"], button') : null;
        },
        'Collaborator role select trigger not found',
        collabEmail
      );
      await page.clickElementFromFn(
        () => Array.from(document.querySelectorAll('[role="option"]')).find((o) => (o.innerText || '').trim() === 'GUEST') || null,
        'GUEST role option not found'
      );
      await page.waitForText('Member role updated to GUEST.');

      await page.clickElementFromFn(
        (email) => {
          const rows = Array.from(document.querySelectorAll('tr'));
          const row = rows.find((r) => (r.innerText || '').includes(email));
          if (!row) return null;
          return Array.from(row.querySelectorAll('button')).find((b) => (b.innerText || '').includes('Remove')) || null;
        },
        'Remove button for collaborator not found',
        collabEmail
      );
      await page.waitForText('Member removed');
      await page.waitForTextGone(collabEmail);

      assertCleanRuntime(page);
      assertCleanRuntime(collabPage);
    } finally {
      await collabPage.close();
    }
  });

  it('Garden Detail (/dashboard/gardens/1) Zones CRUD creates, edits, and deletes a zone with valid enums (RAISED_BED, FULL_SUN, LOAM)', async () => {
    page.clearDiagnostics();
    const zoneName = `E2E Cedar Bed ${Date.now()}`;
    const updatedZoneName = `${zoneName} Edited`;

    await page.goto(`${session.baseUrl}/dashboard/gardens/1`);
    await page.waitForText('South Raised Bed');
    await page.clickButton('Add Growing Zone');
    await page.waitForText('Configure microclimate zone type');

    await page.fillByLabel('Zone Name', zoneName, { within: '[role="dialog"]' });
    await page.selectByLabel('Zone Type', 'RAISED_BED', { within: '[role="dialog"]' });
    await page.selectByLabel('Environment', 'Outdoor', { within: '[role="dialog"]' });
    await page.selectByLabel('Soil Type', 'LOAM', { within: '[role="dialog"]' });
    await page.selectByLabel('Sunlight Level', 'Full Sun', { within: '[role="dialog"]' });
    await page.fillByLabel('Usable Bed Area', '2.5', { within: '[role="dialog"]' });
    await page.fillByLabel('Dimensions Note', '2.5m x 1m bed', { within: '[role="dialog"]' });
    await page.clickButton('Create Zone', { within: '[role="dialog"]' });

    await page.waitForText(zoneName);
    await page.waitForText('2.50 m²');

    // Verify newly created zone gets a unique ID (not overwriting seeded zone id=1)
    const createdZoneHref = await page.eval((zName) => {
      const cards = Array.from(document.querySelectorAll('div'));
      const card = cards.find((c) => c.querySelector('h4')?.innerText?.includes(zName) && c.querySelector('a[href*="/plants"]'));
      return card?.querySelector('a[href*="/plants"]')?.getAttribute('href') || '';
    }, zoneName);
    assert.ok(
      createdZoneHref && !createdZoneHref.includes('/zones/1/'),
      `Newly created zone "${zoneName}" received invalid/colliding ID href="${createdZoneHref}" (MariaDB lastID bug)`
    );

    // Edit and delete the newly created zone
    await page.clickElementFromFn(
      (zName) => {
        const cards = Array.from(document.querySelectorAll('div'));
        const card = cards.find((c) => c.querySelector('h4')?.innerText?.includes(zName) && c.querySelector('[aria-label="Edit zone"]'));
        return card?.querySelector('[aria-label="Edit zone"]') || null;
      },
      `Edit zone button for "${zoneName}" not found`,
      zoneName
    );
    await page.waitForText('Edit Growing Zone');
    await page.fillByLabel('Zone Name', updatedZoneName, { within: '[role="dialog"]' });
    await page.clickButton('Save Zone', { within: '[role="dialog"]' });
    await page.waitForText(updatedZoneName);

    await page.clickElementFromFn(
      (zName) => {
        const cards = Array.from(document.querySelectorAll('div'));
        const card = cards.find((c) => c.querySelector('h4')?.innerText?.includes(zName) && c.querySelector('[aria-label="Delete zone"]'));
        return card?.querySelector('[aria-label="Delete zone"]') || null;
      },
      `Delete zone button for "${updatedZoneName}" not found`,
      updatedZoneName
    );
    await page.waitForText('Delete Growing Zone');
    await page.clickButton('Delete Zone', { within: '[role="dialog"]' });
    await page.waitForTextGone(updatedZoneName);

    assertCleanRuntime(page);
  });

  it('Zone Plants (/dashboard/zones/:zoneId/plants) renders breadcrumb, utilization UProgress, companion analysis, add/edit/remove plant, overcrowding warning, and Care Tasks & Live Telemetry tabs', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/dashboard/gardens/1`);
    await page.waitForText('South Raised Bed');
    await page.clickElementFromFn(
      () => {
        const cards = Array.from(document.querySelectorAll('div'));
        const card = cards.find((c) => c.querySelector('h4')?.innerText?.includes('South Raised Bed') && c.querySelector('a[href*="/plants"]'));
        return card?.querySelector('a[href*="/plants"]') || null;
      },
      'Manage Plants link for South Raised Bed not found'
    );
    await page.waitForUrl(/\/dashboard\/zones\/\d+\/plants/);
    await page.waitForText('South Raised Bed');
    await page.waitForText('Sunny Backyard Oasis'); // Breadcrumb
    await page.waitForText('Bed Space Utilization');
    await page.waitForText('Heirloom Cherry Tomatoes');
    await page.waitForText('Sweet Genovese Basil');
    await page.waitForText('Tomato + Basil');

    // Add Carrot (quantity 2) via catalog search
    await page.clickButton('Assign Plant');
    await page.waitForText('Assign Catalog Plant to Zone');
    await page.selectByLabel('Catalog Species', 'Carrot', { within: '[role="dialog"]', searchTerm: 'Carrot' });
    await page.fillByLabel('Custom Nickname', 'E2E Nantes Carrot', { within: '[role="dialog"]' });
    await page.fillByLabel('Quantity', '2', { within: '[role="dialog"]' });
    await page.clickButton('Add to Zone', { within: '[role="dialog"]' });
    await page.waitForText('E2E Nantes Carrot');

    // Edit E2E Nantes Carrot quantity to 400 -> triggers ZONE_OVERCROWDED (>100%)
    await page.clickElementFromFn(
      () => {
        const rows = Array.from(document.querySelectorAll('tr'));
        const row = rows.find((r) => (r.innerText || '').includes('E2E Nantes Carrot'));
        return row ? row.querySelector('[aria-label="Edit plant"]') : null;
      },
      'Edit plant button for E2E Nantes Carrot not found'
    );
    await page.waitForText('Update Zone Plant');
    await page.fillByLabel('Quantity', '400', { within: '[role="dialog"]' });
    await page.clickButton('Save Changes', { within: '[role="dialog"]' });

    await page.waitForText('ZONE_OVERCROWDED');
    await page.waitForText('OVERCROWDED');

    // Remove E2E Nantes Carrot to leave demo zone clean
    await page.clickElementFromFn(
      () => {
        const rows = Array.from(document.querySelectorAll('tr'));
        const row = rows.find((r) => (r.innerText || '').includes('E2E Nantes Carrot'));
        return row ? row.querySelector('[aria-label="Remove plant"]') : null;
      },
      'Remove plant button for E2E Nantes Carrot not found'
    );
    await page.waitForText('Remove Plant from Zone');
    await page.clickButton('Remove Plant', { within: '[role="dialog"]' });
    await page.waitForTextGone('E2E Nantes Carrot');
    await page.waitForTextGone('ZONE_OVERCROWDED');

    // Care Tasks & Live Telemetry tabs (F6/F7)
    await page.clickButton('Care Tasks', { within: '[role="tablist"]' });
    await page.waitForText('Zone Care Tasks (F6)');
    await page.waitForText('Deep water cherry tomatoes and basil border');

    await page.clickButton('Live Telemetry', { within: '[role="tablist"]' });
    await page.waitForText('Zone Telemetry Chart (24h)');
    await page.waitForText('Soil Moisture');
    const hasChart = await page.eval(() => Boolean(document.querySelector('[data-testid="telemetry-chart"] svg')));
    assert.ok(hasChart, 'Expected TelemetryChart SVG in ZonePlantsView Live Telemetry tab');

    assertCleanRuntime(page);
  });

  it('Dashboard Plant Catalog (/dashboard/catalog) searches/filters 32 species, opens detail modal, and opens Add to zone modal', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/dashboard/catalog`);
    await page.waitForText('Botanical Plant Catalog');
    await page.waitForText('32 reference species');

    // Search for Lavender
    await page.fillInput('input[placeholder*="Search by common"]', 'Lavender');
    await page.clickButton('Search');
    await page.waitForText('Lavandula angustifolia');

    // Reset & filter by category Herbs and Sunlight Full Sun
    await page.clickButton('Reset');
    await page.waitForText('32 reference species');
    await page.clickButton('Herbs');
    await page.waitForText('Basil');

    await page.clickElementFromFn(
      () => Array.from(document.querySelectorAll('button[role="combobox"]')).find((el) => (el.innerText || '').includes('Sunlight')) || null,
      'Sunlight filter select not found'
    );
    await page.clickElementFromFn(
      () => Array.from(document.querySelectorAll('[role="option"]')).find((o) => (o.innerText || '').includes('Full Sun')) || null,
      'Full Sun option not found'
    );
    await page.waitForText('Basil');

    // Open plant detail modal & click Add to zone
    await page.clickElementFromFn(
      () => Array.from(document.querySelectorAll('div')).find((el) => el.className.includes('cursor-pointer') && (el.innerText || '').includes('Ocimum basilicum')) || null,
      'Basil catalog card not found'
    );
    await page.waitForText('Watering Cadence');
    await page.clickButton('Add to zone', { within: '[role="dialog"]' });
    await page.waitForText('Choose a garden and microclimate zone');
    await page.selectByLabel('Garden', 'Sunny Backyard Oasis', { within: '[role="dialog"]' });
    await page.waitForText('Sunny Backyard Oasis');
    await page.clickButton('Cancel', { within: '[role="dialog"]' });
    await page.waitForTextGone('Choose a garden and microclimate zone');

    assertCleanRuntime(page);
  });

  it('Settings (/dashboard/settings) loads profile from /api/auth/me, triggers Save Coming Soon toast, links security, and opens ComingSoonModals', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/dashboard/settings`);
    await page.waitForText('Account Profile');

    const profileValues = await page.eval(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      return inputs.map((i) => i.value);
    });
    assert.ok(profileValues.includes('Demo Gardener'), `Expected Demo Gardener in settings inputs: ${JSON.stringify(profileValues)}`);
    assert.ok(profileValues.includes('demo@smartgarden.app'), `Expected demo@smartgarden.app in settings inputs: ${JSON.stringify(profileValues)}`);

    await page.clickButton('Save Profile');
    await page.waitForText('Profile updates');

    const body = await page.getBodyText();
    assert.ok(body.includes('Request Reset Token'));
    assert.ok(body.includes('Enter Reset Token'));

    for (const cardTitle of ['Notifications & Digests', 'Billing & Workspace Plan', 'Developer API Keys']) {
      await page.clickElementFromFn(
        (t) => Array.from(document.querySelectorAll('div')).find((el) => el.className.includes('cursor-pointer') && (el.innerText || '').includes(t)) || null,
        `Settings card "${cardTitle}" not found`,
        cardTitle
      );
      await page.waitForText('Planned Capabilities');
      await page.sleep(250);
      await page.clickButton('Close', { within: '[role="dialog"]' });
      await page.waitForTextGone('Planned Capabilities');
    }

    assertCleanRuntime(page);
  });
});
