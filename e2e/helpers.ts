import { expect, type Page } from "@playwright/test";
import { E2E_ENV } from "../playwright.config";

export const ACCOUNTS = {
  admin: { email: E2E_ENV.ADMIN_EMAIL, password: E2E_ENV.ADMIN_PASSWORD },
  ops: { email: "ops.admin@koode.local", password: E2E_ENV.DEMO_PASSWORD },
  moderator: { email: "moderator@koode.local", password: E2E_ENV.DEMO_PASSWORD },
  donor: { email: "donor@demo.local", password: E2E_ENV.DEMO_PASSWORD },
  recipient: { email: "learning@demo.local", password: E2E_ENV.DEMO_PASSWORD },
};

/** Private strings from the seed that must never appear on donor-facing pages. */
export const SEED_PII = {
  orgNames: ["St. Alphonsa Learning Centre Trust", "Nanma Children's Home Society", "Snehatheeram Old Age Home", "Kunjikkuruvi Play School", "Janasevana Community Kitchen"],
  orgContacts: ["Sister Mary Thomas", "Abdul Rasheed", "Geetha Kumari", "Bindu Joseph", "Suresh Babu"],
  orgAddresses: ["Near Railway Station Road", "Palarivattom", "Temple Road, Ottapalam"],
  donorNames: ["Anjali Menon", "Rahul Nair", "Fathima Beevi", "Joseph Mathew"],
  donorEmails: ["donor@demo.local", "donor2@demo.local"],
};

export async function login(page: Page, who: keyof typeof ACCOUNTS, next?: string) {
  await page.goto(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.getByLabel("Email").fill(ACCOUNTS[who].email);
  await page.getByLabel("Password", { exact: true }).fill(ACCOUNTS[who].password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function logout(page: Page) {
  await page.context().clearCookies();
}

export async function expectNoLeak(page: Page, secrets: string[]) {
  const html = await page.content();
  for (const s of secrets) expect(html, `page leaked "${s}"`).not.toContain(s);
}
