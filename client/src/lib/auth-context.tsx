import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "./api";

export type UserRole = "Owner" | "Manager" | "Sales";

export interface User {
  id: string;
  name: string;
  username?: string;
  role: UserRole;
  email?: string | null;
  shopId?: string | null;
  status?: string;
  lastActiveAt?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, secret: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [, setLocation] = useLocation();

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ user: User }>("GET", "/api/auth/me");
      setUser(res.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const login = async (username: string, secret: string) => {
    setLoading(true);
    try {
      const res = await apiRequest<{ user: User }>("POST", "/api/auth/login", { username, secret });
      setUser(res.user);
      if (res.user.role === "Owner") {
        setLocation("/dashboard");
      } else if (res.user.role === "Manager") {
        setLocation("/dashboard");
      } else {
        setLocation("/pos");
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await apiRequest("POST", "/api/auth/logout");
    setUser(null);
    setLocation("/");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
