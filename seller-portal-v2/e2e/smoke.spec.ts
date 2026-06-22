import { test, expect } from '@playwright/test';

// Placeholder smoke test that validates the auth page renders.
// A real smoke flow (login -> create product -> fulfill order) is
// deferred to a future session that runs the backend on port 3000.
test('login page loads', async ({ page }) => {
  await page.goto('/login');
  await expect(
    page.getByRole('heading', { name: /sign in|log in|welcome/i }),
  ).toBeVisible({ timeout: 5000 });
});
