import { expect, test } from "@playwright/test";

const baseUrl = process.env.CHECKLY_PUBLIC_BASE_URL || "https://ariostore-gadgets.onrender.com";

test("storefront add to cart and reach checkout", async ({ page }) => {
  await page.goto(`${baseUrl}/store/products`, { waitUntil: "networkidle" });

  const productCards = page.locator("a[href^='/store/products/']");
  await expect(productCards.first()).toBeVisible();

  const href = await productCards.first().getAttribute("href");
  expect(href).toBeTruthy();

  await page.goto(`${baseUrl}${href}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /add to cart/i }).click();

  await page.goto(`${baseUrl}/store/cart`, { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: /checkout/i })).toBeVisible();
  await page.getByRole("button", { name: /checkout/i }).click();

  await expect(page).toHaveURL(/\/store\/checkout/);
  await expect(page.locator("form")).toBeVisible();
});
