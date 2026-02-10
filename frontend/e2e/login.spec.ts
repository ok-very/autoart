import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
    test('should log in successfully with demo credentials', async ({ page }) => {
        await page.goto('/login');

        // Fill in credentials
        await page.getByTestId('email-input').fill('demo@autoart.local');
        await page.getByTestId('password-input').fill('demo123');

        // Submit
        await page.getByTestId('submit-button').click();

        // Verify redirection to home
        await expect(page).toHaveURL('/');

        // Verify MainLayout elements (e.g., Header) are visible
        // The "AutoArt" text in the header is a canvas, so we check for a navigation item like "Projects"
        await expect(page.getByText('Projects').first()).toBeVisible();
    });

    test('should show error with invalid credentials', async ({ page }) => {
        await page.goto('/login');

        await page.getByTestId('email-input').fill('wrong@example.com');
        await page.getByTestId('password-input').fill('wrongpassword');
        await page.getByTestId('submit-button').click();

        // Verify error message
        // Based on visually confirming, the message is "Invalid email or password"
        await expect(page.getByText('Invalid email or password')).toBeVisible();
    });
});
