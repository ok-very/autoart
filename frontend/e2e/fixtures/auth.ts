/**
 * Auth Fixture — Shared login helper (trunk: authenticate)
 *
 * Reusable login function extracted from the repeated pattern
 * in login.spec.ts and layout.spec.ts.
 *
 * This is the WAYPOINT: session-ready step — shared by every test.
 */

import { type Page, expect } from '@playwright/test';

const DEMO_EMAIL = 'demo@autoart.local';
const DEMO_PASSWORD = 'demo123';

/**
 * Log in with demo credentials and wait for the main layout to load.
 *
 * @param page - Playwright page instance
 * @returns void — asserts redirect to '/' and Projects nav item visible
 */
export async function loginAndNavigate(page: Page): Promise<void> {
    // Clear persisted Dockview layout so tabs start from defaults
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Fill in demo credentials
    await page.getByTestId('email-input').fill(DEMO_EMAIL);
    await page.getByTestId('password-input').fill(DEMO_PASSWORD);

    // Submit
    await page.getByTestId('submit-button').click();

    // Wait for redirect to home
    await expect(page).toHaveURL('/');

    // Verify main layout is loaded (Projects nav item proves MainLayout rendered)
    await expect(page.getByText('Projects').first()).toBeVisible();
}
