import { test, expect } from '@playwright/test';

test.describe('E2E: Statutory Legal Takedown, PDF Exporter & Provenance Modals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
  });

  test('should open and configure Legal Takedown & Privacy Assistant (UU PDP & GDPR)', async ({ page }) => {
    // 1. Open Legal Takedown Modal via Activity Bar button
    const legalButton = page.getByTestId('btn-activity-legal');
    await expect(legalButton).toBeVisible();
    await legalButton.click();

    // 2. Verify Modal Header & Container via testid
    const modal = page.getByTestId('legal-takedown-modal');
    await expect(modal).toBeVisible();
    await expect(page.getByText('Legal Takedown & Privacy Assistant')).toBeVisible();

    // 3. Test statutory framework switches
    const uupdpTab = page.getByRole('button', { name: /UU PDP No\. 27\/2022/i });
    const gdprTab = page.getByRole('button', { name: /GDPR Article 17/i });
    const dmcaTab = page.getByRole('button', { name: /DMCA \/ Credential/i });

    await expect(uupdpTab).toBeVisible();
    await expect(gdprTab).toBeVisible();
    await expect(dmcaTab).toBeVisible();

    // Switch to GDPR
    await gdprTab.click();
    await expect(page.getByText(/General Data Protection Regulation/i).first()).toBeVisible();

    // Switch to DMCA
    await dmcaTab.click();
    await expect(page.getByText(/17 U\.S\.C\. § 512\(c\)/i).first()).toBeVisible();

    // Switch back to UU PDP
    await uupdpTab.click();
    await expect(page.getByText(/UU PDP No\. 27/i).first()).toBeVisible();

    // 4. Verify Action buttons
    await expect(page.getByRole('button', { name: /Salin Surat Resmi/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Unduh Surat/i })).toBeVisible();

    // 5. Close Modal
    const closeBtn = page.getByTitle('Close Assistant');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('should open Professional PDF Audit Report Exporter and verify TLP marks', async ({ page }) => {
    // 1. Open PDF Exporter via Activity Bar icon button
    const exportButton = page.getByTestId('btn-activity-export-pdf');
    await expect(exportButton).toBeVisible();
    await exportButton.click();

    // 2. Verify Modal Container via testid & Format specs
    const modal = page.getByTestId('export-pdf-modal');
    await expect(modal).toBeVisible();
    await expect(page.getByText('Export Professional Security Audit Report')).toBeVisible();

    // 3. Test Traffic Light Protocol (TLP) selector
    const tlpAmber = page.getByRole('button', { name: /TLP:AMBER/i });
    const tlpRed = page.getByRole('button', { name: /TLP:RED/i });
    const tlpGreen = page.getByRole('button', { name: /TLP:GREEN/i });
    const tlpClear = page.getByRole('button', { name: /TLP:CLEAR/i });

    await expect(tlpAmber).toBeVisible();
    await expect(tlpRed).toBeVisible();
    await expect(tlpGreen).toBeVisible();
    await expect(tlpClear).toBeVisible();

    // Select TLP:RED
    await tlpRed.click();
    await expect(page.getByText('TLP:RED Selected')).toBeVisible();

    // 4. Verify Report Customizer checkboxes
    await expect(page.getByText('AI Threat Synthesis')).toBeVisible();
    await expect(page.getByText('Asset Inventory & Provenance')).toBeVisible();
    await expect(page.getByText('Mandatory Credential Masking')).toBeVisible();

    // 5. Verify Primary Download Action button
    const downloadPdfBtn = page.getByRole('button', { name: /download official pdf report/i });
    await expect(downloadPdfBtn).toBeVisible();
    await expect(downloadPdfBtn).toBeEnabled();

    // 6. Close Modal
    const cancelBtn = page.getByRole('button', { name: /cancel/i });
    await cancelBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('should open Data Provenance & Methodology modal from Activity Bar', async ({ page }) => {
    // 1. Click Data Provenance database icon in Activity Bar
    const provenanceIcon = page.getByTestId('btn-activity-provenance');
    await expect(provenanceIcon).toBeVisible();
    await provenanceIcon.click();

    // 2. Verify Provenance Modal container & contents
    const modal = page.getByTestId('provenance-modal');
    await expect(modal).toBeVisible();
    await expect(page.getByText('OSINT Data Sources & Provenance Architecture')).toBeVisible();
    await expect(page.getByText(/100% Passive Reconnaissance/i)).toBeVisible();

    // 3. Close Modal
    const closeBtn = page.getByRole('button', { name: /^tutup$/i });
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });
});
