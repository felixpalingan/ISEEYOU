import { test, expect } from '@playwright/test';

test.describe('E2E: ISEEYOU 2.0 OSINT Lead-Chaining Caseboard & Target Dossier', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
  });

  test('should load the Full-Screen OSINT Caseboard & Floating Target Dossier', async ({ page }) => {
    // 1. Verify Header branding
    await expect(page.getByText('ISEEYOU 2.0', { exact: true })).toBeVisible();
    await expect(page.getByText('OSINT CASEBOARD')).toBeVisible();

    // 2. Verify Floating Target Dossier Card is visible on the left
    const dossierCard = page.getByTestId('target-dossier-card');
    await expect(dossierCard).toBeVisible();
    await expect(dossierCard).toContainText('Target Dossier');

    // 3. Verify Omni-Search bar is present with default username target
    const searchInput = page.getByPlaceholder('Enter target: domain, IP, email, or username...');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveValue('torvalds');

    // 4. Verify Lead Inspector Drawer is visible on the right
    await expect(page.getByTestId('lead-inspector-drawer')).toBeVisible();
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

    // Test Dotted Usernames (non-TLD extensions like .hkp, .doe) stay USERNAME
    await searchInput.fill('bariq.hkp');
    await expect(entityBadge).toContainText('USERNAME');

    await searchInput.fill('john.doe');
    await expect(entityBadge).toContainText('USERNAME');

    // Test Manual Entity Type Selection via dropdown
    await entityBadge.click();
    const typeDropdown = page.getByTestId('entity-type-dropdown');
    await expect(typeDropdown).toBeVisible();
    await typeDropdown.getByRole('button', { name: /DOMAIN/i }).click();
    await expect(entityBadge).toContainText('DOMAIN');
  });

  test('should open Tactical Dork Matrix with Private Account Comment Bypass dorks', async ({ page }) => {
    const dorkBtn = page.getByTestId('btn-open-dork-matrix');
    await expect(dorkBtn).toBeVisible();
    await dorkBtn.click();

    const dorkPanel = page.getByTestId('dork-matrix-panel');
    await expect(dorkPanel).toBeVisible();
    await expect(dorkPanel).toContainText('Instagram Private Account Public Comments & Mentions');
    await expect(dorkPanel).toContainText('site:instagram.com');
    await expect(dorkPanel).toContainText('-inurl:instagram.com/');
  });

  test('should allow pinning a manual clue onto the Caseboard and inspecting it', async ({ page }) => {
    const pinBtn = page.getByTestId('btn-open-pin-clue');
    await expect(pinBtn).toBeVisible();
    await pinBtn.click();

    await page.getByPlaceholder('e.g. budi.santoso99 or budi@company.com').fill('budi_private_ig');
    await page.getByPlaceholder("e.g. Private IG found in friend's comment").fill('Private IG Lead');
    await page.getByRole('button', { name: /Pin Clue onto Board & Connect/i }).click();

    // Should switch to Lead Inspector tab showing the newly pinned clue
    const drawer = page.getByTestId('lead-inspector-drawer');
    await expect(drawer).toContainText('budi_private_ig');
    await expect(drawer).toContainText('Chain Next OSINT Step From This Lead');
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

    // 3. Test Legitimate Public Target recovery
    await searchInput.fill('acme-defense.io');
    await expect(page.getByTestId('detected-entity-badge')).toBeVisible();
    await expect(page.getByTestId('detected-entity-badge')).toContainText('DOMAIN');
    await expect(scanButton).toBeEnabled();
  });

  test('should verify Auto-Tidy Graph and Target Dossier sub-tabs (Leads, Circle, History)', async ({ page }) => {
    const dossierCard = page.getByTestId('target-dossier-card');
    await expect(dossierCard).toBeVisible();

    // Switch to Circle tab (Mutuals & Co-Authors)
    await dossierCard.getByRole('button', { name: /Circle/i }).click();
    await expect(dossierCard).toContainText('Mutuals & Co-Authors');

    // Switch to History (Chronological Timeline) tab
    await dossierCard.getByRole('button', { name: /History/i }).click();
    await expect(dossierCard).toContainText('Chronological Digital Footprint');

    // Verify Auto-Tidy Graph button works
    const autoTidyBtn = page.getByTestId('auto-tidy-graph-btn');
    await expect(autoTidyBtn).toBeVisible();
    await autoTidyBtn.click();
  });
});
