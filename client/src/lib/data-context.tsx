import { createContext, useContext, useState, ReactNode } from "react";
import { format, subDays, subHours } from "date-fns";

// --- TYPES ---

export type Role = "Owner" | "Supervisor" | "Staff";

export interface Shop {
  id: string;
  name: string;
  location: string;
  subscriptionPlan: "trial" | "basic" | "pro" | "enterprise";
  currency: string;
  logoUrl?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  shopId: string;
}

export interface Product {
  id: string;
  name: string;
  category: "iPhone" | "Samsung" | "Accessories" | "Other";
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  sku?: string;
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
  notes: string;
  status: RepairStatus;
  createdAt: string;
  customerName?: string;
  technician?: string;
}

export interface DailyClosure {
  id: string;
  date: string;
  cashExpected: number; // System calculated from sales
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
  auditLogs: AuditLog[];
  notifications: Notification[];

  // Actions
  setActiveShopId: (id: string) => void;
  activeShopId: string; // Add this line
  addProduct: (data: Omit<Product, "id">) => void;
  addDevice: (data: Omit<Device, "id" | "status" | "addedAt">) => void;
  addCustomer: (data: Omit<Customer, "id" | "joinedAt" | "totalPurchases">) => void;
  recordSale: (data: Omit<Sale, "id" | "saleNumber" | "createdAt">) => void;
  recordExpense: (data: Omit<Expense, "id">) => void;
  addRepair: (data: Omit<Repair, "id" | "repairNumber" | "status" | "createdAt">) => void;
  updateRepairStatus: (id: string, status: RepairStatus) => void;
  addClosure: (data: Omit<DailyClosure, "id" | "date" | "submittedAt" | "status" | "variance" | "shopId">) => void;
  
  // Helpers
  getPermissions: (role: Role) => string[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// --- MOCK DATA ---

const MOCK_SHOPS: Shop[] = [
  { id: "shop1", name: "Kampala Main", location: "Kampala Road", subscriptionPlan: "pro", currency: "UGX" },
  { id: "shop2", name: "Entebbe Branch", location: "Victoria Mall", subscriptionPlan: "basic", currency: "UGX" },
];

const MOCK_USERS: User[] = [
  { id: "u1", name: "Alex Owner", email: "owner@techpos.com", role: "Owner", shopId: "shop1" },
  { id: "u2", name: "Sarah Staff", email: "sarah@techpos.com", role: "Staff", shopId: "shop1" },
  { id: "u3", name: "Mike Supervisor", email: "mike@techpos.com", role: "Supervisor", shopId: "shop1" },
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
  { id: "e1", category: "Supplies", description: "Cleaning materials", amount: 50000, date: subDays(new Date(), 1).toISOString(), recordedBy: "Mike Supervisor" }
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

export function DataProvider({ children }: { children: ReactNode }) {
  const [activeShopId, setActiveShopId] = useState("shop1");
  const [products, setProducts] = useState(MOCK_PRODUCTS);
  const [devices, setDevices] = useState(MOCK_DEVICES);
  const [customers, setCustomers] = useState(MOCK_CUSTOMERS);
  const [sales, setSales] = useState(MOCK_SALES);
  const [expenses, setExpenses] = useState(MOCK_EXPENSES);
  const [repairs, setRepairs] = useState(MOCK_REPAIRS);
  const [closures, setClosures] = useState<DailyClosure[]>([]);
  const [auditLogs, setAuditLogs] = useState(MOCK_LOGS);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const currentUser = MOCK_USERS[0]; // Simulate logged in owner
  const activeShop = MOCK_SHOPS.find(s => s.id === activeShopId) || MOCK_SHOPS[0];

  const logAction = (action: string, entity: string, details: string) => {
    setAuditLogs(prev => [{
      id: `l-${Date.now()}`,
      action,
      entity,
      details,
      user: currentUser.name,
      timestamp: new Date().toISOString()
    }, ...prev]);
  };

  const addProduct = (data: Omit<Product, "id">) => {
    const newProduct = { ...data, id: `p-${Date.now()}` };
    setProducts([...products, newProduct]);
    logAction("CREATE", "Product", `Added product ${data.name}`);
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
    setSales([{ ...data, id: `s-${Date.now()}`, saleNumber, createdAt: new Date().toISOString() }, ...sales]);
    
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
    setExpenses([{ ...data, id: `e-${Date.now()}` }, ...expenses]);
    logAction("CREATE", "Expense", `Recorded expense ${data.category} - ${data.amount}`);
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

  const addClosure = (data: Omit<DailyClosure, "id" | "date" | "submittedAt" | "status" | "variance" | "shopId">) => {
    const variance = (data.cashCounted + data.mtnAmount + data.airtelAmount + data.cardAmount) - data.cashExpected;
    setClosures([{ ...data, id: `cl-${Date.now()}`, date: new Date().toISOString(), submittedAt: new Date().toISOString(), status: variance !== 0 ? "flagged" : "confirmed", variance, shopId: activeShopId }, ...closures]);
    logAction("CREATE", "Closure", `Submitted daily closure`);
  };

  const getPermissions = (role: Role) => {
    if (role === "Owner") return ["all"];
    if (role === "Supervisor") return ["sales", "repairs", "inventory", "reports"];
    return ["sales", "repairs"];
  };

  return (
    <DataContext.Provider value={{
      currentUser,
      activeShop,
      activeShopId, // Add this line
      shops: MOCK_SHOPS,
      users: MOCK_USERS,
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
      addDevice,
      addCustomer,
      recordSale,
      recordExpense,
      addRepair,
      updateRepairStatus,
      addClosure,
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
