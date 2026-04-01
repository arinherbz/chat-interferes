import express from "express";
import { createServer } from "http";
import { pbkdf2Sync, randomBytes } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { registerRoutes } from "../routes";
import { storage } from "../storage";

const hashIterations = 120000;

function hashSecret(secret: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = pbkdf2Sync(secret, salt, hashIterations, 64, "sha512").toString("hex");
  return `pbkdf2:${hashIterations}:${salt}:${derived}`;
}

function uniqueUsername(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe("authentication", () => {
  let baseUrl = "";
  let server: ReturnType<typeof createServer>;

  beforeAll(async () => {
    const app = express();
    server = createServer(app);

    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    await registerRoutes(server, app);

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to resolve test server address");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("valid login works and session persists on refresh", async () => {
    const username = uniqueUsername("auth-owner");
    const password = "StrongPass!123";

    await storage.createUser({
      username,
      password: hashSecret(password),
      name: "Auth Owner",
      email: `${username}@example.com`,
      role: "Owner",
      status: "active",
      shopId: null,
    });

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, secret: password }),
    });

    expect(loginRes.status).toBe(200);
    const setCookie = loginRes.headers.get("set-cookie");
    expect(setCookie).toContain("connect.sid=");

    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: setCookie! },
    });

    expect(meRes.status).toBe(200);
    const meBody = await meRes.json();
    expect(meBody.user.username).toBe(username);
  });

  it("invalid password shows a clear error", async () => {
    const username = uniqueUsername("auth-staff");
    const password = "Correct!123";

    await storage.createUser({
      username,
      password: hashSecret(password),
      name: "Auth Staff",
      email: `${username}@example.com`,
      role: "Sales",
      status: "active",
      shopId: null,
    });

    const badLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, secret: "wrong-pass" }),
    });

    expect(badLoginRes.status).toBe(401);
    await expect(badLoginRes.json()).resolves.toMatchObject({
      message: "Incorrect username or password.",
    });
  });

  it("logout clears the session", async () => {
    const username = uniqueUsername("auth-logout");
    const password = "Logout!123";

    await storage.createUser({
      username,
      password: hashSecret(password),
      name: "Logout User",
      email: `${username}@example.com`,
      role: "Manager",
      status: "active",
      shopId: null,
    });

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, secret: password }),
    });
    const setCookie = loginRes.headers.get("set-cookie");
    expect(setCookie).toContain("connect.sid=");

    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: setCookie! },
    });
    expect(logoutRes.status).toBe(200);

    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: setCookie! },
    });
    expect(meRes.status).toBe(401);
  });

  it("rejects disabled users even with an existing session", async () => {
    const username = uniqueUsername("auth-disabled");
    const password = "Disabled!123";

    const user = await storage.createUser({
      username,
      password: hashSecret(password),
      name: "Disabled User",
      email: `${username}@example.com`,
      role: "Sales",
      status: "active",
      shopId: null,
    });

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, secret: password }),
    });
    const setCookie = loginRes.headers.get("set-cookie");
    expect(setCookie).toContain("connect.sid=");

    await storage.setUserStatus(user.id, "disabled");

    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: setCookie! },
    });
    expect(meRes.status).toBe(403);
    await expect(meRes.json()).resolves.toMatchObject({
      message: "Your account has been disabled. Contact an administrator.",
    });
  });

  it("returns the available shops list", async () => {
    const username = uniqueUsername("auth-shops");
    const password = "Shops!123";

    await storage.createUser({
      username,
      password: hashSecret(password),
      name: "Shop Reader",
      email: `${username}@example.com`,
      role: "Owner",
      status: "active",
      shopId: null,
    });

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, secret: password }),
    });
    const setCookie = loginRes.headers.get("set-cookie");
    expect(setCookie).toContain("connect.sid=");

    const shopsRes = await fetch(`${baseUrl}/api/shops`, {
      headers: { Cookie: setCookie! },
    });
    expect(shopsRes.status).toBe(200);

    const shops = await shopsRes.json();
    expect(Array.isArray(shops)).toBe(true);
  });

  it("creates customers and sales through authenticated API routes", async () => {
    const username = uniqueUsername("auth-pos");
    const password = "PosFlow!123";

    await storage.createUser({
      username,
      password: hashSecret(password),
      name: "POS Owner",
      email: `${username}@example.com`,
      role: "Owner",
      status: "active",
      shopId: null,
    });

    const product = await storage.createProduct({
      name: "Test Cable",
      category: "Accessories",
      price: 20000,
      costPrice: 10000,
      stock: 5,
      minStock: 1,
      shopId: null,
    });

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, secret: password }),
    });
    const setCookie = loginRes.headers.get("set-cookie");
    expect(setCookie).toContain("connect.sid=");

    const customerRes = await fetch(`${baseUrl}/api/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: setCookie!,
      },
      body: JSON.stringify({
        name: "Jane Customer",
        phone: "+256700000001",
        email: "jane@example.com",
      }),
    });
    expect(customerRes.status).toBe(201);
    const customer = await customerRes.json();

    const saleRes = await fetch(`${baseUrl}/api/sales`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: setCookie!,
      },
      body: JSON.stringify({
        customerId: customer.id,
        customerName: customer.name,
        items: [
          {
            id: "item-1",
            productId: product.id,
            name: product.name,
            quantity: 2,
            unitPrice: product.price,
            totalPrice: product.price * 2,
          },
        ],
        totalAmount: product.price * 2,
        paymentMethod: "Cash",
        status: "Completed",
        soldBy: "POS Owner",
      }),
    });
    expect(saleRes.status).toBe(201);
    const sale = await saleRes.json();
    expect(sale.saleNumber).toBeTruthy();

    const salesRes = await fetch(`${baseUrl}/api/sales`, {
      headers: { Cookie: setCookie! },
    });
    expect(salesRes.status).toBe(200);
    const sales = await salesRes.json();
    expect(sales.some((entry: any) => entry.id === sale.id)).toBe(true);

    const customersRes = await fetch(`${baseUrl}/api/customers`, {
      headers: { Cookie: setCookie! },
    });
    expect(customersRes.status).toBe(200);
    const customers = await customersRes.json();
    const updatedCustomer = customers.find((entry: any) => entry.id === customer.id);
    expect(updatedCustomer.totalPurchases).toBe(1);
  });

  it("creates devices and marks them sold through the POS sale flow", async () => {
    const username = uniqueUsername("auth-device");
    const password = "DeviceFlow!123";

    await storage.createUser({
      username,
      password: hashSecret(password),
      name: "Device Owner",
      email: `${username}@example.com`,
      role: "Owner",
      status: "active",
      shopId: null,
    });

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, secret: password }),
    });
    const setCookie = loginRes.headers.get("set-cookie");
    expect(setCookie).toContain("connect.sid=");

    const deviceRes = await fetch(`${baseUrl}/api/devices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: setCookie!,
      },
      body: JSON.stringify({
        brand: "Apple",
        model: "iPhone 14",
        imei: `356998${Date.now()}`,
        color: "Silver",
        storage: "128GB",
        condition: "New",
        price: 3200000,
        cost: 2800000,
      }),
    });
    expect(deviceRes.status).toBe(201);
    const device = await deviceRes.json();
    expect(device.status).toBe("In Stock");

    const saleRes = await fetch(`${baseUrl}/api/sales`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: setCookie!,
      },
      body: JSON.stringify({
        customerName: "Walk-in Customer",
        items: [
          {
            id: "device-item-1",
            deviceId: device.id,
            name: `${device.brand} ${device.model}`,
            quantity: 1,
            unitPrice: device.price,
            totalPrice: device.price,
          },
        ],
        totalAmount: device.price,
        paymentMethod: "Cash",
        status: "Completed",
        soldBy: "Device Owner",
      }),
    });
    expect(saleRes.status).toBe(201);

    const devicesRes = await fetch(`${baseUrl}/api/devices`, {
      headers: { Cookie: setCookie! },
    });
    expect(devicesRes.status).toBe(200);
    const devices = await devicesRes.json();
    const updatedDevice = devices.find((entry: any) => entry.id === device.id);
    expect(updatedDevice.status).toBe("Sold");
  });

  it("creates an online order and restores stock when cancelled", async () => {
    const username = uniqueUsername("auth-order");
    const password = "OrderFlow!123";

    await storage.createUser({
      username,
      password: hashSecret(password),
      name: "Order Manager",
      email: `${username}@example.com`,
      role: "Owner",
      status: "active",
      shopId: null,
    });

    const product = await storage.createProduct({
      name: "Order Test Charger",
      category: "Accessories",
      price: 45000,
      costPrice: 20000,
      stock: 3,
      minStock: 1,
      shopId: null,
    });

    const checkoutRes = await fetch(`${baseUrl}/api/store/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Online Buyer",
        customerPhone: "0700000002",
        customerEmail: "buyer@example.com",
        deliveryType: "KAMPALA",
        deliveryAddress: "Kampala Road",
        deliveryFee: 15000,
        paymentMethod: "MTN_MOMO",
        items: [{ productId: product.id, quantity: 1 }],
      }),
    });
    expect(checkoutRes.status).toBe(201);
    const order = await checkoutRes.json();
    expect(order.orderNumber).toBeTruthy();

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, secret: password }),
    });
    const setCookie = loginRes.headers.get("set-cookie");
    expect(setCookie).toContain("connect.sid=");

    const productAfterOrder = await storage.getProduct(product.id);
    expect(productAfterOrder?.stock).toBe(2);

    const cancelRes = await fetch(`${baseUrl}/api/orders/${order.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: setCookie!,
      },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    expect(cancelRes.status).toBe(200);

    const productAfterCancel = await storage.getProduct(product.id);
    expect(productAfterCancel?.stock).toBe(3);
  });

  it("creates repairs and updates their status through authenticated routes", async () => {
    const username = uniqueUsername("auth-repair");
    const password = "RepairFlow!123";

    await storage.createUser({
      username,
      password: hashSecret(password),
      name: "Repair Manager",
      email: `${username}@example.com`,
      role: "Manager",
      status: "active",
      shopId: null,
    });

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, secret: password }),
    });
    const setCookie = loginRes.headers.get("set-cookie");
    expect(setCookie).toContain("connect.sid=");

    const repairRes = await fetch(`${baseUrl}/api/repairs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: setCookie!,
      },
      body: JSON.stringify({
        deviceBrand: "Apple",
        deviceModel: "iPhone 12",
        imei: `REPAIR-${Date.now()}`,
        issueDescription: "Screen flickering after drop",
        repairType: "Screen Replacement",
        price: 250000,
        cost: 120000,
        technician: "Repair Manager",
        customerName: "Alex Customer",
      }),
    });
    expect(repairRes.status).toBe(201);
    const repair = await repairRes.json();
    expect(repair.status).toBe("Pending");

    const statusRes = await fetch(`${baseUrl}/api/repairs/${repair.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: setCookie!,
      },
      body: JSON.stringify({ status: "Completed" }),
    });
    expect(statusRes.status).toBe(200);
    const updated = await statusRes.json();
    expect(updated.status).toBe("Completed");

    const repairsRes = await fetch(`${baseUrl}/api/repairs`, {
      headers: { Cookie: setCookie! },
    });
    expect(repairsRes.status).toBe(200);
    const repairs = await repairsRes.json();
    expect(repairs.some((entry: any) => entry.id === repair.id && entry.status === "Completed")).toBe(true);
  });

  it("records expenses and daily closures through authenticated routes", async () => {
    const username = uniqueUsername("auth-close");
    const password = "CloseFlow!123";

    await storage.createUser({
      username,
      password: hashSecret(password),
      name: "Close Manager",
      email: `${username}@example.com`,
      role: "Manager",
      status: "active",
      shopId: null,
    });

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, secret: password }),
    });
    const setCookie = loginRes.headers.get("set-cookie");
    expect(setCookie).toContain("connect.sid=");

    const expenseRes = await fetch(`${baseUrl}/api/expenses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: setCookie!,
      },
      body: JSON.stringify({
        category: "Supplies",
        description: "Printer paper",
        amount: 45000,
        paymentMethod: "Cash",
      }),
    });
    expect(expenseRes.status).toBe(201);
    const expense = await expenseRes.json();
    expect(expense.amount).toBe(45000);

    const closureRes = await fetch(`${baseUrl}/api/closures`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: setCookie!,
      },
      body: JSON.stringify({
        cashExpected: 100000,
        cashCounted: 100000,
        mtnAmount: 0,
        airtelAmount: 0,
        cardAmount: 0,
        expensesTotal: 45000,
        variance: 0,
        submittedBy: "Close Manager",
        status: "confirmed",
        proofs: {
          cashDrawer: "https://example.com/proof.jpg",
        },
        sales: [],
        repairs: [],
      }),
    });
    expect(closureRes.status).toBe(201);
    const closure = await closureRes.json();
    expect(closure.status).toBe("confirmed");

    const closuresRes = await fetch(`${baseUrl}/api/closures`, {
      headers: { Cookie: setCookie! },
    });
    expect(closuresRes.status).toBe(200);
    const closures = await closuresRes.json();
    expect(closures.some((entry: any) => entry.id === closure.id)).toBe(true);
  });

  it("creates leads and follow-ups through authenticated routes", async () => {
    const username = uniqueUsername("auth-lead");
    const password = "LeadFlow!123";

    await storage.createUser({
      username,
      password: hashSecret(password),
      name: "Lead Manager",
      email: `${username}@example.com`,
      role: "Manager",
      status: "active",
      shopId: null,
    });

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, secret: password }),
    });
    const setCookie = loginRes.headers.get("set-cookie");
    expect(setCookie).toContain("connect.sid=");

    const leadRes = await fetch(`${baseUrl}/api/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: setCookie!,
      },
      body: JSON.stringify({
        customerName: "Pipeline Prospect",
        customerPhone: "+256700000099",
        customerEmail: "lead@example.com",
        source: "Walk-in",
        priority: "high",
        status: "new",
      }),
    });
    expect(leadRes.status).toBe(201);
    const lead = await leadRes.json();
    expect(lead.customerName).toBe("Pipeline Prospect");

    const followUpRes = await fetch(`${baseUrl}/api/leads/${lead.id}/follow-ups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: setCookie!,
      },
      body: JSON.stringify({
        note: "Called customer and scheduled revisit",
        result: "continue",
      }),
    });
    expect(followUpRes.status).toBe(200);
    const updatedLead = await followUpRes.json();
    expect(Array.isArray(updatedLead.followUpHistory)).toBe(true);
    expect(updatedLead.followUpHistory.length).toBe(1);

    const leadsRes = await fetch(`${baseUrl}/api/leads`, {
      headers: { Cookie: setCookie! },
    });
    expect(leadsRes.status).toBe(200);
    const leads = await leadsRes.json();
    expect(leads.some((entry: any) => entry.id === lead.id)).toBe(true);
  });

  it("rejects invalid lead updates with a clear validation error", async () => {
    const username = uniqueUsername("auth-lead-invalid");
    const password = "LeadInvalid!123";

    await storage.createUser({
      username,
      password: hashSecret(password),
      name: "Lead Owner",
      email: `${username}@example.com`,
      role: "Owner",
      status: "active",
      shopId: null,
    });

    const lead = await storage.createLead({
      customerName: "Validation Target",
      customerPhone: "+256700000111",
      customerEmail: null,
      source: "Referral",
      notes: null,
      assignedTo: null,
      priority: "normal",
      status: "new",
      nextFollowUpAt: null,
      followUpHistory: [],
      createdBy: null,
      createdByName: null,
      shopId: null,
    });

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, secret: password }),
    });
    const setCookie = loginRes.headers.get("set-cookie");
    expect(setCookie).toContain("connect.sid=");

    const badUpdateRes = await fetch(`${baseUrl}/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: setCookie!,
      },
      body: JSON.stringify({
        status: "not-a-real-status",
      }),
    });

    expect(badUpdateRes.status).toBe(400);
    await expect(badUpdateRes.json()).resolves.toMatchObject({
      message: "Invalid payload",
    });
  });

  it("returns a message-based validation error for invalid trade-in base value lookups", async () => {
    const username = uniqueUsername("auth-base-value");
    const password = "BaseValue!123";

    await storage.createUser({
      username,
      password: hashSecret(password),
      name: "Base Value Reader",
      email: `${username}@example.com`,
      role: "Manager",
      status: "active",
      shopId: null,
    });

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, secret: password }),
    });
    const setCookie = loginRes.headers.get("set-cookie");
    expect(setCookie).toContain("connect.sid=");

    const res = await fetch(`${baseUrl}/api/trade-in/base-value`, {
      headers: { Cookie: setCookie! },
    });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      message: "Brand, model, and storage are required",
    });
  });

  it("returns a message-based validation result for invalid IMEI checks", async () => {
    const username = uniqueUsername("auth-imei");
    const password = "ImeiCheck!123";

    await storage.createUser({
      username,
      password: hashSecret(password),
      name: "IMEI Checker",
      email: `${username}@example.com`,
      role: "Manager",
      status: "active",
      shopId: null,
    });

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, secret: password }),
    });
    const setCookie = loginRes.headers.get("set-cookie");
    expect(setCookie).toContain("connect.sid=");

    const res = await fetch(`${baseUrl}/api/trade-in/validate-imei/12345`, {
      headers: { Cookie: setCookie! },
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      valid: false,
      message: expect.any(String),
      blocked: false,
      duplicate: false,
    });
  });

  it("returns a message-based validation error for invalid product creation", async () => {
    const username = uniqueUsername("auth-product-invalid");
    const password = "ProductInvalid!123";

    await storage.createUser({
      username,
      password: hashSecret(password),
      name: "Product Manager",
      email: `${username}@example.com`,
      role: "Manager",
      status: "active",
      shopId: null,
    });

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, secret: password }),
    });
    const setCookie = loginRes.headers.get("set-cookie");
    expect(setCookie).toContain("connect.sid=");

    const res = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: setCookie!,
      },
      body: JSON.stringify({
        name: "Broken Stock Item",
        category: "Accessories",
        price: 1000,
        costPrice: 500,
        stock: -1,
        minStock: 0,
      }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      message: "Stock values cannot be negative",
    });
  });

  it("returns a message-based error when trade-in calculation has no base value", async () => {
    const username = uniqueUsername("auth-tradein-calc");
    const password = "TradeCalc!123";

    await storage.createUser({
      username,
      password: hashSecret(password),
      name: "Trade Calc User",
      email: `${username}@example.com`,
      role: "Manager",
      status: "active",
      shopId: null,
    });

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, secret: password }),
    });
    const setCookie = loginRes.headers.get("set-cookie");
    expect(setCookie).toContain("connect.sid=");

    const res = await fetch(`${baseUrl}/api/trade-in/calculate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: setCookie!,
      },
      body: JSON.stringify({
        brand: "Unknown",
        model: "Nonexistent",
        storage: "128GB",
        conditionAnswers: {},
        isIcloudLocked: false,
        isGoogleLocked: false,
        imei: "356998123456789",
      }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({
      message: "No base value found for this device configuration",
    });
  });

  it("returns a message-based validation error for invalid trade-in submission", async () => {
    const username = uniqueUsername("auth-tradein-submit");
    const password = "TradeSubmit!123";

    await storage.createUser({
      username,
      password: hashSecret(password),
      name: "Trade Submit User",
      email: `${username}@example.com`,
      role: "Manager",
      status: "active",
      shopId: null,
    });

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, secret: password }),
    });
    const setCookie = loginRes.headers.get("set-cookie");
    expect(setCookie).toContain("connect.sid=");

    const res = await fetch(`${baseUrl}/api/trade-in/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: setCookie!,
      },
      body: JSON.stringify({
        brand: "",
      }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      message: "Invalid input",
    });
  });
});
