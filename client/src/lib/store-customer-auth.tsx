import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { clearApiCache, apiRequest } from "./api";

export type StoreCustomer = {
  accountId?: string;
  customerId: string;
  id?: string;
  name: string;
  email?: string | null;
  phone: string;
};

type StoreCustomerAuthContextType = {
  customer: StoreCustomer | null;
  loading: boolean;
  login: (input: { identifier: string; password: string }) => Promise<void>;
  signup: (input: { name: string; phone: string; email?: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const StoreCustomerAuthContext = createContext<StoreCustomerAuthContextType | undefined>(undefined);

export function StoreCustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<StoreCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [location] = useLocation();
  const pathname = typeof window !== "undefined" ? window.location.pathname : location;
  const needsStoreSession =
    pathname === "/store/account" ||
    pathname === "/store/login" ||
    pathname === "/store/signup";

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ customer: StoreCustomer | null }>("GET", "/api/store/auth/me", undefined, { skipCache: true });
      setCustomer(res.customer ?? null);
    } catch {
      clearApiCache("/api/store/auth");
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!needsStoreSession) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [needsStoreSession]);

  const login = async (input: { identifier: string; password: string }) => {
    setLoading(true);
    try {
      clearApiCache("/api/store/auth");
      clearApiCache("/api/store/account");
      const res = await apiRequest<{ customer: StoreCustomer }>("POST", "/api/store/auth/login", input);
      setCustomer(res.customer);
    } finally {
      setLoading(false);
    }
  };

  const signup = async (input: { name: string; phone: string; email?: string; password: string }) => {
    setLoading(true);
    try {
      clearApiCache("/api/store/auth");
      clearApiCache("/api/store/account");
      const res = await apiRequest<{ customer: StoreCustomer }>("POST", "/api/store/auth/signup", input);
      setCustomer(res.customer);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiRequest("POST", "/api/store/auth/logout");
    } finally {
      clearApiCache("/api/store/auth");
      clearApiCache("/api/store/account");
      setCustomer(null);
    }
  };

  return (
    <StoreCustomerAuthContext.Provider value={{ customer, loading, login, signup, logout, refresh }}>
      {children}
    </StoreCustomerAuthContext.Provider>
  );
}

export function useStoreCustomerAuth() {
  const context = useContext(StoreCustomerAuthContext);
  if (!context) {
    throw new Error("useStoreCustomerAuth must be used within a StoreCustomerAuthProvider");
  }
  return context;
}
