import assert from 'node:assert/strict';
import { startE2EEnvironment } from './server-harness.js';
import { CDPBrowser } from './cdp-browser.js';

export function assertCleanRuntime(page, { allow4xxConsole = false } = {}) {
  assert.deepEqual(
    page.pageErrors,
    [],
    `Expected zero uncaught page errors, got: ${JSON.stringify(page.pageErrors)}`
  );
  assert.deepEqual(
    page.http5xxErrors,
    [],
    `Expected zero HTTP 5xx responses, got: ${JSON.stringify(page.http5xxErrors)}`
  );
  const filteredConsoleErrors = page.consoleErrors.filter((msg) => {
    // Offline sandbox blocks DNS for external Iconify fallback CDN
    if (/ERR_NAME_NOT_RESOLVED.*api2?\.iconify\.design/.test(msg)) return false;
    if (allow4xxConsole && /Failed to load resource: the server responded with a status of 40[01349]/.test(msg)) return false;
    return true;
  });
  assert.deepEqual(
    filteredConsoleErrors,
    [],
    `Expected zero console errors, got: ${JSON.stringify(filteredConsoleErrors)}`
  );
}

export async function createSuiteSession() {
  const externalBaseUrl = process.env.SG_E2E_BASE_URL;
  let env = null;
  if (!externalBaseUrl) {
    env = await startE2EEnvironment();
  }
  const baseUrl = externalBaseUrl || env.baseUrl;
  const browser = new CDPBrowser();
  await browser.launch();

  return {
    baseUrl,
    browser,
    async teardown() {
      await browser.close();
      if (env) {
        await env.stop();
      }
    }
  };
}

export async function loginAsDemo(page, baseUrl) {
  await page.goto(`${baseUrl}/login`);
  await page.waitForText('Sign in to SmartGarden');
  await page.clickButton('Try the demo');
  await page.waitForUrl('/dashboard');
  await page.waitForText('Welcome back, Demo Gardener');
}
