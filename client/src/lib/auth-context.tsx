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

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  currency: string;
  dateFormat: string;
  timezone: string;
  defaultBranchId?: string | null;
  sidebarCollapsed?: boolean;
  density?: "compact" | "comfortable";
  dashboardLayout?: unknown;
  accentColor?: string | null;
}

interface AuthContextType {
  user: User | null;
  preferences: UserPreferences | null;
  loading: boolean;
  login: (username: string, secret: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [, setLocation] = useLocation();

  const applyUiPreferences = (prefs: UserPreferences | null) => {
    const root = document.documentElement;
    if (!prefs) return;

    const resolvedTheme =
      prefs.theme === "system"
        ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : prefs.theme;
    root.classList.toggle("dark", resolvedTheme === "dark");

    root.dataset.density = prefs.density || "comfortable";
    if (prefs.accentColor) {
      root.style.setProperty("--primary", prefs.accentColor);
    }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ user: User; preferences?: UserPreferences }>("GET", "/api/auth/me");
      setUser(res.user);
      setPreferences(res.preferences || null);
      applyUiPreferences(res.preferences || null);
    } catch {
      setUser(null);
      setPreferences(null);
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
      const res = await apiRequest<{ user: User; preferences?: UserPreferences }>("POST", "/api/auth/login", { username, secret });
      setUser(res.user);
      setPreferences(res.preferences || null);
      applyUiPreferences(res.preferences || null);
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
    setPreferences(null);
    setLocation("/");
  };

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    const updated = await apiRequest<UserPreferences>("PATCH", "/api/preferences", updates);
    setPreferences(updated);
    applyUiPreferences(updated);
  };

  return (
    <AuthContext.Provider value={{ user, preferences, loading, login, logout, refresh, updatePreferences }}>
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
