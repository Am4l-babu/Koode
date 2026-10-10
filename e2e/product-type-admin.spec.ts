import { expect, test } from "@playwright/test";
import { login, logout } from "./helpers";

test("an admin adds a product type and organisations can request it", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/admin/settings");
  await page.getByRole("link", { name: "Edit Medical Support product types" }).click();
  await expect(page.getByRole("heading", { name: "Product types", level: 1 })).toBeVisible();
  await expect(page.getByText("Using the built-in list. Saving makes it your own.")).toBeVisible();

  await page.getByRole("button", { name: "Add product type" }).click();
  await page.getByRole("button", { name: "Save product types" }).click();
  await expect(page.getByText("Give the product type a name.")).toBeVisible();

  await page.getByLabel(/^Name/).fill("Hearing aid");
  await page.getByLabel("Default quantity unit").fill("pieces");
  await page.getByRole("button", { name: "Add detail" }).click();
  await page.getByLabel(/^Label/).fill("Which ear");
  await expect(page.getByText("Saved as whichEar")).toBeVisible();
  await page.getByLabel("Answer type").selectOption("select");
  await page.getByLabel(/^Choices/).fill("Left, Right, Both");
  await page.getByLabel("Organisations must fill this in").check();
  const preview = page.getByRole("region", { name: "Preview" });
  await expect(preview.getByLabel(/^Which ear/)).toBeVisible();
  await page.getByRole("button", { name: "Save product types" }).click();
  await expect(page.getByText("Product types saved.")).toBeVisible();
  await expect(page.getByText("Customised")).toBeVisible();

  await logout(page);
  await login(page, "recipient");
  await page.goto("/recipient/requests/new");
  await page.getByText("Medical Support", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Title").fill("Hearing aids for two residents");
  await page.getByLabel("Why is this needed?").fill("Two elderly residents have lost much of their hearing and need hearing aids to talk with others.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Product type").selectOption("Hearing aid");
  await expect(page.getByText("Hearing aid details")).toBeVisible();
  await expect(page.getByLabel(/^Which ear/)).toBeVisible();
  await expect(page.getByLabel("Unit", { exact: true })).toHaveValue("pieces");

  // Put the built-in list back so other tests see the catalogue they expect.
  await logout(page);
  await login(page, "admin");
  await page.goto("/admin/settings/categories/medical-support");
  await page.getByRole("button", { name: "Restore built-in list" }).click();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByText("Back to the built-in product types.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Hearing aid/ })).toHaveCount(0);
});
