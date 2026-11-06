import { test, expect } from '@playwright/test';

test.describe('E2E: Structured Data View & Remediation Playbooks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
  });

  test('should navigate to Structured Data View and switch between sub-tabs', async ({ page }) => {
    // 1. Switch to Structured Intel tab using resilient testid
    const tableTab = page.getByTestId('tab-workspace-table');
    await expect(tableTab).toBeVisible();
    await tableTab.click();

    // 2. Verify sub-tabs are displayed
    const exposuresTab = page.getByTestId('subtab-exposures');
    const assetsTab = page.getByTestId('subtab-assets');
    const linksTab = page.getByTestId('subtab-links');

    await expect(exposuresTab).toBeVisible();
    await expect(assetsTab).toBeVisible();
    await expect(linksTab).toBeVisible();

    // 3. Switch to Asset Inventory
    await assetsTab.click();
    await expect(page.getByPlaceholder(/filter assets by hostname/i)).toBeVisible();

    // 4. Switch to Network Links
    await linksTab.click();

    // 5. Switch back to Exposures
    await exposuresTab.click();
    await expect(page.getByPlaceholder(/filter findings by title/i)).toBeVisible();
  });

  test('should display export options for CSV, JSON, and PDF in toolbar', async ({ page }) => {
    const tableTab = page.getByTestId('tab-workspace-table');
    await tableTab.click();

    // Verify CSV, JSON, and PDF export buttons via resilient testids
    await expect(page.getByTestId('btn-export-csv')).toBeVisible();
    await expect(page.getByTestId('btn-export-json')).toBeVisible();
    await expect(page.getByTestId('btn-export-pdf')).toBeVisible();
  });

  test('should inspect finding and verify Remediation Playbook tabs', async ({ page }) => {
    // 1. Ensure Inspector Drawer is open
    await expect(page.getByText('AUDIT READY', { exact: false })).toBeVisible();

    // 2. Verify 1-Click Remediation Playbook Card is present
    await expect(page.getByText(/1-Click Remediation Playbook/i)).toBeVisible();

    // 3. Test switching platform tabs: UFW Firewall, Nginx Block, Apache, Cloudflare WAF, DNS
    const ufwTab = page.getByRole('button', { name: /UFW Firewall/i });
    const nginxTab = page.getByRole('button', { name: /Nginx Block/i });
    const cfTab = page.getByRole('button', { name: /Cloudflare WAF/i });

    await expect(ufwTab).toBeVisible();
    await expect(nginxTab).toBeVisible();
    await expect(cfTab).toBeVisible();

    // 4. Click Cloudflare tab and assert snippet code area
    await cfTab.click();
    await expect(page.locator('pre').first()).toBeVisible();

    // 5. Click UFW tab and assert copy snippet button
    await ufwTab.click();
    await expect(page.getByRole('button', { name: /^Copy$/i }).first()).toBeVisible();
  });

  test('should switch to AI Recon Analyst Copilot tab', async ({ page }) => {
    const aiTab = page.getByTestId('tab-workspace-ai');
    await expect(aiTab).toBeVisible();
    await aiTab.click();

    // Verify AI Analyst Card renders
    await expect(page.getByText(/AI Recon Analyst/i).first()).toBeVisible({ timeout: 10000 });
  });
});
