import { createContext, useContext, useState, ReactNode } from "react";
import { useLocation } from "wouter";

type UserRole = "owner" | "staff" | "supervisor";

interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
}

interface AuthContextType {
  user: User | null;
  login: (role: UserRole) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [, setLocation] = useLocation();

  const login = (role: UserRole) => {
    // Mock login logic
    const mockUser: User = {
      id: role === "owner" ? "u1" : "u2",
      name: role === "owner" ? "Alex Owner" : "Sarah Staff",
      role: role,
      email: role === "owner" ? "owner@techpos.com" : "staff@techpos.com",
    };
    setUser(mockUser);
    
    if (role === "owner") {
      setLocation("/dashboard");
    } else {
      setLocation("/daily-close");
    }
  };

  const logout = () => {
    setUser(null);
    setLocation("/");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
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
