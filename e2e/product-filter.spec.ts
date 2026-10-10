import { expect, test } from "@playwright/test";

test("donors can narrow a category to one product type", async ({ page }) => {
  await page.goto("/needs?category=clothing");
  const products = page.getByRole("group", { name: "Clothing types" });
  await expect(products.getByRole("button", { name: /Shirt \/ T-shirt/ })).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: "School Uniforms for Grade 3 and 4" })).toBeVisible();

  await products.getByRole("button", { name: /Shirt \/ T-shirt/ }).click();
  await expect(page).toHaveURL(/product=Shirt/);
  await expect(page.getByRole("article").filter({ hasText: "Children's Shirts for Daily Wear" })).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: "School Uniforms for Grade 3 and 4" })).toHaveCount(0);
  await expect(page.getByText(/Showing results for .*Shirt \/ T-shirt/)).toHaveCount(0); // not a text search

  // Switching category clears the product filter.
  await page.getByRole("button", { name: /Food/ }).first().click();
  await expect(page).toHaveURL(/category=food/);
  await expect(page).not.toHaveURL(/product=/);
});
