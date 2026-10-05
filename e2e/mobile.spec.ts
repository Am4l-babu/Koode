import { expect, test } from "@playwright/test";

test("mobile donor flow: open → browse → choose need → donate prompt", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.locator("#mobile-menu").getByRole("link", { name: "Browse Needs" }).click();
  await expect(page).toHaveURL(/\/needs/);
  const card = page.getByRole("article").first();
  await card.getByRole("link", { name: /^Help with/ }).click();
  await expect(page.getByRole("link", { name: "Sign in to donate" })).toBeVisible();
  // No horizontal overflow on phones.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
