import { test, expect } from '@playwright/test';

test.describe('Main Layout', () => {
    test.beforeEach(async ({ page }) => {
        // Login before each test
        await page.goto('/login');
        await page.getByTestId('email-input').fill('demo@autoart.local');
        await page.getByTestId('password-input').fill('demo123');
        await page.getByTestId('submit-button').click();
        await expect(page).toHaveURL('/');
    });

    test('should display the main workspace layout', async ({ page }) => {
        // Verify Header
        await expect(page.getByRole('banner')).toBeVisible(); // Assuming Header is <header>

        // Verify App Title - visual check might be needed for canvas, so we check for nav items
        await expect(page.getByText('Projects').first()).toBeVisible();
    });
});
