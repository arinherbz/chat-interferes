import { useEffect, useMemo, useState } from "react";

export type StoreProduct = {
  id: string;
  slug: string;
  name: string;
  category?: string | null;
  brand?: string | null;
  model?: string | null;
  description?: string | null;
  condition?: string | null;
  ram?: string | null;
  storage?: string | null;
  specs?: Record<string, string> | null;
  featured?: boolean | null;
  isFlashDeal?: boolean | null;
  flashDealPrice?: number | null;
  flashDealEndsAt?: string | null;
  price: number;
  priceLabel?: string;
  stock: number;
  imageUrl?: string | null;
  shopId?: string | null;
  popularity?: number | null;
};

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
};

const CART_KEY = "techpos.store.cart";
const THEME_KEY = "techpos.store.theme";

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("store-cart-updated"));
}

export function useStoreCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const sync = () => setItems(readCart());
    sync();
    window.addEventListener("store-cart-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("store-cart-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const cartCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);

  return {
    items,
    cartCount,
    subtotal,
    addItem(product: StoreProduct) {
      const next = [...readCart()];
      const existing = next.find((item) => item.productId === product.id);
      if (existing) {
        existing.quantity += 1;
      } else {
        next.push({
          productId: product.id,
          slug: product.slug,
          name: product.name,
          price: product.flashDealPrice || product.price,
          quantity: 1,
          imageUrl: product.imageUrl,
        });
      }
      writeCart(next);
      setItems(next);
    },
    updateQuantity(productId: string, quantity: number) {
      const next = readCart()
        .map((item) => (item.productId === productId ? { ...item, quantity } : item))
        .filter((item) => item.quantity > 0);
      writeCart(next);
      setItems(next);
    },
    removeItem(productId: string) {
      const next = readCart().filter((item) => item.productId !== productId);
      writeCart(next);
      setItems(next);
    },
    clearCart() {
      writeCart([]);
      setItems([]);
    },
  };
}

export function useStoreTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY);
    const next = stored === "dark" ? "dark" : "light";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }, []);

  return {
    theme,
    toggleTheme() {
      const next = theme === "dark" ? "light" : "dark";
      setTheme(next);
      document.documentElement.classList.toggle("dark", next === "dark");
      window.localStorage.setItem(THEME_KEY, next);
    },
  };
}
