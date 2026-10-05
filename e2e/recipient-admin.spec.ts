import { expect, test } from "@playwright/test";
import { expectNoLeak, login, logout, SEED_PII } from "./helpers";

test.describe("Recipient → admin approval → published", () => {
  test("recipient creates a request with the smart builder; admin approves; donors see it anonymously", async ({ page }) => {
    const title = `Rain jackets for students ${Date.now().toString().slice(-5)}`;
    await login(page, "recipient");
    await expect(page).toHaveURL(/\/recipient/);
    await page.goto("/recipient/requests/new");

    // Step 1: category
    await page.getByText("Clothing", { exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    // Step 2: describe — the PII guard blocks phone numbers in public text
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Why is this needed?").fill("Children walk to school in heavy rain. Call 9847012345 for details.");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/please remove a phone number/)).toBeVisible();
    await page.getByLabel("Why is this needed?").fill("Children walk to school through heavy monsoon rain and arrive soaked. Light rain jackets would help.");
    await page.getByRole("button", { name: "Continue" }).click();
    // Step 3: items — a product type is required, and picking one shows its own fields
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Choose a product type, or “Something else”.")).toBeVisible();
    await page.getByLabel("Product type").selectOption("Jacket / raincoat");
    await expect(page.getByLabel("Item", { exact: true })).toHaveValue("Jacket / raincoat");
    await expect(page.getByText("Jacket / raincoat details")).toBeVisible();
    await page.getByLabel("Item", { exact: true }).fill("Rain jacket");
    await page.getByLabel("Quantity").fill("15");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Size is required.")).toBeVisible();
    await page.getByLabel(/^Size/).fill("Small, Medium");
    await page.getByLabel("Type", { exact: true }).selectOption("Rain jacket");
    await page.getByLabel("Age group").selectOption("8–10");
    await page.getByRole("button", { name: "Continue" }).click();
    // Step 4: review & submit
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText(/Size: Small, Medium, Type: Rain jacket/)).toBeVisible();
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(page.getByText("Request submitted 🎉")).toBeVisible();
    const requestId = page.url().match(/NR-[A-Z0-9]+/)![0];

    // Not public yet
    const pre = await page.request.get(`/api/requests/${requestId}`);
    expect(pre.status()).toBe(404);

    await logout(page);
    await login(page, "moderator");
    await page.goto("/admin/requests?status=PENDING_VERIFICATION");
    await page.getByRole("row").filter({ hasText: title }).getByRole("link", { name: "Review →" }).click();
    await expect(page.getByText("[private]")).toBeVisible();
    await expectNoLeak(page, SEED_PII.orgNames);
    await page.getByLabel("Final priority (shown to donors)").selectOption("HIGH");
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Approved — the request is now live.")).toBeVisible();

    await logout(page);
    await page.goto(`/needs/${requestId}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("Verified Learning Center").first()).toBeVisible();
    await expect(page.getByText("Jacket / raincoat")).toBeVisible();
    await expectNoLeak(page, [...SEED_PII.orgNames, ...SEED_PII.orgContacts, ...SEED_PII.orgAddresses]);
  });

  test("recipient sees donations from anonymous donors only and can confirm receipt", async ({ page }) => {
    await login(page, "recipient");
    await page.goto("/recipient/donations");
    const first = page.getByTestId("recipient-donation").first();
    await expect(first).toContainText(/Community Donor #D[23456789A-Z]{5}/);
    await expectNoLeak(page, [...SEED_PII.donorNames, ...SEED_PII.donorEmails]);
    const receivable = page.getByTestId("recipient-donation").filter({ has: page.getByRole("button", { name: "Confirm receipt" }) }).first();
    await receivable.getByRole("button", { name: "Confirm receipt" }).click();
    await page.getByRole("button", { name: "Yes, received" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("Admin identity resolution", () => {
  test("authorized admin reveals identities behind an audited, labelled view", async ({ page }) => {
    await login(page, "ops");
    await page.goto("/admin/donations");
    await page.getByRole("row").nth(1).getByRole("link").first().click();
    await page.waitForURL(/\/admin\/donations\/[0-9a-f-]{36}/);
    await expect(page.getByText(/^Donor #D-/).first()).toBeVisible();
    await expectNoLeak(page, SEED_PII.donorNames);
    await page.getByRole("button", { name: "Reveal identities" }).click();
    await page.getByRole("button", { name: "Reveal", exact: true }).click();
    await expect(page.getByText("Sensitive information — Admin access only")).toBeVisible();
    await expect(page.getByText("DONOR", { exact: false }).first()).toBeVisible();

    await page.goto("/admin/audit-logs?action=VIEW_PRIVATE_IDENTITY");
    await expect(page.getByRole("cell", { name: "VIEW_PRIVATE_IDENTITY" }).first()).toBeVisible();
  });

  test("an admin without the identity permission cannot reveal identities", async ({ page }) => {
    await login(page, "moderator");
    await page.goto("/admin/donations");
    await page.getByRole("row").nth(1).getByRole("link").first().click();
    await page.waitForURL(/\/admin\/donations\/[0-9a-f-]{36}/);
    await expect(page.getByText(/requires the/)).toBeVisible();
    const donationId = page.url().split("/").pop()!;
    expect((await page.request.get(`/api/admin/donations/${donationId}/identity`)).status()).toBe(403);
    await expect(page.getByRole("button", { name: "Reveal identities" })).toHaveCount(0);
    await page.goto("/admin/audit-logs");
    await expect(page).toHaveURL(/denied=AUDIT_LOG_VIEW/);
  });
});
