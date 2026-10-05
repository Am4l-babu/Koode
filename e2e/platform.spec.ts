import { expect, test } from "@playwright/test";

test.describe("Platform quality", () => {
  test("security headers are set", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("session cookie is httpOnly + SameSite", async ({ page }) => {
    const res = await page.request.post("/api/auth/login", { data: { email: "donor@demo.local", password: process.env.DEMO_PASSWORD || "E2E!DemoPass2026" } });
    expect(res.status()).toBe(200);
    const cookie = res.headers()["set-cookie"]!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
  });

  test("keyboard users get a skip link and accessible dialogs", async ({ page }) => {
    await page.goto("/needs");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
    const firstNeed = page.getByRole("article").first();
    await firstNeed.getByRole("link").first().click();
    await page.getByRole("button", { name: "Report this request" }).click();
    const dialog = page.getByRole("dialog", { name: "Report this request" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("natural-language search interprets the query", async ({ page }) => {
    await page.goto("/needs?q=shirts+size+30");
    await expect(page.getByText(/Showing results for/)).toContainText("size 30");
    await expect(page.getByRole("article").filter({ hasText: "Children's Shirts" })).toBeVisible();
  });

  test("category SEO pages and impact page render", async ({ page }) => {
    await page.goto("/needs/food");
    await expect(page.getByRole("heading", { name: "Food needs" })).toBeVisible();
    await page.goto("/impact");
    await expect(page.getByText("Items donated").first()).toBeVisible();
  });

  test("friendly 404 without internals", async ({ page }) => {
    const res = await page.goto("/needs/NR-ZZZZZZ");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("We couldn't find that page")).toBeVisible();
  });

  test("language switch to Malayalam", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Language").first().selectOption("ml");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("യഥാർത്ഥത്തിൽ ആവശ്യമുള്ളത് നൽകൂ");
    await page.getByLabel("Language").first().selectOption("en");
  });

  test("dark mode toggle persists", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /Colour theme/ }).first();
    await toggle.click(); // system → light
    await toggle.click(); // light → dark
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});
