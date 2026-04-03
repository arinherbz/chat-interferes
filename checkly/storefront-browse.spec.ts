import { expect, test } from "@playwright/test";

const baseUrl = process.env.CHECKLY_PUBLIC_BASE_URL || "https://ariostore-gadgets.onrender.com";

test("storefront browse and product detail", async ({ page }) => {
  const response = await page.goto(`${baseUrl}/store/products`, { waitUntil: "networkidle" });
  expect(response?.status()).toBeLessThan(400);

  const productCards = page.locator("a[href^='/store/products/']");
  await expect(productCards.first()).toBeVisible();

  const href = await productCards.first().getAttribute("href");
  expect(href).toBeTruthy();

  await page.goto(`${baseUrl}${href}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: /add to cart/i })).toBeVisible();
});
