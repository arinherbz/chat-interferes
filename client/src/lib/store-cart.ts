import { useEffect, useMemo, useState } from "react";
import type { StoreProduct } from "./storefront";

const STORE_CART_KEY = "techpos.store.cart";
const STORE_LAST_ORDER_KEY = "techpos.store.last-order";
const STORE_CART_EVENT = "techpos:store-cart-updated";

export type StoreCartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  brand?: string;
  stock: number;
  shopId?: string | null;
};

export type StoreCheckoutResult = {
  orderId: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  estimatedDelivery?: string;
  whatsappUrl?: string;
};

function isBrowser() {
  return typeof window !== "undefined";
}

function emitCartChange() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(STORE_CART_EVENT));
}

function readCart(): StoreCartItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORE_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCart(items: StoreCartItem[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORE_CART_KEY, JSON.stringify(items));
  emitCartChange();
}

export function addToStoreCart(product: StoreProduct) {
  const items = readCart();
  const existing = items.find((item) => item.productId === product.id);

  if (existing) {
    writeCart(
      items.map((item) =>
        item.productId === product.id
          ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) }
          : item,
      ),
    );
    return;
  }

  writeCart([
    ...items,
    {
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      imageUrl: product.imageUrl,
      brand: product.brand,
      stock: product.stock,
      shopId: product.shopId ?? null,
    },
  ]);
}

export function updateStoreCartItem(productId: string, quantity: number) {
  const items = readCart();
  if (quantity <= 0) {
    writeCart(items.filter((item) => item.productId !== productId));
    return;
  }

  writeCart(
    items.map((item) =>
      item.productId === productId
        ? { ...item, quantity: Math.min(quantity, item.stock) }
        : item,
    ),
  );
}

export function clearStoreCart() {
  writeCart([]);
}

export function saveLastStoreOrder(order: StoreCheckoutResult) {
  if (!isBrowser()) return;
  window.sessionStorage.setItem(STORE_LAST_ORDER_KEY, JSON.stringify(order));
}

export function readLastStoreOrder(): StoreCheckoutResult | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.sessionStorage.getItem(STORE_LAST_ORDER_KEY);
    return raw ? (JSON.parse(raw) as StoreCheckoutResult) : null;
  } catch {
    return null;
  }
}

export function useStoreCart() {
  const [items, setItems] = useState<StoreCartItem[]>(() => readCart());

  useEffect(() => {
    if (!isBrowser()) return;
    const sync = () => setItems(readCart());
    window.addEventListener(STORE_CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STORE_CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  );
  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const shopId = items.find((item) => item.shopId)?.shopId ?? null;

  return {
    items,
    subtotal,
    itemCount,
    shopId,
    add: addToStoreCart,
    updateQuantity: updateStoreCartItem,
    clear: clearStoreCart,
    remove: (productId: string) => updateStoreCartItem(productId, 0),
  };
}
