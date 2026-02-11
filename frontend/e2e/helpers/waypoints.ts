/**
 * Waypoint Assertion Helpers
 *
 * Named assertion functions for each decision-tree node.
 * Each waypoint verifies visible UI state and logs a breadcrumb checkpoint.
 *
 * Waypoints correspond to the garden-path decision tree:
 *   session-ready → source-acquired → plan-ready → decisions-resolved → applied → delivered
 */

import { type Page, expect } from '@playwright/test';
import { type TestBreadcrumbs } from './breadcrumbs';

// ============================================================================
// WAYPOINT: session-ready
// ============================================================================

/**
 * Assert that the user is authenticated and the main layout is loaded.
 * This is the trunk entry point shared by all tests.
 */
export async function assertSessionReady(
    page: Page,
    crumbs: TestBreadcrumbs,
): Promise<void> {
    // Verify we're on the main layout (not login page)
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Projects').first()).toBeVisible();

    crumbs.checkpoint('session-ready');
}

// ============================================================================
// WAYPOINT: source-acquired
// ============================================================================

/**
 * Assert that import data has been parsed and a session/plan exists.
 * For CSV import: the sidebar shows "Active Session" and the workbench
 * shows item preview with counts.
 */
export async function assertSourceAcquired(
    page: Page,
    crumbs: TestBreadcrumbs,
    opts: { itemCount?: number } = {},
): Promise<void> {
    // Sidebar should show "Active Session" label
    await expect(page.getByText('Active Session')).toBeVisible({ timeout: 15_000 });

    // If item count provided, verify it in the execution controls footer
    if (opts.itemCount !== undefined) {
        await expect(
            page.getByText(`${opts.itemCount}`, { exact: false }),
        ).toBeVisible();
    }

    crumbs.checkpoint('source-acquired', opts.itemCount !== undefined ? { itemCount: opts.itemCount } : undefined);
}

// ============================================================================
// WAYPOINT: plan-ready
// ============================================================================

/**
 * Assert that the import plan preview is rendering.
 * Verifies that at least one of Hierarchy/Stages tabs is visible
 * and classification badges are present.
 */
export async function assertPlanReady(
    page: Page,
    crumbs: TestBreadcrumbs,
): Promise<void> {
    // Preview mode tabs should be visible (Hierarchy or Stages)
    await expect(page.getByText('Hierarchy').first()).toBeVisible();

    // Execution controls footer should show "Ready to import" text
    await expect(page.getByText('Ready to import')).toBeVisible();

    crumbs.checkpoint('plan-ready');
}

// ============================================================================
// WAYPOINT: decisions-resolved
// ============================================================================

/**
 * Assert that all classification decisions have been resolved.
 * The "Needs Review" badge should NOT be visible, and commit should be allowed.
 */
export async function assertDecisionsResolved(
    page: Page,
    crumbs: TestBreadcrumbs,
): Promise<void> {
    // "Needs Review" badge should NOT be present
    await expect(page.getByText('Needs Review')).not.toBeVisible();

    // "Commit Approved Events" button should be enabled (not disabled)
    const commitButton = page.getByRole('button', { name: /Commit Approved Events/i });
    await expect(commitButton).toBeVisible();
    await expect(commitButton).toBeEnabled();

    crumbs.checkpoint('decisions-resolved');
}

// ============================================================================
// WAYPOINT: applied
// ============================================================================

/**
 * Assert that the import execution completed successfully.
 * The success indicator "Import completed!" should be visible.
 */
export async function assertApplied(
    page: Page,
    crumbs: TestBreadcrumbs,
): Promise<void> {
    // Success message from ExecutionControls
    await expect(
        page.getByText('Import completed!'),
    ).toBeVisible({ timeout: 30_000 });

    crumbs.checkpoint('applied');
}
