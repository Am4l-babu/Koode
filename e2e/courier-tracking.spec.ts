import { expect, test } from "@playwright/test";
import { login, logout } from "./helpers";

test("donor adds courier tracking; the organisation can follow it", async ({ page }) => {
  await login(page, "donor", "/needs?category=education");
  await page.getByRole("article").filter({ hasText: "School Bags for the New Academic Year" }).getByRole("link", { name: "School Bags for the New Academic Year", exact: true }).click();
  await page.getByRole("button", { name: /donate|commit/i }).first().click();

  const dialog = page.getByRole("dialog", { name: /Commit to a donation/ });
  await dialog.getByRole("button", { name: "Continue" }).click();
  await dialog.getByText("Delivery", { exact: true }).click();
  await dialog.getByRole("button", { name: "Continue" }).click();
  await dialog.getByLabel(/I understand that my donation is anonymous/).check();
  await dialog.getByRole("button", { name: "Continue" }).click();
  await dialog.getByRole("button", { name: "Confirm Anonymous Donation" }).click();
  const success = page.getByRole("dialog", { name: "Donation Confirmed" });
  const donationId = (await success.getByTestId("donation-id").textContent())!.trim();
  await success.getByRole("link", { name: "Track Donation" }).click();

  // The donor records the courier; a wrong format is caught first.
  const card = page.locator("section", { has: page.getByRole("heading", { name: "Courier tracking" }) });
  await card.getByLabel(/^Courier service/).selectOption("INDIA_POST");
  await card.getByLabel(/^Tracking number/).fill("12345678");
  await card.getByRole("button", { name: "Save and mark as sent" }).click();
  await expect(card.getByText(/look like EE123456789IN/)).toBeVisible();

  await card.getByLabel(/^Courier service/).selectOption("DTDC");
  await card.getByLabel(/^Tracking number/).fill("d 1234 5678");
  await card.getByRole("button", { name: "Save and mark as sent" }).click();
  await expect(card.getByTestId("tracking-summary")).toContainText("D12345678");
  await expect(card.getByRole("link", { name: /Track on DTDC/ })).toHaveAttribute("href", "https://www.dtdc.com/track-your-shipment/");
  await expect(page.locator("[aria-current=step]")).toContainText("In transit");
  await expect(page.getByText("Sent by DTDC.")).toBeVisible();

  // The organisation sees the same tracking on its donations list.
  await logout(page);
  await login(page, "recipient");
  await page.goto("/recipient/donations");
  const row = page.getByTestId("recipient-donation").filter({ hasText: donationId });
  await expect(row.getByTestId("tracking-summary")).toContainText("DTDC");
  await expect(row.getByTestId("tracking-summary")).toContainText("D12345678");
});
