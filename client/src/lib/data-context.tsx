import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { subDays } from "date-fns";
import { useAuth } from "./auth-context";
import { apiRequest } from "./api";

// --- TYPES ---

export type Role = "Owner" | "Manager" | "Sales";

export interface Shop {
  id: string;
  name: string;
  location: string;
  subscriptionPlan: "trial" | "basic" | "pro" | "enterprise";
  currency: string;
  logoUrl?: string; // legacy string
  logo?: { url: string } | null; // normalized jsonb
  coverUrl?: string;
  coverImage?: { url: string } | null; // normalized jsonb
  description?: string;
  phone?: string;
  email?: string;
  isMain?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  shopId: string;
  status?: "active" | "disabled";
  lastActiveAt?: string | null;
}

export interface Product {
  id: string;
  name: string;
  displayTitle?: string;
  description?: string;
  category: string;
  brand?: string;
  model?: string;
  condition?: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  sku?: string;
  barcode?: string;
  imageUrl?: string;
  storefrontVisibility?: "published" | "draft" | "hidden" | "archived";
  isFeatured?: boolean;
  isFlashDeal?: boolean;
  flashDealPrice?: number | null;
  flashDealEndsAt?: string | null;
}

export interface Device {
  id: string;
  brand: string;
  model: string;
  imei: string;
  color: string;
  storage: string;
  condition: "New" | "Used" | "Refurbished";
  status: "In Stock" | "Sold" | "Repaired";
  price: number;
  cost: number;
  addedAt: string;
  warrantyPeriod?: number; // months
  warrantyExpiresAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  joinedAt: string;
  totalPurchases: number;
}

export interface SaleItem {
  id: string;
  productId?: string;
  deviceId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Sale {
  id: string;
  saleNumber: string;
  customerId?: string;
  customerName?: string; // Denormalized for ease
  items: SaleItem[];
  totalAmount: number;
  paymentMethod: "Cash" | "MTN" | "Airtel" | "Card";
  status: "Completed" | "Refunded";
  soldBy: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  category: string; // Rent, Utilities, Salary, Supplies
  description: string;
  amount: number;
  date: string;
  recordedBy: string;
}

export type RepairStatus = "Pending" | "In Progress" | "Completed" | "Delivered";

export interface Repair {
  id: string;
  repairNumber: string;
  deviceBrand: string;
  deviceModel: string;
  imei: string;
  issueDescription: string;
  repairType: string;
  price: number;
  cost?: number;
  notes: string;
  status: RepairStatus;
  createdAt: string;
  customerName?: string;
  technician?: string;
}

export interface DailyClosure {
  id: string;
  date: string;
  cashExpected: number; // Auto-calculated by system from sales - staff cannot input
  cashCounted: number;
  mtnAmount: number;
  airtelAmount: number;
  cardAmount: number;
  expensesTotal: number;
  variance: number;
  submittedBy: string;
  submittedAt: string;
  status: "pending" | "confirmed" | "flagged";
  proofs: {
    cashDrawer?: string;
    mtn?: string;
    airtel?: string;
    card?: string;
  };
  shopId: string;
  // Denormalized for dashboard speed in mockup
  sales?: SaleItem[]; 
  repairs?: Repair[]; 
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  details: string;
  user: string;
  timestamp: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "error";
  read: boolean;
  timestamp: string;
}

export interface LeadFollowUp {
  by: string;
  byId?: string;
  at: string;
  note: string;
  result?: string;
}

export interface Lead {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  source?: string;
  notes?: string;
  assignedTo?: string;
  assignedToName?: string;
  createdBy?: string;
  createdByName?: string;
  priority: "low" | "normal" | "high";
  status: "new" | "contacted" | "in_progress" | "won" | "lost";
  nextFollowUpAt?: string;
  followUpHistory: LeadFollowUp[];
  shopId?: string;
  createdAt: string;
  updatedAt?: string;
}

interface DataContextType {
  // Session
  currentUser: User | null;
  activeShop: Shop;
  shops: Shop[];
  
  // Data
  users: User[]; // Staff list
  products: Product[];
  devices: Device[];
  customers: Customer[];
  sales: Sale[];
  expenses: Expense[];
  repairs: Repair[];
  closures: DailyClosure[];
  leads: Lead[];
  auditLogs: AuditLog[];
  notifications: Notification[];

  // Actions
  setActiveShopId: (id: string) => void;
  activeShopId: string;
  updateShop: (id: string, updates: Partial<Shop>) => void;
  addProduct: (data: Omit<Product, "id">) => Promise<void>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addDevice: (data: Omit<Device, "id" | "status" | "addedAt">) => Promise<void>;
  addCustomer: (data: Omit<Customer, "id" | "joinedAt" | "totalPurchases">) => Promise<void>;
  recordSale: (data: Omit<Sale, "id" | "saleNumber" | "createdAt">) => Promise<Sale>;
  recordExpense: (data: Omit<Expense, "id">) => Promise<void>;
  addRepair: (data: Omit<Repair, "id" | "repairNumber" | "status" | "createdAt">) => Promise<void>;
  updateRepairStatus: (id: string, status: RepairStatus) => Promise<void>;
  updateClosure: (id: string, data: Partial<DailyClosure>) => Promise<void>;
  addClosure: (data: Omit<DailyClosure, "id" | "date" | "submittedAt" | "status" | "variance" | "shopId" | "cashExpected">) => Promise<void>;
  addLead: (data: Omit<Lead, "id" | "createdAt" | "followUpHistory" | "updatedAt">) => Promise<void>;
  updateLead: (id: string, data: Partial<Lead>) => Promise<void>;
  deleteLead: (id: string) => void;
  addLeadFollowUp: (id: string, follow: Omit<LeadFollowUp, "at"> & { at?: string }) => Promise<void>;
  
  // User Management
  addUser: (data: Omit<User, "id"> & { pin?: string }) => Promise<void>;
  updateUser: (id: string, data: Partial<User> & { pin?: string }) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  
  // Helpers
  getPermissions: (role: Role) => string[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// --- MOCK DATA ---

const MOCK_SHOPS: Shop[] = [
  { 
    id: "shop1", 
    name: "Kampala Main", 
    location: "Kampala Road", 
    subscriptionPlan: "pro", 
    currency: "UGX", 
    logoUrl: undefined,
    coverUrl: undefined,
    description: "",
    phone: "",
    email: "",
  },
  { 
    id: "shop2", 
    name: "Entebbe Branch", 
    location: "Victoria Mall", 
    subscriptionPlan: "basic", 
    currency: "UGX", 
    logoUrl: undefined,
    coverUrl: undefined,
    description: "",
    phone: "",
    email: "",
  },
];

const STORAGE_KEYS = {
};

export function DataProvider({ children }: { children: ReactNode }) {
  const { user: authUser } = useAuth();
  const [activeShopId, setActiveShopId] = useState("shop1");
  const [shops, setShops] = useState<Shop[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [closures, setClosures] = useState<DailyClosure[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    if (authUser?.shopId) {
      setActiveShopId(authUser.shopId);
    }
  }, [authUser?.shopId]);

  useEffect(() => {
    const loadShops = async () => {
      if (!authUser) return;

      try {
        const serverShops = await apiRequest<Shop[]>("GET", "/api/shops", undefined, { skipCache: true });
        setShops(serverShops);
        setActiveShopId((currentId) => {
          if (authUser.shopId && serverShops.some((shop) => shop.id === authUser.shopId)) {
            return authUser.shopId;
          }
          if (serverShops.some((shop) => shop.id === currentId)) {
            return currentId;
          }
          return serverShops[0]?.id || currentId;
        });
      } catch {
        setShops([]);
      }
    };

    void loadShops();
  }, [authUser]);

  useEffect(() => {
    const loadProducts = async () => {
      if (!authUser) {
        setProducts([]);
        return;
      }

      try {
        const params = new URLSearchParams();
        if (activeShopId) params.set("shopId", activeShopId);
        const result = await apiRequest<{ data: Product[] }>(
          "GET",
          `/api/products${params.toString() ? `?${params.toString()}` : ""}`,
          undefined,
          { skipCache: true },
        );
        setProducts(result.data || []);
      } catch {
        // Keep the currently loaded local state instead of silently replacing it with mock data.
      }
    };

    void loadProducts();
  }, [authUser, activeShopId]);

  useEffect(() => {
    const loadDevices = async () => {
      if (!authUser) {
        setDevices([]);
        return;
      }

      try {
        const params = new URLSearchParams();
        if (activeShopId) params.set("shopId", activeShopId);
        const list = await apiRequest<Device[]>(
          "GET",
          `/api/devices${params.toString() ? `?${params.toString()}` : ""}`,
          undefined,
          { skipCache: true },
        );
        setDevices(list);
      } catch {
        // Keep current local state when device API is unavailable.
      }
    };

    void loadDevices();
  }, [authUser, activeShopId]);

  useEffect(() => {
    const loadCustomers = async () => {
      if (!authUser) {
        setCustomers([]);
        return;
      }

      try {
        const params = new URLSearchParams();
        if (activeShopId) params.set("shopId", activeShopId);
        const list = await apiRequest<Customer[]>(
          "GET",
          `/api/customers${params.toString() ? `?${params.toString()}` : ""}`,
          undefined,
          { skipCache: true },
        );
        setCustomers(list);
      } catch {
        // Keep current local state when customer API is unavailable.
      }
    };

    void loadCustomers();
  }, [authUser, activeShopId]);

  useEffect(() => {
    const loadSales = async () => {
      if (!authUser) {
        setSales([]);
        return;
      }

      try {
        const params = new URLSearchParams();
        if (activeShopId) params.set("shopId", activeShopId);
        const list = await apiRequest<Sale[]>(
          "GET",
          `/api/sales${params.toString() ? `?${params.toString()}` : ""}`,
          undefined,
          { skipCache: true },
        );
        setSales(list);
      } catch {
        // Keep current local state when sales API is unavailable.
      }
    };

    void loadSales();
  }, [authUser, activeShopId]);

  useEffect(() => {
    const loadRepairs = async () => {
      if (!authUser) {
        setRepairs([]);
        return;
      }

      try {
        const params = new URLSearchParams();
        if (activeShopId) params.set("shopId", activeShopId);
        const list = await apiRequest<Repair[]>(
          "GET",
          `/api/repairs${params.toString() ? `?${params.toString()}` : ""}`,
          undefined,
          { skipCache: true },
        );
        setRepairs(list);
      } catch {
        // Keep current local state when repair API is unavailable.
      }
    };

    void loadRepairs();
  }, [authUser, activeShopId]);

  useEffect(() => {
    const loadExpenses = async () => {
      if (!authUser) {
        setExpenses([]);
        return;
      }

      try {
        const params = new URLSearchParams();
        if (activeShopId) params.set("shopId", activeShopId);
        const list = await apiRequest<Expense[]>(
          "GET",
          `/api/expenses${params.toString() ? `?${params.toString()}` : ""}`,
          undefined,
          { skipCache: true },
        );
        setExpenses(list.map((expense) => ({
          ...expense,
          date: expense.date ? new Date(expense.date).toISOString() : new Date().toISOString(),
        })));
      } catch {
        // Keep current local state when expense API is unavailable.
      }
    };

    void loadExpenses();
  }, [authUser, activeShopId]);

  useEffect(() => {
    const loadClosures = async () => {
      if (!authUser) {
        setClosures([]);
        return;
      }

      try {
        const params = new URLSearchParams();
        if (activeShopId) params.set("shopId", activeShopId);
        const list = await apiRequest<DailyClosure[]>(
          "GET",
          `/api/closures${params.toString() ? `?${params.toString()}` : ""}`,
          undefined,
          { skipCache: true },
        );
        setClosures(list);
      } catch {
        // Keep current local state when closure API is unavailable.
      }
    };

    void loadClosures();
  }, [authUser, activeShopId]);

  useEffect(() => {
    const loadLeads = async () => {
      if (!authUser) {
        setLeads([]);
        return;
      }

      try {
        const params = new URLSearchParams();
        if (activeShopId) params.set("shopId", activeShopId);
        const list = await apiRequest<Lead[]>(
          "GET",
          `/api/leads${params.toString() ? `?${params.toString()}` : ""}`,
          undefined,
          { skipCache: true },
        );
        setLeads(list);
      } catch {
        // Keep current local state when lead API is unavailable.
      }
    };

    void loadLeads();
  }, [authUser, activeShopId]);

  const updateShop = async (id: string, updates: Partial<Shop>) => {
    const updated = await apiRequest<Shop>("PATCH", `/api/shops/${id}`, updates);
    setShops(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
    if (id === activeShopId) setActiveShopId(id);
    return updated;
  };

  useEffect(() => {
    const loadStaff = async () => {
      if (!authUser) {
        setUsers([]);
        return;
      }
      if (authUser.role === "Sales") {
        setUsers([{
          id: authUser.id,
          name: authUser.name,
          email: authUser.email || "",
          role: authUser.role as Role,
          shopId: authUser.shopId || activeShopId,
          status: authUser.status === "disabled" ? "disabled" : "active",
          lastActiveAt: authUser.lastActiveAt,
        }]);
        return;
      }
      try {
        const staff = await apiRequest<User[]>("GET", "/api/staff");
        setUsers(staff.map(s => ({ ...s, email: s.email || "" })));
      } catch {
        setUsers([]);
      }
    };
    loadStaff();
  }, [authUser]);

  useEffect(() => {
    const loadActivity = async () => {
      if (!authUser || (authUser.role !== "Owner" && authUser.role !== "Manager")) return;
      try {
        const logs = await apiRequest<any[]>("GET", "/api/activity?limit=200");
        setAuditLogs(logs.map(log => ({
          id: log.id,
          action: log.action,
          entity: log.entity,
          details: log.details || "",
          user: log.userName || log.role || "System",
          timestamp: log.createdAt || log.timestamp || new Date().toISOString(),
        })));
      } catch {
        // keep local copy
      }
    };
    loadActivity();
  }, [authUser]);

  const currentUser = authUser ? {
    id: authUser.id,
    name: authUser.name,
    email: authUser.email || "",
    role: authUser.role as Role,
    shopId: authUser.shopId || activeShopId,
    status: (authUser.status === "disabled" ? "disabled" : "active") as "disabled" | "active",
    lastActiveAt: authUser.lastActiveAt,
  } : null;

  const activeShop = shops.find(s => s.id === activeShopId) || shops[0];

  const logAction = (action: string, entity: string, details: string, entityId?: string, metadata?: any) => {
    const entry: AuditLog = {
      id: `l-${Date.now()}`,
      action,
      entity,
      details,
      user: currentUser?.name || "System",
      timestamp: new Date().toISOString(),
    };
    setAuditLogs(prev => [entry, ...prev]);
    apiRequest("POST", "/api/activity", {
      action,
      entity,
      entityId,
      details,
      metadata,
    }).catch(() => {});
  };

  const addLead = async (data: Omit<Lead, "id" | "createdAt" | "followUpHistory" | "updatedAt">) => {
    const created = await apiRequest<Lead>("POST", "/api/leads", {
      ...data,
      shopId: data.shopId || activeShopId,
    });
    setLeads((prev) => [created, ...prev]);
    logAction("CREATE", "Lead", `Added lead ${created.customerName}`, created.id);
  };

  const updateLead = async (id: string, data: Partial<Lead>) => {
    const updated = await apiRequest<Lead>("PATCH", `/api/leads/${id}`, data);
    setLeads((prev) => prev.map((lead) => (lead.id === id ? updated : lead)));
    logAction("UPDATE", "Lead", `Updated lead ${id}`, id);
  };

  const deleteLead = (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
    logAction("DELETE", "Lead", `Removed lead ${id}`);
  };

  const addLeadFollowUp = async (id: string, follow: Omit<LeadFollowUp, "at"> & { at?: string }) => {
    const updated = await apiRequest<Lead>("POST", `/api/leads/${id}/follow-ups`, {
      note: follow.note,
      result: follow.result,
    });
    setLeads((prev) => prev.map((lead) => (lead.id === id ? updated : lead)));
    logAction("UPDATE", "Lead", `Follow-up on lead ${id}`, id);
  };

  const addProduct = async (data: Omit<Product, "id">) => {
    const created = await apiRequest<Product>("POST", "/api/products", {
      ...data,
      shopId: activeShopId,
    });
    setProducts(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    logAction("CREATE", "Product", `Added product ${created.name}`, created.id);
  };

  const updateProduct = async (id: string, data: Partial<Product>) => {
    const updated = await apiRequest<Product>("PATCH", `/api/products/${id}`, data);
    setProducts(prev => prev.map(p => p.id === id ? updated : p));
    logAction("UPDATE", "Product", `Updated product ${updated.name}`, id);
  };

  const deleteProduct = async (id: string) => {
    const name = products.find(p => p.id === id)?.name || id;
    await apiRequest("DELETE", `/api/products/${id}`);
    setProducts(prev => prev.filter(p => p.id !== id));
    logAction("DELETE", "Product", `Removed product ${name}`);
  };

  const addDevice = async (data: Omit<Device, "id" | "status" | "addedAt">) => {
    const created = await apiRequest<Device>("POST", "/api/devices", {
      ...data,
      shopId: activeShopId,
    });
    setDevices(prev => [created, ...prev]);
    logAction("CREATE", "Device", `Added device ${created.brand} ${created.model}`, created.id);
  };

  const addCustomer = async (data: Omit<Customer, "id" | "joinedAt" | "totalPurchases">) => {
    const created = await apiRequest<Customer>("POST", "/api/customers", {
      ...data,
      shopId: activeShopId,
    });
    setCustomers(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    logAction("CREATE", "Customer", `Registered customer ${created.name}`, created.id);
  };

  const recordSale = async (data: Omit<Sale, "id" | "saleNumber" | "createdAt">) => {
    const created = await apiRequest<Sale>("POST", "/api/sales", {
      ...data,
      soldBy: data.soldBy || currentUser?.name || "Staff",
      shopId: activeShopId,
    });

    setSales(prev => [created, ...prev]);

    setProducts(prev =>
      prev.map((product) => {
        const item = data.items.find((entry) => entry.productId === product.id);
        if (!item) return product;
        return { ...product, stock: Math.max(0, product.stock - item.quantity) };
      }),
    );

    if (data.customerId) {
      setCustomers(prev =>
        prev.map((customer) =>
          customer.id === data.customerId
            ? { ...customer, totalPurchases: customer.totalPurchases + 1 }
            : customer,
        ),
      );
    }

    setDevices(prev =>
      prev.map((device) => {
        const item = data.items.find((entry) => entry.deviceId === device.id);
        if (!item) return device;
        return { ...device, status: "Sold" };
      }),
    );

    logAction("CREATE", "Sale", `Recorded sale ${created.saleNumber}`, created.id);
    return created;
  };

  const recordExpense = async (data: Omit<Expense, "id">) => {
    const created = await apiRequest<Expense>("POST", "/api/expenses", {
      ...data,
      recordedBy: currentUser?.name || data.recordedBy,
      shopId: activeShopId,
    });
    const normalized: Expense = {
      ...created,
      date: created.date ? new Date(created.date).toISOString() : new Date().toISOString(),
    } as Expense;
    setExpenses((prev) => [normalized, ...prev]);
    logAction("CREATE", "Expense", `Recorded expense ${normalized.category} - ${normalized.amount}`, normalized.id);
  };

  const addRepair = async (data: Omit<Repair, "id" | "repairNumber" | "status" | "createdAt">) => {
    const created = await apiRequest<Repair>("POST", "/api/repairs", {
      ...data,
      shopId: activeShopId,
    });
    setRepairs((prev) => [created, ...prev]);
    logAction("CREATE", "Repair", `Started repair ${created.repairNumber}`, created.id);
  };

  const updateRepairStatus = async (id: string, status: RepairStatus) => {
    const updated = await apiRequest<Repair>("PATCH", `/api/repairs/${id}/status`, { status });
    setRepairs((prev) => prev.map((repair) => (repair.id === id ? updated : repair)));
    logAction("UPDATE", "Repair", `Updated repair ${updated.repairNumber} status to ${status}`, id);
  };

  const addClosure = async (data: Omit<DailyClosure, "id" | "date" | "submittedAt" | "status" | "variance" | "shopId" | "cashExpected">) => {
    // Auto-calculate expected from today's sales by payment method
    const today = new Date().toDateString();
    const todaySales = sales.filter(s => new Date(s.createdAt).toDateString() === today);
    
    const expectedCash = todaySales
      .filter(s => s.paymentMethod === "Cash")
      .reduce((sum, s) => sum + s.totalAmount, 0);
    const expectedMtn = todaySales
      .filter(s => s.paymentMethod === "MTN")
      .reduce((sum, s) => sum + s.totalAmount, 0);
    const expectedAirtel = todaySales
      .filter(s => s.paymentMethod === "Airtel")
      .reduce((sum, s) => sum + s.totalAmount, 0);
    const expectedCard = todaySales
      .filter(s => s.paymentMethod === "Card")
      .reduce((sum, s) => sum + s.totalAmount, 0);
    
    const cashExpected = expectedCash + expectedMtn + expectedAirtel + expectedCard;
    const totalSubmitted = data.cashCounted + data.mtnAmount + data.airtelAmount + data.cardAmount;
    const variance = totalSubmitted - cashExpected;
    
    // Flag for owner review if variance exists
    const status = variance !== 0 ? "flagged" : "confirmed";
    
    // Add notification for owner if there's a variance
    if (variance !== 0) {
      const varianceType = variance > 0 ? "overage" : "shortage";
      const varianceAmount = Math.abs(variance);
      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          title: "Cash Variance Alert",
          type: "warning",
          message: `Daily closure has ${varianceType} of UGX ${varianceAmount.toLocaleString()}`,
          timestamp: new Date().toISOString(),
          read: false,
        },
        ...prev
      ]);
    }
    
    const created = await apiRequest<DailyClosure>("POST", "/api/closures", {
      ...data, 
      status, 
      variance, 
      cashExpected,
      submittedBy: data.submittedBy || currentUser?.name || "Staff",
      shopId: activeShopId 
    });
    setClosures((prev) => [created, ...prev]);
    logAction("CREATE", "Closure", `Submitted daily closure${variance !== 0 ? ` with variance: ${variance}` : ""}`, created.id);
  };

  const updateClosure = async (id: string, data: Partial<DailyClosure>) => {
    const updated = await apiRequest<DailyClosure>("PATCH", `/api/closures/${id}`, data);
    setClosures((prev) => prev.map((closure) => (closure.id === id ? updated : closure)));
    logAction("UPDATE", "Closure", `Updated closure ${id}`, id);
  };

  const addUser = async (data: Omit<User, "id"> & { pin?: string }) => {
    if (!data.pin?.trim()) {
      throw new Error("A login PIN is required for new staff accounts.");
    }

    const payload = { ...data, status: data.status || "active" };
    const created = await apiRequest<User>("POST", "/api/staff", payload);
    setUsers(prev => [...prev, created]);
    logAction("CREATE", "User", `Added staff member ${created.name}`, created.id);
  };

  const updateUser = async (id: string, data: Partial<User> & { pin?: string }) => {
    const updated = await apiRequest<User>("PATCH", `/api/staff/${id}`, data);
    setUsers(users.map(u => u.id === id ? { ...u, ...updated } : u));
    logAction("UPDATE", "User", `Updated staff member ${updated.name}`, id);
  };

  const deleteUser = async (id: string) => {
    await apiRequest("PATCH", `/api/staff/${id}/status`, { status: "disabled" });
    setUsers(users.map(u => u.id === id ? { ...u, status: "disabled" } : u));
    logAction("DISABLE", "User", `Disabled staff member ${id}`, id);
  };

  const getPermissions = (role: Role) => {
    if (role === "Owner") return ["all"];
    if (role === "Manager") return ["sales", "repairs", "inventory", "reports", "closures"];
    return ["sales", "repairs", "trade-in"];
  };

  return (
    <DataContext.Provider value={{
      currentUser,
      activeShop,
      activeShopId, // Add this line
      shops,
      updateShop,
      users,
      products,
      devices,
      customers,
      sales,
      expenses,
      repairs,
      closures: closures.filter(c => c.shopId === activeShopId),
      auditLogs,
      notifications,
      setActiveShopId,
      addProduct,
      updateProduct,
      deleteProduct,
      addDevice,
      addCustomer,
      recordSale,
      recordExpense,
      addRepair,
      updateRepairStatus,
      addClosure,
      updateClosure,
      addUser,
      updateUser,
      deleteUser,
      // Leads
      leads,
      addLead,
      updateLead,
      deleteLead,
      addLeadFollowUp,

      getPermissions
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
