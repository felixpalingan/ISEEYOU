import { test, expect } from '@playwright/test';

test.describe('E2E: Statutory Legal Takedown, PDF Dossier Exporter & Case Manager Modals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
  });

  test('should open and configure Legal Takedown & Privacy Assistant (UU PDP & GDPR)', async ({ page }) => {
    const legalButton = page.getByTestId('btn-activity-legal');
    await expect(legalButton).toBeVisible();
    await legalButton.click();

    const modal = page.getByTestId('legal-takedown-modal');
    await expect(modal).toBeVisible();
    await expect(page.getByText('Legal Takedown & Privacy Assistant')).toBeVisible();

    const uupdpTab = page.getByRole('button', { name: /UU PDP No\. 27\/2022/i });
    const gdprTab = page.getByRole('button', { name: /GDPR Article 17/i });
    const dmcaTab = page.getByRole('button', { name: /DMCA \/ Credential/i });

    await expect(uupdpTab).toBeVisible();
    await expect(gdprTab).toBeVisible();
    await expect(dmcaTab).toBeVisible();

    await gdprTab.click();
    await expect(page.getByText(/General Data Protection Regulation/i).first()).toBeVisible();

    await uupdpTab.click();
    await expect(page.getByText(/UU PDP No\. 27/i).first()).toBeVisible();

    const closeBtn = page.getByTitle('Close Assistant');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('should open Professional PDF Dossier Report Exporter and verify TLP marks', async ({ page }) => {
    const exportButton = page.getByTestId('btn-activity-export-pdf');
    await expect(exportButton).toBeVisible();
    await exportButton.click();

    const modal = page.getByTestId('export-pdf-modal');
    await expect(modal).toBeVisible();
    await expect(page.getByText('Export Professional Security Audit Report')).toBeVisible();

    const tlpRed = page.getByRole('button', { name: /TLP:RED/i });
    await expect(tlpRed).toBeVisible();
    await tlpRed.click();
    await expect(page.getByText('TLP:RED Selected')).toBeVisible();

    const downloadPdfBtn = page.getByRole('button', { name: /download official pdf report/i });
    await expect(downloadPdfBtn).toBeVisible();
    await expect(downloadPdfBtn).toBeEnabled();

    const cancelBtn = page.getByRole('button', { name: /cancel/i });
    await cancelBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('should open OSINT Case Session Manager (.case.json) and save a snapshot', async ({ page }) => {
    const caseBtn = page.getByTestId('btn-open-case-manager');
    await expect(caseBtn).toBeVisible();
    await caseBtn.click();

    const modal = page.getByTestId('case-manager-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('OSINT Case Session Manager (.case.json)');

    // Save a snapshot
    await modal.getByRole('button', { name: /Save Snapshot/i }).click();
    await expect(modal).toContainText('Saved Browser Case Snapshots (1)');
  });
});
