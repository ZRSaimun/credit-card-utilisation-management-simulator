import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto(".");
  await expect(page.getByRole("heading", { name: "Credit Card Utilisation Management Simulator" })).toBeVisible();
});

test("shows the assignment baseline and opens the monthly cycle", async ({ page }) => {
  for (const value of ["£35,800", "£19,721", "55.09%", "£1,821"]) {
    await expect(page.getByText(value, { exact: true }).first()).toBeVisible();
  }
  await page.getByRole("button", { name: "Monthly Cycle", exact: true }).click();
  await expect(page.getByRole("heading", { name: /chronological ledger/i })).toBeVisible();
});

test("previews a zero-fee transfer", async ({ page }) => {
  await page.getByRole("button", { name: "Allocation", exact: true }).click();
  await page.getByLabel("Source card").selectOption("Capital One B");
  await page.getByLabel("Destination card").selectOption("Capital One A");
  await page.getByLabel("Transfer amount").fill("100");
  await expect(page.getByText(/Total debt change:/)).toContainText("+£0");
});

test("saves a local scenario across reload and downloads a PDF", async ({ page }) => {
  const reports = page.getByRole("button", { name: "Reports", exact: true });
  await reports.click();
  await page.getByLabel("Scenario name").fill("Browser test scenario");
  await page.getByRole("button", { name: "Save current scenario", exact: true }).click();
  await page.reload();
  await reports.click();
  await expect(page.getByText("Browser test scenario", { exact: true }).first()).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/i);
});

test("toggles presentation mode by keyboard", async ({ page }) => {
  await page.getByRole("button", { name: "Presentation mode", exact: true }).press("Enter");
  await expect(page.getByRole("button", { name: "Monthly Cycle", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Exit presentation" }).press("Enter");
  await expect(page.getByRole("button", { name: "Monthly Cycle", exact: true })).toBeVisible();
});
