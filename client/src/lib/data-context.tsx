import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { subDays, subHours } from "date-fns";
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
  category: string;
  brand?: string;
  model?: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  sku?: string;
  imageUrl?: string;
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

export interface TradeIn {
  id: string;
  deviceId: string; // The ID generated in inventory
  brand: string;
  model: string;
  imei: string;
  condition: string;
  offerPrice: number;
  customerId: string;
  status: "Pending" | "Approved" | "Rejected";
  createdAt: string;
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
  tradeIns: TradeIn[];
  closures: DailyClosure[];
  leads: Lead[];
  auditLogs: AuditLog[];
  notifications: Notification[];

  // Actions
  setActiveShopId: (id: string) => void;
  activeShopId: string;
  updateShop: (id: string, updates: Partial<Shop>) => void;
  addProduct: (data: Omit<Product, "id">) => void;
  updateProduct: (id: string, data: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addDevice: (data: Omit<Device, "id" | "status" | "addedAt">) => void;
  addCustomer: (data: Omit<Customer, "id" | "joinedAt" | "totalPurchases">) => void;
  recordSale: (data: Omit<Sale, "id" | "saleNumber" | "createdAt">) => void;
  recordExpense: (data: Omit<Expense, "id">) => void;
  addRepair: (data: Omit<Repair, "id" | "repairNumber" | "status" | "createdAt">) => void;
  recordTradeIn: (data: Omit<TradeIn, "id" | "createdAt" | "status">) => void;
  updateRepairStatus: (id: string, status: RepairStatus) => void;
  updateClosure: (id: string, data: Partial<DailyClosure>) => void;
  addClosure: (data: Omit<DailyClosure, "id" | "date" | "submittedAt" | "status" | "variance" | "shopId" | "cashExpected">) => void;
  addLead: (data: Omit<Lead, "id" | "createdAt" | "followUpHistory" | "updatedAt">) => void;
  updateLead: (id: string, data: Partial<Lead>) => void;
  deleteLead: (id: string) => void;
  addLeadFollowUp: (id: string, follow: Omit<LeadFollowUp, "at"> & { at?: string }) => void;
  
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

const MOCK_USERS: User[] = [
  { id: "u1", name: "Alex Owner", email: "owner@techpos.com", role: "Owner", shopId: "shop1" },
  { id: "u2", name: "Sarah Staff", email: "sarah@techpos.com", role: "Sales", shopId: "shop1" },
  { id: "u3", name: "Mike Manager", email: "mike@techpos.com", role: "Manager", shopId: "shop1" },
];

const MOCK_PRODUCTS: Product[] = [
  { id: "p1", name: "iPhone 13 Pro Max", category: "iPhone", price: 3500000, costPrice: 3200000, stock: 5, minStock: 2 },
  { id: "p2", name: "Samsung Galaxy S22", category: "Samsung", price: 2800000, costPrice: 2500000, stock: 3, minStock: 2 },
  { id: "p3", name: "Tempered Glass Screen", category: "Accessories", price: 15000, costPrice: 5000, stock: 100, minStock: 20 },
  { id: "p4", name: "iPhone 14 Case", category: "Accessories", price: 25000, costPrice: 10000, stock: 50, minStock: 10 },
  { id: "p5", name: "USB-C Charger", category: "Accessories", price: 35000, costPrice: 15000, stock: 30, minStock: 5 },
];

const MOCK_DEVICES: Device[] = [
  { id: "d1", brand: "Apple", model: "iPhone 11", imei: "356998000001", color: "Black", storage: "64GB", condition: "Used", status: "In Stock", price: 1200000, cost: 900000, addedAt: subDays(new Date(), 5).toISOString() },
  { id: "d2", brand: "Samsung", model: "A12", imei: "356998000002", color: "Blue", storage: "32GB", condition: "New", status: "In Stock", price: 600000, cost: 450000, addedAt: subDays(new Date(), 2).toISOString() },
];

const MOCK_CUSTOMERS: Customer[] = [
  { id: "c1", name: "John Doe", phone: "+256 771 234 567", email: "john@example.com", joinedAt: subDays(new Date(), 30).toISOString(), totalPurchases: 2 },
];

const MOCK_SALES: Sale[] = [
  { 
    id: "s1", saleNumber: "INV-1001", customerName: "John Doe", totalAmount: 3030000, paymentMethod: "Cash", status: "Completed", soldBy: "Sarah Staff", createdAt: subHours(new Date(), 4).toISOString(),
    items: [
      { id: "si1", name: "Samsung Galaxy S22", quantity: 1, unitPrice: 2800000, totalPrice: 2800000 },
      { id: "si2", name: "USB-C Charger", quantity: 1, unitPrice: 35000, totalPrice: 35000 },
    ]
  }
];

const MOCK_EXPENSES: Expense[] = [
  { id: "e1", category: "Supplies", description: "Cleaning materials", amount: 50000, date: subDays(new Date(), 1).toISOString(), recordedBy: "Mike Manager" }
];

const MOCK_REPAIRS: Repair[] = [
  { id: "r1", repairNumber: "REP-5001", deviceBrand: "Apple", deviceModel: "iPhone X", imei: "990011...", issueDescription: "Cracked Screen", repairType: "Screen Replacement", price: 150000, notes: "Waiting for part", status: "Pending", createdAt: subDays(new Date(), 1).toISOString(), customerName: "Alice" }
];

const MOCK_LOGS: AuditLog[] = [
  { id: "l1", action: "LOGIN", entity: "Auth", details: "User Sarah Staff logged in", user: "Sarah Staff", timestamp: subHours(new Date(), 5).toISOString() },
  { id: "l2", action: "SALE_CREATE", entity: "Sale", details: "Created sale INV-1001", user: "Sarah Staff", timestamp: subHours(new Date(), 4).toISOString() },
];

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: "n1", title: "Low Stock Alert", message: "iPhone 13 Pro Max is running low (5 left)", type: "warning", read: false, timestamp: new Date().toISOString() }
];

const STORAGE_KEYS = {
  products: "ariostore_products",
  devices: "ariostore_devices",
  customers: "ariostore_customers",
  sales: "ariostore_sales",
  expenses: "ariostore_expenses",
  repairs: "ariostore_repairs",
  tradeIns: "ariostore_tradeins",
  closures: "ariostore_closures",
  auditLogs: "ariostore_audit_logs",
  leads: "ariostore_leads",
};

function loadPersisted<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function persist<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota issues
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user: authUser } = useAuth();
  const [activeShopId, setActiveShopId] = useState("shop1");
  const [shops, setShops] = useState<Shop[]>(() => {
    try {
      const raw = localStorage.getItem("ariostore_shops");
      return raw ? JSON.parse(raw) : MOCK_SHOPS;
    } catch {
      return MOCK_SHOPS;
    }
  });
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [products, setProducts] = useState<Product[]>(() => loadPersisted(STORAGE_KEYS.products, MOCK_PRODUCTS));
  const [devices, setDevices] = useState<Device[]>(() => loadPersisted(STORAGE_KEYS.devices, MOCK_DEVICES));
  const [customers, setCustomers] = useState<Customer[]>(() => loadPersisted(STORAGE_KEYS.customers, MOCK_CUSTOMERS));
  const [sales, setSales] = useState<Sale[]>(() => loadPersisted(STORAGE_KEYS.sales, MOCK_SALES));
  const [expenses, setExpenses] = useState<Expense[]>(() => loadPersisted(STORAGE_KEYS.expenses, MOCK_EXPENSES));
  const [repairs, setRepairs] = useState<Repair[]>(() => loadPersisted(STORAGE_KEYS.repairs, MOCK_REPAIRS));
  const [tradeIns, setTradeIns] = useState<TradeIn[]>(() => loadPersisted(STORAGE_KEYS.tradeIns, []));
  const [closures, setClosures] = useState<DailyClosure[]>(() => loadPersisted(STORAGE_KEYS.closures, []));
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => loadPersisted(STORAGE_KEYS.auditLogs, MOCK_LOGS));
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [leads, setLeads] = useState<Lead[]>(() => loadPersisted(STORAGE_KEYS.leads, []));

  useEffect(() => persist(STORAGE_KEYS.products, products), [products]);
  useEffect(() => persist(STORAGE_KEYS.devices, devices), [devices]);
  useEffect(() => persist(STORAGE_KEYS.customers, customers), [customers]);
  useEffect(() => persist(STORAGE_KEYS.sales, sales), [sales]);
  useEffect(() => persist(STORAGE_KEYS.expenses, expenses), [expenses]);
  useEffect(() => persist(STORAGE_KEYS.repairs, repairs), [repairs]);
  useEffect(() => persist(STORAGE_KEYS.tradeIns, tradeIns), [tradeIns]);
  useEffect(() => persist(STORAGE_KEYS.closures, closures), [closures]);
  useEffect(() => persist(STORAGE_KEYS.auditLogs, auditLogs), [auditLogs]);
  useEffect(() => persist(STORAGE_KEYS.leads, leads), [leads]);

  useEffect(() => {
    if (authUser?.shopId) {
      setActiveShopId(authUser.shopId);
    }
  }, [authUser?.shopId]);

  useEffect(() => {
    try {
      localStorage.setItem("ariostore_shops", JSON.stringify(shops));
    } catch {
      // ignore
    }
  }, [shops]);

  const updateShop = async (id: string, updates: Partial<Shop>) => {
    try {
      const updated = await apiRequest<Shop>("PATCH", `/api/shops/${id}`, updates);
      setShops(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
      if (id === activeShopId) setActiveShopId(id);
      return updated;
    } catch {
      // fallback to local update if API unavailable
      setShops(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
      if (id === activeShopId) setActiveShopId(id);
      return shops.find(s => s.id === id) || null;
    }
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
          shopId: authUser.shopId || "shop1",
          status: authUser.status === "disabled" ? "disabled" : "active",
          lastActiveAt: authUser.lastActiveAt,
        }]);
        return;
      }
      try {
        const staff = await apiRequest<User[]>("GET", "/api/staff");
        setUsers(staff.map(s => ({ ...s, email: s.email || "" })));
      } catch {
        setUsers(MOCK_USERS);
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

  const addLead = (data: Omit<Lead, "id" | "createdAt" | "followUpHistory" | "updatedAt">) => {
    const now = new Date().toISOString();
    const lead: Lead = {
      ...data,
      id: `lead-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
      followUpHistory: [],
      shopId: data.shopId || activeShopId,
      createdBy: currentUser?.id,
      createdByName: currentUser?.name,
    };
    setLeads(prev => [lead, ...prev]);
    logAction("CREATE", "Lead", `Added lead ${data.customerName}`);
  };

  const updateLead = (id: string, data: Partial<Lead>) => {
    const now = new Date().toISOString();
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...data, updatedAt: now } : l));
    logAction("UPDATE", "Lead", `Updated lead ${id}`);
  };

  const deleteLead = (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
    logAction("DELETE", "Lead", `Removed lead ${id}`);
  };

  const addLeadFollowUp = (id: string, follow: Omit<LeadFollowUp, "at"> & { at?: string }) => {
    const now = new Date().toISOString();
    setLeads(prev => prev.map(l => {
      if (l.id !== id) return l;
      const entry: LeadFollowUp = {
        by: follow.by || currentUser?.name || "Staff",
        byId: follow.byId || currentUser?.id,
        at: follow.at || now,
        note: follow.note,
        result: follow.result,
      };
      const history = [...(l.followUpHistory || []), entry];
      const next = follow.result === "won" || follow.result === "lost" ? undefined : follow.at;
      const status = follow.result === "won" ? "won" : follow.result === "lost" ? "lost" : "in_progress";
      return { ...l, followUpHistory: history, nextFollowUpAt: next, status, updatedAt: now };
    }));
    logAction("UPDATE", "Lead", `Follow-up on lead ${id}`);
  };

  const addProduct = (data: Omit<Product, "id">) => {
    const newProduct = { ...data, id: `p-${Date.now()}` };
    setProducts([...products, newProduct]);
    logAction("CREATE", "Product", `Added product ${data.name}`);
  };

  const updateProduct = (id: string, data: Partial<Product>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
    const name = products.find(p => p.id === id)?.name || id;
    logAction("UPDATE", "Product", `Updated product ${name}`);
  };

  const deleteProduct = (id: string) => {
    const name = products.find(p => p.id === id)?.name || id;
    setProducts(prev => prev.filter(p => p.id !== id));
    logAction("DELETE", "Product", `Removed product ${name}`);
  };

  const addDevice = (data: Omit<Device, "id" | "status" | "addedAt">) => {
    setDevices([...devices, { ...data, id: `d-${Date.now()}`, status: "In Stock", addedAt: new Date().toISOString() }]);
    logAction("CREATE", "Device", `Added device ${data.brand} ${data.model}`);
  };

  const addCustomer = (data: Omit<Customer, "id" | "joinedAt" | "totalPurchases">) => {
    setCustomers([...customers, { ...data, id: `c-${Date.now()}`, joinedAt: new Date().toISOString(), totalPurchases: 0 }]);
    logAction("CREATE", "Customer", `Registered customer ${data.name}`);
  };

  const recordSale = (data: Omit<Sale, "id" | "saleNumber" | "createdAt">) => {
    const saleNumber = `INV-${1000 + sales.length + 1}`;
    setSales([{ ...data, id: `s-${Date.now()}`, saleNumber, soldBy: data.soldBy || currentUser?.name || "Staff", createdAt: new Date().toISOString() }, ...sales]);
    
    // Deduct stock
    const updatedProducts = [...products];
    const updatedDevices = [...devices];
    
    data.items.forEach(item => {
      if (item.productId) {
        const pIdx = updatedProducts.findIndex(p => p.id === item.productId);
        if (pIdx >= 0) updatedProducts[pIdx].stock -= item.quantity;
      }
      if (item.deviceId) {
        const dIdx = updatedDevices.findIndex(d => d.id === item.deviceId);
        if (dIdx >= 0) updatedDevices[dIdx].status = "Sold";
      }
    });
    
    setProducts(updatedProducts);
    setDevices(updatedDevices);
    logAction("CREATE", "Sale", `Recorded sale ${saleNumber}`);
  };

  const recordExpense = (data: Omit<Expense, "id">) => {
    setExpenses([{ ...data, id: `e-${Date.now()}`, recordedBy: currentUser?.name || data.recordedBy }, ...expenses]);
    logAction("CREATE", "Expense", `Recorded expense ${data.category} - ${data.amount}`);
  };

  const recordTradeIn = (data: Omit<TradeIn, "id" | "createdAt" | "status">) => {
    const tradeInId = `tr-${Date.now()}`;
    const newTradeIn: TradeIn = {
      ...data,
      id: tradeInId,
      status: "Approved",
      createdAt: new Date().toISOString()
    };
    setTradeIns([newTradeIn, ...tradeIns]);
    
    // Automatically add to inventory as "Used"
    addDevice({
      brand: data.brand,
      model: data.model,
      imei: data.imei,
      color: "Unknown", // Simplified
      storage: "Unknown", // Simplified
      condition: "Used",
      price: Math.ceil(data.offerPrice * 1.3), // 30% markup default
      cost: data.offerPrice
    });

    // Record as expense (payout)
    recordExpense({
      category: "Inventory Purchase",
      description: `Trade-in Payout: ${data.brand} ${data.model} (${data.imei})`,
      amount: data.offerPrice,
      date: new Date().toISOString(),
      recordedBy: currentUser?.name || "Staff"
    });

    logAction("CREATE", "TradeIn", `Processed trade-in for ${data.brand} ${data.model}`);
  };

  const addRepair = (data: Omit<Repair, "id" | "repairNumber" | "status" | "createdAt">) => {
    const repairNumber = `REP-${5000 + repairs.length + 1}`;
    setRepairs([{ ...data, id: `r-${Date.now()}`, repairNumber, status: "Pending", createdAt: new Date().toISOString() }, ...repairs]);
    logAction("CREATE", "Repair", `Started repair ${repairNumber}`);
  };

  const updateRepairStatus = (id: string, status: RepairStatus) => {
    setRepairs(repairs.map(r => r.id === id ? { ...r, status } : r));
    logAction("UPDATE", "Repair", `Updated repair ${id} status to ${status}`);
  };

  const addClosure = (data: Omit<DailyClosure, "id" | "date" | "submittedAt" | "status" | "variance" | "shopId" | "cashExpected">) => {
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
      setNotifications([
        {
          id: `notif-${Date.now()}`,
          title: "Cash Variance Alert",
          type: "warning",
          message: `Daily closure has ${varianceType} of UGX ${varianceAmount.toLocaleString()}`,
          timestamp: new Date().toISOString(),
          read: false,
        },
        ...notifications
      ]);
    }
    
    setClosures([{ 
      ...data, 
      id: `cl-${Date.now()}`, 
      date: new Date().toISOString(), 
      submittedAt: new Date().toISOString(), 
      status, 
      variance, 
      cashExpected,
      submittedBy: data.submittedBy || currentUser?.name || "Staff",
      shopId: activeShopId 
    }, ...closures]);
    logAction("CREATE", "Closure", `Submitted daily closure${variance !== 0 ? ` with variance: ${variance}` : ""}`);
  };

  const updateClosure = (id: string, data: Partial<DailyClosure>) => {
    const now = new Date().toISOString();
    setClosures(prev => prev.map(c => c.id === id ? { ...c, ...data, updatedAt: now } : c));
    logAction("UPDATE", "Closure", `Updated closure ${id}`);
  };

  const addUser = async (data: Omit<User, "id"> & { pin?: string }) => {
    const payload = { ...data, pin: data.pin || "0000", status: data.status || "active" };
    try {
      const created = await apiRequest<User>("POST", "/api/staff", payload);
      setUsers(prev => [...prev, created]);
      logAction("CREATE", "User", `Added staff member ${created.name}`, created.id);
    } catch {
      // fallback to local if API fails
      const newUser = { ...data, id: `u-${Date.now()}` };
      setUsers([...users, newUser]);
      logAction("CREATE", "User", `Added staff member ${data.name}`);
    }
  };

  const updateUser = async (id: string, data: Partial<User> & { pin?: string }) => {
    try {
      const updated = await apiRequest<User>("PATCH", `/api/staff/${id}`, data);
      setUsers(users.map(u => u.id === id ? { ...u, ...updated } : u));
      logAction("UPDATE", "User", `Updated staff member ${updated.name}`, id);
    } catch {
      setUsers(users.map(u => u.id === id ? { ...u, ...data } : u));
      logAction("UPDATE", "User", `Updated staff member ${id}`);
    }
  };

  const deleteUser = async (id: string) => {
    try {
      await apiRequest("PATCH", `/api/staff/${id}/status`, { status: "disabled" });
      setUsers(users.map(u => u.id === id ? { ...u, status: "disabled" } : u));
      logAction("DISABLE", "User", `Disabled staff member ${id}`, id);
    } catch {
      setUsers(users.filter(u => u.id !== id));
      logAction("DELETE", "User", `Removed staff member ${id}`);
    }
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
      tradeIns,
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
      recordTradeIn,
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
