import { storage } from "../server/storage";

async function main() {
  const existingBrands = await storage.getBrands();
  if (existingBrands.length > 0) {
    console.log(`Brands already seeded (${existingBrands.length})`);
    return;
  }

  // Apple data
  const apple = await storage.createBrand({ name: "Apple", sortOrder: 1, isActive: true });
  const iphone16ProMax = await storage.createModel({ brandId: apple.id, name: "iPhone 16 Pro Max", sortOrder: 1, isActive: true });
  const iphone16Pro = await storage.createModel({ brandId: apple.id, name: "iPhone 16 Pro", sortOrder: 2, isActive: true });
  const iphone16Plus = await storage.createModel({ brandId: apple.id, name: "iPhone 16 Plus", sortOrder: 3, isActive: true });
  const iphone16 = await storage.createModel({ brandId: apple.id, name: "iPhone 16", sortOrder: 4, isActive: true });
  const iphone15ProMax = await storage.createModel({ brandId: apple.id, name: "iPhone 15 Pro Max", sortOrder: 5, isActive: true });
  const iphone15Pro = await storage.createModel({ brandId: apple.id, name: "iPhone 15 Pro", sortOrder: 6, isActive: true });
  const iphone15Plus = await storage.createModel({ brandId: apple.id, name: "iPhone 15 Plus", sortOrder: 7, isActive: true });
  const iphone15 = await storage.createModel({ brandId: apple.id, name: "iPhone 15", sortOrder: 8, isActive: true });
  const iphone14ProMax = await storage.createModel({ brandId: apple.id, name: "iPhone 14 Pro Max", sortOrder: 9, isActive: true });
  const iphone14Pro = await storage.createModel({ brandId: apple.id, name: "iPhone 14 Pro", sortOrder: 10, isActive: true });
  const iphone14Plus = await storage.createModel({ brandId: apple.id, name: "iPhone 14 Plus", sortOrder: 11, isActive: true });
  const iphone14 = await storage.createModel({ brandId: apple.id, name: "iPhone 14", sortOrder: 12, isActive: true });
  const iphone13ProMax = await storage.createModel({ brandId: apple.id, name: "iPhone 13 Pro Max", sortOrder: 13, isActive: true });
  const iphone13Pro = await storage.createModel({ brandId: apple.id, name: "iPhone 13 Pro", sortOrder: 14, isActive: true });
  const iphone13 = await storage.createModel({ brandId: apple.id, name: "iPhone 13", sortOrder: 15, isActive: true });
  const iphone13Mini = await storage.createModel({ brandId: apple.id, name: "iPhone 13 Mini", sortOrder: 16, isActive: true });
  const iphone12ProMax = await storage.createModel({ brandId: apple.id, name: "iPhone 12 Pro Max", sortOrder: 17, isActive: true });
  const iphone12Pro = await storage.createModel({ brandId: apple.id, name: "iPhone 12 Pro", sortOrder: 18, isActive: true });
  const iphone12 = await storage.createModel({ brandId: apple.id, name: "iPhone 12", sortOrder: 19, isActive: true });
  const iphone12Mini = await storage.createModel({ brandId: apple.id, name: "iPhone 12 Mini", sortOrder: 20, isActive: true });
  const iphoneSE3 = await storage.createModel({ brandId: apple.id, name: "iPhone SE (3rd Gen)", sortOrder: 21, isActive: true });
  const iphone11ProMax = await storage.createModel({ brandId: apple.id, name: "iPhone 11 Pro Max", sortOrder: 22, isActive: true });
  const iphone11Pro = await storage.createModel({ brandId: apple.id, name: "iPhone 11 Pro", sortOrder: 23, isActive: true });
  const iphone11 = await storage.createModel({ brandId: apple.id, name: "iPhone 11", sortOrder: 24, isActive: true });

  // Storage options for Pro/Pro Max models (256GB, 512GB, 1TB)
  for (const m of [iphone16ProMax, iphone16Pro, iphone15ProMax, iphone15Pro, iphone14ProMax, iphone14Pro, iphone13ProMax, iphone13Pro]) {
    await storage.createStorageOption({ modelId: m.id, size: "256GB", sortOrder: 1, isActive: true });
    await storage.createStorageOption({ modelId: m.id, size: "512GB", sortOrder: 2, isActive: true });
    await storage.createStorageOption({ modelId: m.id, size: "1TB", sortOrder: 3, isActive: true });
  }

  // Storage options for standard models (128GB, 256GB, 512GB)
  for (const m of [iphone16Plus, iphone16, iphone15Plus, iphone15, iphone14Plus, iphone14, iphone13, iphone12, iphone11]) {
    await storage.createStorageOption({ modelId: m.id, size: "128GB", sortOrder: 1, isActive: true });
    await storage.createStorageOption({ modelId: m.id, size: "256GB", sortOrder: 2, isActive: true });
    await storage.createStorageOption({ modelId: m.id, size: "512GB", sortOrder: 3, isActive: true });
  }

  // Storage options for Mini models (64GB, 128GB, 256GB)
  for (const m of [iphone13Mini, iphone12Mini]) {
    await storage.createStorageOption({ modelId: m.id, size: "64GB", sortOrder: 1, isActive: true });
    await storage.createStorageOption({ modelId: m.id, size: "128GB", sortOrder: 2, isActive: true });
    await storage.createStorageOption({ modelId: m.id, size: "256GB", sortOrder: 3, isActive: true });
  }

  // Storage options for 12 Pro/Pro Max (128GB, 256GB, 512GB)
  for (const m of [iphone12ProMax, iphone12Pro]) {
    await storage.createStorageOption({ modelId: m.id, size: "128GB", sortOrder: 1, isActive: true });
    await storage.createStorageOption({ modelId: m.id, size: "256GB", sortOrder: 2, isActive: true });
    await storage.createStorageOption({ modelId: m.id, size: "512GB", sortOrder: 3, isActive: true });
  }

  // Storage options for 11 Pro/Pro Max (64GB, 256GB, 512GB)
  for (const m of [iphone11ProMax, iphone11Pro]) {
    await storage.createStorageOption({ modelId: m.id, size: "64GB", sortOrder: 1, isActive: true });
    await storage.createStorageOption({ modelId: m.id, size: "256GB", sortOrder: 2, isActive: true });
    await storage.createStorageOption({ modelId: m.id, size: "512GB", sortOrder: 3, isActive: true });
  }

  // Storage for SE (64GB, 128GB, 256GB)
  await storage.createStorageOption({ modelId: iphoneSE3.id, size: "64GB", sortOrder: 1, isActive: true });
  await storage.createStorageOption({ modelId: iphoneSE3.id, size: "128GB", sortOrder: 2, isActive: true });
  await storage.createStorageOption({ modelId: iphoneSE3.id, size: "256GB", sortOrder: 3, isActive: true });

  // Samsung data
  const samsung = await storage.createBrand({ name: "Samsung", sortOrder: 2, isActive: true });
  const s24Ultra = await storage.createModel({ brandId: samsung.id, name: "Galaxy S24 Ultra", sortOrder: 1, isActive: true });
  const s24Plus = await storage.createModel({ brandId: samsung.id, name: "Galaxy S24+", sortOrder: 2, isActive: true });
  const s24 = await storage.createModel({ brandId: samsung.id, name: "Galaxy S24", sortOrder: 3, isActive: true });
  const s23Ultra = await storage.createModel({ brandId: samsung.id, name: "Galaxy S23 Ultra", sortOrder: 4, isActive: true });
  const s23Plus = await storage.createModel({ brandId: samsung.id, name: "Galaxy S23+", sortOrder: 5, isActive: true });
  const s23 = await storage.createModel({ brandId: samsung.id, name: "Galaxy S23", sortOrder: 6, isActive: true });
  const zFold5 = await storage.createModel({ brandId: samsung.id, name: "Galaxy Z Fold5", sortOrder: 7, isActive: true });
  const zFlip5 = await storage.createModel({ brandId: samsung.id, name: "Galaxy Z Flip5", sortOrder: 8, isActive: true });
  const a54 = await storage.createModel({ brandId: samsung.id, name: "Galaxy A54", sortOrder: 9, isActive: true });

  // Samsung storage options
  for (const m of [s24Ultra, s23Ultra]) {
    await storage.createStorageOption({ modelId: m.id, size: "256GB", sortOrder: 1, isActive: true });
    await storage.createStorageOption({ modelId: m.id, size: "512GB", sortOrder: 2, isActive: true });
    await storage.createStorageOption({ modelId: m.id, size: "1TB", sortOrder: 3, isActive: true });
  }

  for (const m of [s24Plus, s24, s23Plus, s23, zFold5, zFlip5]) {
    await storage.createStorageOption({ modelId: m.id, size: "256GB", sortOrder: 1, isActive: true });
    await storage.createStorageOption({ modelId: m.id, size: "512GB", sortOrder: 2, isActive: true });
  }

  await storage.createStorageOption({ modelId: a54.id, size: "128GB", sortOrder: 1, isActive: true });
  await storage.createStorageOption({ modelId: a54.id, size: "256GB", sortOrder: 2, isActive: true });

  // Google data
  const google = await storage.createBrand({ name: "Google", sortOrder: 3, isActive: true });
  const pixel8Pro = await storage.createModel({ brandId: google.id, name: "Pixel 8 Pro", sortOrder: 1, isActive: true });
  const pixel8 = await storage.createModel({ brandId: google.id, name: "Pixel 8", sortOrder: 2, isActive: true });
  const pixel7Pro = await storage.createModel({ brandId: google.id, name: "Pixel 7 Pro", sortOrder: 3, isActive: true });
  const pixel7 = await storage.createModel({ brandId: google.id, name: "Pixel 7", sortOrder: 4, isActive: true });
  const pixel7a = await storage.createModel({ brandId: google.id, name: "Pixel 7a", sortOrder: 5, isActive: true });

  for (const m of [pixel8Pro, pixel8, pixel7Pro, pixel7]) {
    await storage.createStorageOption({ modelId: m.id, size: "128GB", sortOrder: 1, isActive: true });
    await storage.createStorageOption({ modelId: m.id, size: "256GB", sortOrder: 2, isActive: true });
  }

  await storage.createStorageOption({ modelId: pixel7a.id, size: "128GB", sortOrder: 1, isActive: true });

  console.log("Brands, models, and storage options seeded successfully");
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
