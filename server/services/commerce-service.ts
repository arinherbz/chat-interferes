import type { Delivery, InsertDelivery, InsertOrder, InsertOrderItem, InsertReceipt, Order, OrderItem, Product, Receipt } from "@shared/schema";
import { storage } from "../storage";
import { HttpError } from "../utils/api-response";
import { generateOrderNumber } from "../utils/order";
import { normalizeUgPhoneNumber } from "../utils/phone";

type StoreProductFilters = {
  shopId?: string;
  query?: string;
  sort?: string;
  condition?: string;
};

type StorefrontProduct = {
  id: string;
  shopId?: string | null;
  name: string;
  displayTitle?: string;
  brand?: string;
  category?: string;
  price: number;
  flashDealPrice?: number;
  flashDealEndsAt?: string;
  stock: number;
  imageUrl?: string;
  condition?: string;
  description?: string;
  slug: string;
  createdAt?: string;
  model?: string;
  sku?: string;
  displayBadge?: string;
  featured?: boolean;
  isFlashDeal?: boolean;
  storefrontVisibility?: string;
};

type CheckoutItemInput = {
  productId: string;
  quantity: number;
};

type CheckoutInput = {
  shopId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  items: CheckoutItemInput[];
  paymentMethod: "Cash" | "Card" | "Mobile Money";
  deliveryType?: "PICKUP" | "KAMPALA" | "UPCOUNTRY";
  deliveryAddress?: string;
  notes?: string;
};

type DeliveryInput = {
  orderId: string;
  address?: string;
  assignedRiderId?: string;
  scheduledAt?: Date;
  notes?: string;
};

type DeliveryStatusInput = {
  status: "PENDING" | "ASSIGNED" | "PICKED UP" | "IN TRANSIT" | "DELIVERED" | "FAILED";
  riderId?: string;
  notes?: string;
};

type ReceiptInput = {
  orderId: string;
  pdfUrl?: string | null;
  sentVia?: string[];
};

export const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "READY FOR DELIVERY", "DELIVERED", "CANCELLED"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

function toIsoString(value: unknown) {
  if (!value) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function toTimestamp(value: unknown) {
  if (!value) return 0;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 0 : value.getTime();
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function normalizeWhitespace(value?: string | null) {
  return value?.trim().replace(/\s+/g, " ") || "";
}

function shouldPrettifyDisplayName(value: string) {
  if (!value) return false;
  const hasUppercase = /[A-Z]/.test(value);
  return !hasUppercase;
}

function toTitleCase(value?: string | null) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return "";
  const specialWords: Record<string, string> = {
    iphone: "iPhone",
    ipad: "iPad",
    macbook: "MacBook",
    airpods: "AirPods",
    imac: "iMac",
    usb: "USB",
    usbc: "USB-C",
    "usb-c": "USB-C",
    magsafe: "MagSafe",
    jbl: "JBL",
    anker: "Anker",
    samsung: "Samsung",
    galaxy: "Galaxy",
    hp: "HP",
    asus: "ASUS",
    dell: "Dell",
    lenovo: "Lenovo",
    acer: "Acer",
  };
  return normalized
    .split(" ")
    .map((part) => {
      const lower = part.toLowerCase();
      if (specialWords[lower]) return specialWords[lower];
      if (/^\d+(gb|tb|w)$/i.test(part)) return part.toUpperCase();
      if (/^(usb-c|type-c)$/i.test(part)) return part.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function normalizeBrand(value?: string | null) {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (!normalized) return undefined;

  const aliases: Record<string, string> = {
    apple: "Apple",
    iphone: "Apple",
    ipad: "Apple",
    macbook: "Apple",
    samsung: "Samsung",
    galaxy: "Samsung",
    google: "Google",
    pixel: "Google",
    xiaomi: "Xiaomi",
    redmi: "Xiaomi",
    poco: "Xiaomi",
    hp: "HP",
    asus: "ASUS",
    dell: "Dell",
    lenovo: "Lenovo",
    acer: "Acer",
    anker: "Anker",
    jbl: "JBL",
  };

  return aliases[normalized] ?? toTitleCase(normalized);
}

function normalizeCategory(value?: string | null) {
  const normalized = normalizeWhitespace(value);
  return normalized ? toTitleCase(normalized) : undefined;
}

function looksLikeBarcodeValue(value?: string | null) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return false;
  if (/^barcode product\b/i.test(normalized)) return true;
  if (/^[A-Z0-9-]{8,}$/i.test(normalized) && /\d{4,}/.test(normalized)) return true;
  if (/^\d{8,}$/.test(normalized)) return true;
  return false;
}

function buildStorefrontName(product: Product) {
  const displayTitle = normalizeWhitespace(product.displayTitle);
  const explicitName = normalizeWhitespace(product.name);
  const brand = normalizeBrand(product.brand);
  const model = toTitleCase(product.model);
  const category = normalizeCategory(product.category);

  if (displayTitle && !looksLikeBarcodeValue(displayTitle)) {
    return shouldPrettifyDisplayName(displayTitle) ? toTitleCase(displayTitle) : displayTitle;
  }

  if (explicitName && !looksLikeBarcodeValue(explicitName)) {
    return shouldPrettifyDisplayName(explicitName) ? toTitleCase(explicitName) : explicitName;
  }

  if (brand && model) {
    const normalizedModel = model.toLowerCase();
    if (normalizedModel.startsWith(brand.toLowerCase())) {
      return model;
    }
    return `${brand} ${model}`;
  }

  if (brand && category) {
    return `${brand} ${category}`;
  }

  if (model) return model;
  if (category) return category;
  if (brand) return brand;
  return "Product unavailable";
}

function toStoreProduct(product: Product): StorefrontProduct {
  const brand = normalizeBrand(product.brand);
  const category = normalizeCategory(product.category);
  const model = toTitleCase(product.model);
  const name = buildStorefrontName(product);
  return {
    id: product.id,
    shopId: product.shopId,
    name,
    displayTitle: normalizeWhitespace(product.displayTitle) || undefined,
    brand,
    category,
    price: product.price,
    flashDealPrice: product.flashDealPrice ?? undefined,
    flashDealEndsAt: toIsoString(product.flashDealEndsAt),
    stock: product.stock,
    imageUrl: product.imageUrl ?? undefined,
    condition: normalizeWhitespace(product.condition) || undefined,
    description: normalizeWhitespace(product.description) || undefined,
    slug: product.id,
    createdAt: toIsoString(product.createdAt),
    model: model || undefined,
    sku: product.sku ?? undefined,
    displayBadge: category || brand,
    featured: Boolean(product.isFeatured),
    isFlashDeal: Boolean(product.isFlashDeal && product.flashDealPrice && product.flashDealPrice < product.price),
    storefrontVisibility: product.storefrontVisibility,
  };
}

function getDeliveryFee(deliveryType: CheckoutInput["deliveryType"]) {
  switch (deliveryType) {
    case "KAMPALA":
      return 15000;
    case "UPCOUNTRY":
      return 25000;
    default:
      return 0;
  }
}

function dedupeStorefrontProducts(products: StorefrontProduct[]) {
  const seen = new Set<string>();
  return products.filter((product) => {
    const signature = [
      product.name.toLowerCase(),
      (product.brand ?? "").toLowerCase(),
      (product.model ?? "").toLowerCase(),
      product.price,
      product.imageUrl ?? "",
    ].join("::");
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function applyProductFilters(products: Product[], filters: StoreProductFilters) {
  const query = filters.query?.trim().toLowerCase();

  let result = dedupeStorefrontProducts(
    products
      .filter((product) => product.storefrontVisibility === "published")
      .map(toStoreProduct),
  );

  if (query) {
    result = result.filter((product) =>
      [product.name, product.brand, product.model, product.category]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }

  if (filters.condition && filters.condition !== "all") {
    result = result.filter((product) => (product.category ?? "").toLowerCase() === filters.condition!.toLowerCase());
  }

  switch (filters.sort) {
    case "price-asc":
      result = result.sort((a, b) => a.price - b.price);
      break;
    case "newest":
      result = result.sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));
      break;
    case "stock":
      result = result.sort((a, b) => b.stock - a.stock);
      break;
    default:
      result = result.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }

  return result;
}

async function createOrderItemsPayload(items: CheckoutItemInput[]) {
  const products = await Promise.all(items.map((item) => storage.getProduct(item.productId)));

  const missingProduct = products.findIndex((product) => !product);
  if (missingProduct >= 0) {
    throw new HttpError(404, "One or more products no longer exist");
  }

  const orderItems: InsertOrderItem[] = items.map((item) => {
    const product = products.find((entry) => entry!.id === item.productId)!;
    if (product.stock < item.quantity) {
      throw new HttpError(400, `Not enough stock for ${product.name}`);
    }

    return {
      orderId: "",
      productId: product.id,
      productName: product.name,
      quantity: item.quantity,
      unitPrice: product.price,
      total: product.price * item.quantity,
    };
  });

  return {
    products: products as Product[],
    orderItems,
    subtotal: orderItems.reduce((sum, item) => sum + (item.total ?? 0), 0),
  };
}

async function createNotification(shopId: string, type: string, targetId: string, message: string) {
  await storage.createNotification({
    shopId,
    type,
    targetId,
    message,
  });
}

async function getDefaultShopId() {
  const shops = await storage.getShops();
  const primaryShop = shops.find((shop) => shop.isMain) ?? shops[0];
  return primaryShop?.id;
}

export const commerceService = {
  async listStoreProducts(filters: StoreProductFilters) {
    const products = await storage.getProducts(filters.shopId);
    return applyProductFilters(products, filters);
  },

  async getStoreProduct(id: string) {
    const product = await storage.getProduct(id);
    if (!product || product.storefrontVisibility !== "published") {
      throw new HttpError(404, "Product not found");
    }

    return {
      ...toStoreProduct(product),
      inStock: product.stock > 0,
      description: normalizeWhitespace(product.description) || `${normalizeBrand(product.brand) ?? "Premium"} ${toTitleCase(product.model) || buildStorefrontName(product)} available in stock.`,
      sku: product.sku ?? undefined,
      model: toTitleCase(product.model) || undefined,
    };
  },

  async createStoreOrder(input: CheckoutInput) {
    const customerPhone = normalizeUgPhoneNumber(input.customerPhone);
    const { products, orderItems, subtotal } = await createOrderItemsPayload(input.items);
    const inferredShopId = input.shopId ?? products[0]?.shopId ?? (await getDefaultShopId()) ?? undefined;
    if (!inferredShopId) {
      throw new HttpError(400, "Unable to determine shop for this order");
    }

    const hasMixedShops = products.some((product) => product.shopId && product.shopId !== inferredShopId);
    if (hasMixedShops) {
      throw new HttpError(400, "All checkout items must belong to the same shop");
    }

    const deliveryType = input.deliveryType ?? (input.deliveryAddress ? "KAMPALA" : "PICKUP");
    const deliveryFee = getDeliveryFee(deliveryType);
    const orderPayload: InsertOrder = {
      orderNumber: generateOrderNumber(),
      shopId: inferredShopId,
      customerName: input.customerName,
      customerPhone,
      customerEmail: input.customerEmail || null,
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
      paymentMethod: input.paymentMethod,
      paymentStatus: "PENDING",
      channel: "ONLINE",
      status: "PENDING",
      deliveryType,
      deliveryAddress: input.deliveryAddress || null,
      notes: input.notes || null,
      customerId: null,
      assignedStaffId: null,
    };

    const order = await storage.createOrder(orderPayload);
    await storage.createOrderItems(orderItems.map((item) => ({ ...item, orderId: order.id })));

    for (const item of input.items) {
      const product = products.find((entry) => entry.id === item.productId)!;
      await storage.updateProduct(product.id, {
        stock: product.stock - item.quantity,
      });
    }

    await createNotification(
      order.shopId,
      "order",
      order.id,
      `New online order ${order.orderNumber} from ${order.customerName} for ${order.total.toLocaleString()} UGX`,
    );

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.total,
      estimatedDelivery: input.deliveryAddress ? "2-3 business days" : "Ready for pickup",
      whatsappUrl: `https://wa.me/256756524407?text=${encodeURIComponent(`Order ${order.orderNumber} placed`)}`,
    };
  },

  async trackOrder(orderLookup: string) {
    const orders = await storage.getOrders();
    const order = orders.find((entry) => entry.id === orderLookup || entry.orderNumber === orderLookup);
    if (!order) {
      throw new HttpError(404, "Order not found");
    }

    const items = await storage.getOrderItems(order.id);
    const delivery = await storage.getDeliveryByOrderId(order.id);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
      totalAmount: order.total,
      items,
      delivery: delivery
        ? {
            id: delivery.id,
            status: delivery.status,
            address: delivery.address,
            assignedRiderId: delivery.assignedRiderId,
            scheduledAt: delivery.scheduledAt,
            pickedUpAt: delivery.pickedUpAt,
            deliveredAt: delivery.deliveredAt,
            failureReason: delivery.failureReason,
          }
        : null,
    };
  },

  async listOrders(filters?: { shopId?: string; status?: string; assignedStaffId?: string }) {
    return storage.getOrders(filters);
  },

  async getOrderDetail(id: string) {
    const order = await storage.getOrder(id);
    if (!order) {
      throw new HttpError(404, "Order not found");
    }

    const items = await storage.getOrderItems(order.id);
    const delivery = await storage.getDeliveryByOrderId(order.id);
    return {
      ...order,
      items,
      delivery,
    };
  },

  async updateOrderStatus(id: string, status: OrderStatus, assignedStaffId?: string) {
    const order = await storage.updateOrderStatus(id, status, assignedStaffId);
    if (!order) {
      throw new HttpError(404, "Order not found");
    }

    await createNotification(order.shopId, "order", order.id, `Order ${order.orderNumber} moved to ${status}`);
    return order;
  },

  async listDeliveries(filters?: { status?: string; assignedRiderId?: string }) {
    return storage.getDeliveries(filters);
  },

  async createDelivery(input: DeliveryInput) {
    const order = await storage.getOrder(input.orderId);
    if (!order) {
      throw new HttpError(404, "Order not found");
    }

    const existingDelivery = await storage.getDeliveryByOrderId(input.orderId);
    if (existingDelivery) {
      throw new HttpError(400, "Delivery already exists for this order");
    }

    const payload: InsertDelivery = {
      orderId: order.id,
      address: input.address ?? order.deliveryAddress ?? "Delivery address pending",
      assignedRiderId: input.assignedRiderId ?? null,
      scheduledAt: input.scheduledAt ?? null,
      pickedUpAt: null,
      deliveredAt: null,
      failureReason: null,
      notes: input.notes ?? null,
      status: "ASSIGNED",
    };

    const delivery = await storage.createDelivery(payload);
    await storage.updateOrderStatus(order.id, "PROCESSING", input.assignedRiderId);
    await createNotification(order.shopId, "delivery", delivery.id, `Delivery assigned for order ${order.orderNumber}`);
    return delivery;
  },

  async updateDeliveryStatus(id: string, input: DeliveryStatusInput) {
    const updatePayload: Partial<InsertDelivery> = {
      status: input.status,
      notes: input.notes,
    };

    if (input.riderId) {
      updatePayload.assignedRiderId = input.riderId;
    }
    if (input.status === "PICKED UP") {
      updatePayload.pickedUpAt = new Date();
    }
    if (input.status === "DELIVERED") {
      updatePayload.deliveredAt = new Date();
    }
    if (input.status === "FAILED") {
      updatePayload.failureReason = input.notes ?? "Delivery failed";
    }

    const delivery = await storage.updateDelivery(id, updatePayload);
    if (!delivery) {
      throw new HttpError(404, "Delivery not found");
    }

    const orderStatus =
      input.status === "DELIVERED"
        ? "DELIVERED"
        : input.status === "FAILED"
          ? "CANCELLED"
          : "PROCESSING";

    const order = await storage.updateOrderStatus(delivery.orderId, orderStatus);
    if (order) {
      await createNotification(order.shopId, "delivery", delivery.id, `Delivery for ${order.orderNumber} is now ${input.status}`);
    }

    return delivery;
  },

  async listReceipts(orderId?: string) {
    return storage.getReceipts(orderId);
  },

  async createReceipt(input: ReceiptInput) {
    const payload: InsertReceipt = {
      orderId: input.orderId,
      pdfUrl: input.pdfUrl ?? null,
      sentVia: input.sentVia ?? [],
    };
    return storage.createReceipt(payload);
  },

  async listNotifications(shopId?: string) {
    return storage.getNotifications(shopId);
  },

  async markNotificationRead(id: string) {
    const notification = await storage.markNotificationRead(id);
    if (!notification) {
      throw new HttpError(404, "Notification not found");
    }
    return notification;
  },

  async getUnreadNotificationCount(shopId: string) {
    return storage.getUnreadNotificationCount(shopId);
  },
};
