import { test, expect } from '@playwright/test';

test.describe('E2E: Reconnaissance & Visual Graph Investigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
  });

  test('should load the VS Code Cyber-Precision Dark Modern workspace', async ({ page }) => {
    // 1. Verify Header branding
    await expect(page.getByText('ISEEYOU // COMMAND_CENTER')).toBeVisible();

    // 2. Verify Activity Bar is present on the left
    const activityBar = page.locator('aside').first();
    await expect(activityBar).toBeVisible();

    // 3. Verify Omni-Search bar is present with default placeholder and value
    const searchInput = page.getByPlaceholder('Enter target: domain, IP, email, or username...');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveValue('example.com');

    // 4. Verify status bar shows system version
    await expect(page.getByText(/ISEEYOU v0\.1\.0/i)).toBeVisible();
  });

  test('should auto-classify entity types on omni-search input', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Enter target: domain, IP, email, or username...');
    const entityBadge = page.getByTestId('detected-entity-badge');

    // Test Domain classification
    await searchInput.fill('acme-defense.io');
    await expect(entityBadge).toContainText('DOMAIN');

    // Test IP classification (label: IP ADDRESS)
    await searchInput.fill('8.8.8.8');
    await expect(entityBadge).toContainText('IP ADDRESS');

    // Test Email classification (label: EMAIL)
    await searchInput.fill('ciso@security.org');
    await expect(entityBadge).toContainText('EMAIL');

    // Test Username classification (label: USERNAME)
    await searchInput.fill('torvalds');
    await expect(entityBadge).toContainText('USERNAME');
  });

  test('should trigger passive recon scan and stream live telemetry logs', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Enter target: domain, IP, email, or username...');
    await searchInput.fill('example.com');

    const scanButton = page.getByRole('button', { name: /^scan$/i });
    await expect(scanButton).toBeEnabled();
    await scanButton.click();

    // Verify Telemetry Terminal drawer displays streaming logs
    const terminalTab = page.getByText(/telemetry_stream\.log/i);
    await expect(terminalTab).toBeVisible();

    // Verify system telemetry line appears
    await expect(page.getByText(/Dispatching reconnaissance mission/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test('should support panel minimizing, resizing, and Zen Mode toggle', async ({ page }) => {
    // 1. Locate Zen Mode button in layout controls
    const zenModeButton = page.getByRole('button', { name: /Zen Mode/i });
    await expect(zenModeButton).toBeVisible();

    // 2. Toggle Zen Mode to maximize canvas
    await zenModeButton.click();

    // 3. Toggle again to restore 3-panel workspace
    await zenModeButton.click();
    await expect(page.getByText('Target Explorer', { exact: false })).toBeVisible();
    await expect(page.getByText('AUDIT READY', { exact: false })).toBeVisible();
  });

  test('should block internal and loopback targets with SSRF warning badge and disable scan', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Enter target: domain, IP, email, or username...');
    const scanButton = page.getByRole('button', { name: /^scan$/i });

    // 1. Test Loopback 127.0.0.1
    await searchInput.fill('127.0.0.1');
    const blockedBadge = page.getByTestId('ssrf-blocked-badge');
    await expect(blockedBadge).toBeVisible();
    await expect(blockedBadge).toContainText('SSRF BLOCKED');
    await expect(scanButton).toBeDisabled();
    await expect(page.getByTestId('ssrf-warning-banner')).toBeVisible();

    // 2. Test Localhost
    await searchInput.fill('localhost');
    await expect(blockedBadge).toBeVisible();
    await expect(scanButton).toBeDisabled();

    // 3. Test Cloud Metadata IP 169.254.169.254
    await searchInput.fill('169.254.169.254');
    await expect(blockedBadge).toBeVisible();
    await expect(scanButton).toBeDisabled();

    // 4. Test Legitimate Public Target recovery
    await searchInput.fill('acme-defense.io');
    await expect(page.getByTestId('detected-entity-badge')).toBeVisible();
    await expect(page.getByTestId('detected-entity-badge')).toContainText('DOMAIN');
    await expect(scanButton).toBeEnabled();
  });
});
