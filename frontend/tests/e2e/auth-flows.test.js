import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createSuiteSession, assertCleanRuntime } from '../helpers/e2e-context.js';

describe('E2E: Authentication Flows (/login, /register, /forgot-password, /reset-password)', () => {
  let session;
  let page;
  const uniqueEmail = `e2e-auth-${Date.now()}@smartgarden.test`;

  before(async () => {
    session = await createSuiteSession();
    page = await session.browser.newPage();
  });

  after(async () => {
    if (page) await page.close();
    if (session) await session.teardown();
  });

  it('Login page renders Google OAuth provider, triggers Coming Soon toast for GitHub, and logs in via "Try the demo"', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/login`);
    await page.waitForText('Sign in to SmartGarden');
    await page.waitForText('Continue with Google');

    await page.clickButton('Continue with GitHub');
    await page.waitForText('Social sign-in');
    await page.waitForText('GitHub OAuth sign-in is scheduled for a later sprint.');

    // Wait for toast overlay to auto-dismiss so it doesn't cover "Try the demo"
    await page.waitForTextGone('GitHub OAuth sign-in is scheduled for a later sprint.');
    await page.clickButton('Try the demo');
    await page.waitForUrl('/dashboard');
    await page.waitForText('Welcome back, Demo Gardener');

    const token = await page.eval(() => localStorage.getItem('sg_token'));
    assert.ok(token && token.length > 20, 'Expected JWT sg_token in localStorage after demo login');

    // Sign out via UserMenu
    await page.clickByAriaLabel('Account menu');
    await page.waitForText('Sign out');
    await page.clickElementFromFn(
      () => {
        const items = Array.from(document.querySelectorAll('[role="menuitem"]'));
        return items.find((el) => (el.innerText || '').includes('Sign out')) || null;
      },
      'Sign out menu item not found'
    );
    await page.waitFor(() => !localStorage.getItem('sg_token'), { message: 'Expected sg_token to be cleared on Sign out' });
    await page.waitForUrl('/');

    assertCleanRuntime(page);
  });

  it('Registration flow creates user in DB and Forgot/Reset Password flow updates password end-to-end', async () => {
    page.clearDiagnostics();
    await page.goto(`${session.baseUrl}/register`);
    await page.waitForText('Create your SmartGarden account');

    await page.fillByLabel('Full Name', 'E2E Auth User');
    await page.fillByLabel('Email address', uniqueEmail);
    await page.fillByLabel('Climate / USDA Zone', 'Zone 8b');
    await page.fillByLabel('Password (min 8 characters)', 'InitialPass123!');
    await page.clickButton('Create account');

    await page.waitForUrl('/dashboard');
    await page.waitForText('Welcome back, E2E Auth User');

    // Sign out
    await page.clickByAriaLabel('Account menu');
    await page.waitForText('Sign out');
    await page.eval(() => {
      const items = Array.from(document.querySelectorAll('[role="menuitem"]'));
      const signOut = items.find((el) => (el.innerText || '').includes('Sign out'));
      if (signOut) signOut.click();
    });
    await page.waitFor(() => !localStorage.getItem('sg_token'), { message: 'Expected sg_token cleared after sign out' });

    // Forgot Password -> dev reset token link -> Reset Password
    await page.goto(`${session.baseUrl}/forgot-password`);
    await page.waitForText('Reset your password');
    await page.fillByLabel('Email address', uniqueEmail);
    await page.clickButton('Send reset instructions');

    await page.waitForText('Development Reset Token Generated');
    await page.clickButton('Continue to Reset Password');

    await page.waitForUrl('/reset-password?token=');
    await page.waitForText('Set a new password');

    await page.fillByLabel('New Password (min 8 characters)', 'UpdatedPass123!');
    await page.fillByLabel('Confirm New Password', 'UpdatedPass123!');
    await page.clickButton('Update password');

    await page.waitForText('Password updated successfully!');
    await page.waitForUrl('/login');

    // Verify login works with the newly reset password
    await page.fillByLabel('Email address', uniqueEmail);
    await page.fillByLabel('Password', 'UpdatedPass123!');
    await page.clickButton('Sign in', { exact: true });

    await page.waitForUrl('/dashboard');
    await page.waitForText('Welcome back, E2E Auth User');

    assertCleanRuntime(page);
  });
});
