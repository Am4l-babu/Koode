import { expect, test } from "@playwright/test";
import { expectNoLeak, login, SEED_PII } from "./helpers";

test.describe("Donor journey", () => {
  test("homepage → browse → filter education → donate 2 school bags → track", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Give What Matters.");
    await page.getByRole("link", { name: "Help Someone" }).click();
    await expect(page).toHaveURL(/\/needs/);

    await page.getByRole("button", { name: /Education/ }).click();
    await expect(page).toHaveURL(/category=education/);
    const card = page.getByRole("article").filter({ hasText: "School Bags for the New Academic Year" });
    await expect(card).toBeVisible();
    await expectNoLeak(page, [...SEED_PII.orgNames, ...SEED_PII.orgContacts]);

    await card.getByRole("link", { name: "School Bags for the New Academic Year", exact: true }).click();
    await expect(page.getByText("Verified Learning Center").first()).toBeVisible();
    await expectNoLeak(page, [...SEED_PII.orgNames, ...SEED_PII.orgContacts, ...SEED_PII.orgAddresses]);

    // Guests are asked to sign in, then come straight back with the modal open.
    await page.getByRole("link", { name: "Sign in to donate" }).click();
    await page.getByLabel("Email").fill("donor@demo.local");
    await page.getByLabel("Password").fill(process.env.DEMO_PASSWORD || "E2E!DemoPass2026");
    await page.getByRole("button", { name: "Log in" }).click();

    const dialog = page.getByRole("dialog", { name: /Commit to a donation/ });
    await expect(dialog).toBeVisible();
    // Step 1 — choose 2 school bags
    await dialog.getByRole("button", { name: "More School bag" }).click();
    await expect(dialog.getByLabel(/^\d+ School bag$/)).toHaveText(/\d/);
    await dialog.getByRole("button", { name: "Continue" }).click();
    // Step 2 — partner drop-off
    await dialog.getByText("Partner drop-off", { exact: true }).click();
    await dialog.getByRole("button", { name: "Continue" }).click();
    // Step 3 — anonymity acknowledgement is required
    await dialog.getByRole("button", { name: "Continue" }).click();
    await expect(dialog.getByRole("alert")).toContainText("anonymous");
    await dialog.getByLabel(/I understand this donation is anonymous/).check();
    await dialog.getByRole("button", { name: "Continue" }).click();
    // Step 4 — review
    await expect(dialog.getByText("Verified Learning Center")).toBeVisible();
    await dialog.getByRole("button", { name: "Confirm Anonymous Donation" }).click();

    const success = page.getByRole("dialog", { name: "Donation Confirmed" });
    await expect(success.getByText("Donation Confirmed")).toBeVisible();
    const donationId = (await success.getByTestId("donation-id").textContent())!.trim();
    expect(donationId).toMatch(/^DN-[23456789A-Z]{6}$/);

    await success.getByRole("link", { name: "Track Donation" }).click();
    await expect(page).toHaveURL(new RegExp(`/donor/donations/${donationId}`));
    await expect(page.getByRole("list", { name: "Donation status timeline" })).toContainText("Donation confirmed");
    await expect(page.getByText("Your identity is protected").first()).toBeVisible();

    await page.getByRole("button", { name: "Mark as preparing" }).click();
    await expect(page.getByText("Current")).toBeVisible();
    await expect(page.locator("[aria-current=step]")).toContainText("Preparing");
  });

  test("donor dashboard shows personal impact without public leaderboards", async ({ page }) => {
    await login(page, "donor");
    await expect(page).toHaveURL(/\/donor/);
    await expect(page.getByText("Requests supported")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Needs you can fulfil" })).toBeVisible();
    await expectNoLeak(page, [...SEED_PII.orgNames, ...SEED_PII.orgContacts]);
  });

  test("a donor cannot open admin or recipient areas", async ({ page }) => {
    await login(page, "donor");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/donor/);
    await page.goto("/recipient");
    await expect(page).toHaveURL(/\/donor/);
    const res = await page.request.get("/api/admin/donations");
    expect(res.status()).toBe(403);
  });
});
