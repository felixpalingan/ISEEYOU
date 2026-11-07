import { test, expect } from '@playwright/test';

test.describe('E2E: Structured Evidence Table & AI Detective BYOK Copilot', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
  });

  test('should navigate to Structured Data View and switch between sub-tabs', async ({ page }) => {
    const tableBtn = page.getByTestId('btn-activity-table');
    await expect(tableBtn).toBeVisible();
    await tableBtn.click();

    const exposuresTab = page.getByTestId('subtab-exposures');
    const assetsTab = page.getByTestId('subtab-assets');
    const linksTab = page.getByTestId('subtab-links');

    await expect(exposuresTab).toBeVisible();
    await expect(assetsTab).toBeVisible();
    await expect(linksTab).toBeVisible();

    await assetsTab.click();
    await expect(page.getByPlaceholder(/filter assets by hostname/i)).toBeVisible();

    await linksTab.click();
    await exposuresTab.click();
    await expect(page.getByPlaceholder(/filter findings by title/i)).toBeVisible();
  });

  test('should display export options for CSV, JSON, and PDF in toolbar', async ({ page }) => {
    const tableBtn = page.getByTestId('btn-activity-table');
    await tableBtn.click();

    await expect(page.getByTestId('btn-export-csv')).toBeVisible();
    await expect(page.getByTestId('btn-export-json')).toBeVisible();
    await expect(page.getByTestId('btn-export-pdf')).toBeVisible();
  });

  test('should open AI OSINT Detective panel and configure BYOK AI Token providers', async ({ page }) => {
    const aiBtn = page.getByTestId('btn-activity-ai');
    await expect(aiBtn).toBeVisible();
    await aiBtn.click();

    const aiPanel = page.getByTestId('ai-detective-panel');
    await expect(aiPanel).toBeVisible();
    await expect(aiPanel).toContainText('AI OSINT Detective');

    // Open BYOK AI Token form
    const byokBtn = page.getByTestId('btn-toggle-byok');
    await expect(byokBtn).toBeVisible();
    await byokBtn.click();

    // Verify Gemini, Groq, OpenAI, and Ollama provider pills exist
    await expect(aiPanel.getByRole('button', { name: 'gemini' })).toBeVisible();
    await expect(aiPanel.getByRole('button', { name: 'groq' })).toBeVisible();
    await expect(aiPanel.getByRole('button', { name: 'openai' })).toBeVisible();
    await expect(aiPanel.getByRole('button', { name: 'ollama' })).toBeVisible();
  });
});
