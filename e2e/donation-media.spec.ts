import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { login, logout } from "./helpers";

// A real generated photo and a minimal MP4 header — enough for the server-side sniffing and re-encoding.
const makePng = () => sharp({ create: { width: 32, height: 32, channels: 3, background: "#d33" } }).png().toBuffer();
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(300)]);
const DESCRIPTION = "Two lightly used school bags, all zips working.";

test.describe("Donation description, photos and video", () => {
  test("donor adds them; video stays hidden from the recipient until an admin approves it", async ({ page }) => {
    await login(page, "donor", "/needs?category=education");
    await page.getByRole("article").filter({ hasText: "School Bags for the New Academic Year" }).getByRole("link", { name: "School Bags for the New Academic Year", exact: true }).click();
    await page.getByRole("button", { name: /donate|commit/i }).first().click();

    const dialog = page.getByRole("dialog", { name: /Commit to a donation/ });
    await dialog.getByRole("button", { name: "More School bag" }).click();

    // Contact details in the description are rejected before anything is sent.
    await dialog.getByLabel(/Description/).fill("Call me on 9876543210");
    await dialog.getByRole("button", { name: "Continue" }).click();
    await expect(dialog.getByRole("alert")).toContainText("phone number");

    await dialog.getByLabel(/Description/).fill(DESCRIPTION);
    await dialog.locator("input[type=file]").setInputFiles([
      { name: "bag.png", mimeType: "image/png", buffer: await makePng() },
      { name: "demo.mp4", mimeType: "video/mp4", buffer: MP4 },
    ]);
    await dialog.getByRole("button", { name: "Continue" }).click();
    await dialog.getByText("Partner drop-off", { exact: true }).click();
    await dialog.getByRole("button", { name: "Continue" }).click();
    await dialog.getByLabel(/I understand that my donation is anonymous/).check();
    await dialog.getByRole("button", { name: "Continue" }).click();
    await dialog.getByRole("button", { name: "Confirm Anonymous Donation" }).click();

    const success = page.getByRole("dialog", { name: "Donation Confirmed" });
    await expect(success.getByRole("heading", { name: "Donation Confirmed", level: 3 })).toBeVisible();
    await expect(success.getByText("Some files could not be added")).toHaveCount(0);
    const donationId = (await success.getByTestId("donation-id").textContent())!.trim();
    await success.getByRole("link", { name: "Track Donation" }).click();

    // Donor sees everything, with the video marked as awaiting review.
    await expect(page.getByText(DESCRIPTION)).toBeVisible();
    const gallery = page.getByRole("list", { name: "Photos and videos of the items" });
    await expect(gallery.getByRole("button", { name: "Open photo 1" })).toBeVisible();
    await expect(gallery.getByRole("button", { name: "Open video 2" })).toBeVisible();
    await expect(gallery).toContainText(/review/i);
    await logout(page);

    // Recipient: description and photo only — the video is still pending.
    await login(page, "recipient");
    await page.goto("/recipient/donations");
    const card = page.getByTestId("recipient-donation").filter({ hasText: donationId });
    await expect(card).toContainText(DESCRIPTION);
    await expect(card.getByRole("button", { name: /Open photo/ })).toHaveCount(1);
    await expect(card.getByRole("button", { name: /Open video/ })).toHaveCount(0);
    await logout(page);

    // Admin approves the video.
    await login(page, "ops");
    await page.goto("/admin/donations");
    await page.getByRole("row").filter({ hasText: donationId }).getByRole("link").first().click();
    await page.waitForURL(/\/admin\/donations\/[0-9a-f-]{36}/);
    await expect(page.getByText(DESCRIPTION)).toBeVisible();
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await logout(page);

    // Now the recipient sees both.
    await login(page, "recipient");
    await page.goto("/recipient/donations");
    const approved = page.getByTestId("recipient-donation").filter({ hasText: donationId });
    await expect(approved.getByRole("button", { name: /Open video/ })).toHaveCount(1);
  });

  test("non-media files are refused without blocking the donation form", async ({ page }) => {
    await login(page, "donor", "/needs?category=education");
    await page.getByRole("article").filter({ hasText: "School Bags for the New Academic Year" }).getByRole("link", { name: "School Bags for the New Academic Year", exact: true }).click();
    await page.getByRole("button", { name: /donate|commit/i }).first().click();
    const dialog = page.getByRole("dialog", { name: /Commit to a donation/ });
    await dialog.locator("input[type=file]").setInputFiles({ name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7") });
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Continue" })).toBeEnabled();
  });
  test("iPhone .mov clips are accepted by the picker", async ({ page }) => {
    await login(page, "donor", "/needs?category=education");
    await page.getByRole("article").filter({ hasText: "School Bags for the New Academic Year" }).getByRole("link", { name: "School Bags for the New Academic Year", exact: true }).click();
    await page.getByRole("button", { name: /donate|commit/i }).first().click();
    const dialog = page.getByRole("dialog", { name: /Commit to a donation/ });
    const mov = Buffer.concat([Buffer.from([0, 0, 0, 20]), Buffer.from("ftypqt  "), Buffer.alloc(300)]);
    await dialog.locator("input[type=file]").setInputFiles({ name: "IMG_0001.MOV", mimeType: "video/quicktime", buffer: mov });
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: /Remove/ })).toHaveCount(1);
  });
});
