import { createContext, useContext, useState, ReactNode } from "react";
import { format, subDays } from "date-fns";

export interface Shop {
  id: string;
  name: string;
  location: string;
}

export interface Product {
  id: string;
  name: string;
  category: "iPhone" | "Samsung" | "Accessories" | "Other";
  price: number;
  stock: number;
  minStock: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  joinedAt: string;
  devices: {
    brand: string;
    model: string;
    imei: string;
  }[];
}

export interface Sale {
  id: string;
  productId: string | null;
  productName: string;
  quantity: number;
  totalPrice: number;
}

export type RepairStatus = "Pending" | "In Progress" | "Completed" | "Delivered";

export interface Repair {
  id: string;
  deviceBrand: string;
  deviceModel: string;
  imei: string;
  repairType: string;
  price: number;
  notes: string;
  status: RepairStatus;
  createdAt: string;
  customerName?: string;
}

export interface DailyClosure {
  id: string;
  date: string; // ISO date string
  cashExpected: number;
  cashCounted: number;
  mtnAmount: number;
  airtelAmount: number;
  variance: number;
  submittedBy: string;
  submittedAt: string;
  status: "pending" | "confirmed" | "flagged";
  proofs: {
    cashDrawer: string;
    mtn: string;
    airtel: string;
  };
  repairs: Repair[];
  sales: Sale[];
  shopId: string;
}

export interface Alert {
  id: string;
  date: string;
  type: "missing_report" | "cash_shortage" | "low_stock";
  status: "active" | "resolved";
  message: string;
}

interface DataContextType {
  userRole: "owner" | "staff" | "supervisor"; 
  activeShopId: string;
  shops: Shop[];
  closures: DailyClosure[];
  alerts: Alert[];
  products: Product[];
  customers: Customer[];
  repairs: Repair[]; // Global repair list for easier management
  setActiveShopId: (id: string) => void;
  addClosure: (data: Omit<DailyClosure, "id" | "date" | "submittedAt" | "status" | "variance" | "shopId">) => void;
  updateClosureStatus: (id: string, status: DailyClosure["status"]) => void;
  addProduct: (product: Omit<Product, "id">) => void;
  addCustomer: (customer: Omit<Customer, "id" | "joinedAt" | "devices">) => void;
  updateRepairStatus: (id: string, status: RepairStatus) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// --- MOCK DATA GENERATION ---

const MOCK_SHOPS: Shop[] = [
  { id: "shop1", name: "Kampala Main", location: "Kampala Road" },
  { id: "shop2", name: "Entebbe Branch", location: "Victoria Mall" },
];

const MOCK_PRODUCTS: Product[] = [
  { id: "p1", name: "iPhone 13 Pro Max", category: "iPhone", price: 3500000, stock: 5, minStock: 2 },
  { id: "p2", name: "Samsung Galaxy S22", category: "Samsung", price: 2800000, stock: 3, minStock: 2 },
  { id: "p3", name: "Tempered Glass Screen", category: "Accessories", price: 15000, stock: 100, minStock: 20 },
  { id: "p4", name: "iPhone 14 Case", category: "Accessories", price: 25000, stock: 50, minStock: 10 },
  { id: "p5", name: "USB-C Charger", category: "Accessories", price: 35000, stock: 30, minStock: 5 },
  { id: "p6", name: "AirPods Pro", category: "Accessories", price: 850000, stock: 8, minStock: 3 },
  { id: "p7", name: "Camera Lens Guard", category: "Accessories", price: 10000, stock: 40, minStock: 15 },
  { id: "p8", name: "Earphones (Wired)", category: "Accessories", price: 20000, stock: 60, minStock: 10 },
];

const MOCK_CUSTOMERS: Customer[] = [
  { 
    id: "cust1", 
    name: "John Doe", 
    phone: "+256 771 234 567", 
    email: "john@example.com", 
    joinedAt: subDays(new Date(), 30).toISOString(),
    devices: [{ brand: "Samsung", model: "S21", imei: "354..." }] 
  },
  { 
    id: "cust2", 
    name: "Jane Smith", 
    phone: "+256 701 987 654", 
    email: "jane@example.com", 
    joinedAt: subDays(new Date(), 10).toISOString(),
    devices: [{ brand: "Apple", model: "iPhone 12", imei: "990..." }] 
  },
];

const MOCK_CLOSURES: DailyClosure[] = Array.from({ length: 7 }).map((_, i) => {
  const date = subDays(new Date(), i + 1);
  const isShortage = i === 2;
  const cashExpected = 1500000;
  const cashCounted = isShortage ? 1450000 : 1500000;
  
  return {
    id: `c-${i}`,
    date: date.toISOString(),
    cashExpected,
    cashCounted,
    mtnAmount: 500000,
    airtelAmount: 300000,
    variance: (cashCounted + 500000 + 300000) - (cashExpected + 500000 + 300000),
    submittedBy: "Sarah Staff",
    submittedAt: date.toISOString(),
    status: isShortage ? "flagged" : "confirmed",
    shopId: "shop1",
    proofs: {
      cashDrawer: "https://placehold.co/400x300?text=Cash+Drawer",
      mtn: "https://placehold.co/400x300?text=MTN+Proof",
      airtel: "https://placehold.co/400x300?text=Airtel+Proof",
    },
    repairs: i % 2 === 0 ? [
      {
        id: `r-${i}`,
        deviceBrand: "Samsung",
        deviceModel: "A12",
        imei: "354678091234567",
        repairType: "Screen Replacement",
        price: 50000,
        notes: "Customer provided screen",
        status: "Completed",
        createdAt: date.toISOString()
      }
    ] : [],
    sales: [
      { id: `s-${i}-1`, productId: "p3", productName: "Tempered Glass Screen", quantity: 2, totalPrice: 30000 },
    ]
  };
});

// Extract all repairs from closures for the global list view
const INITIAL_REPAIRS = MOCK_CLOSURES.flatMap(c => c.repairs);

const MOCK_ALERTS: Alert[] = [
  {
    id: "a-1",
    date: subDays(new Date(), 2).toISOString(),
    type: "cash_shortage",
    status: "active",
    message: "Cash shortage of 50,000 UGX on " + format(subDays(new Date(), 2), "MMM dd"),
  },
  {
    id: "a-2",
    date: new Date().toISOString(),
    type: "low_stock",
    status: "active",
    message: "Low Stock: Samsung Galaxy S22 (3 remaining)",
  }
];

export function DataProvider({ children }: { children: ReactNode }) {
  const [activeShopId, setActiveShopId] = useState("shop1");
  const [closures, setClosures] = useState<DailyClosure[]>(MOCK_CLOSURES);
  const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS);
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [customers, setCustomers] = useState<Customer[]>(MOCK_CUSTOMERS);
  const [repairs, setRepairs] = useState<Repair[]>(INITIAL_REPAIRS);
  
  const userRole = "owner"; 

  const addClosure = (data: Omit<DailyClosure, "id" | "date" | "submittedAt" | "status" | "variance" | "shopId">) => {
    const variance = (Number(data.cashCounted) + Number(data.mtnAmount) + Number(data.airtelAmount)) - (Number(data.cashExpected) + Number(data.mtnAmount) + Number(data.airtelAmount));
    
    // Deduct stock for sales
    if (data.sales) {
      const updatedProducts = [...products];
      data.sales.forEach(sale => {
        if (sale.productId) {
          const productIndex = updatedProducts.findIndex(p => p.id === sale.productId);
          if (productIndex >= 0) {
            updatedProducts[productIndex].stock -= sale.quantity;
            // Check for low stock
            if (updatedProducts[productIndex].stock <= updatedProducts[productIndex].minStock) {
              setAlerts(prev => [{
                id: `alert-${Date.now()}`,
                date: new Date().toISOString(),
                type: "low_stock",
                status: "active",
                message: `Low Stock: ${updatedProducts[productIndex].name} (${updatedProducts[productIndex].stock} remaining)`
              }, ...prev]);
            }
          }
        }
      });
      setProducts(updatedProducts);
    }

    // Add new repairs to global list
    if (data.repairs) {
      const newRepairsWithStatus = data.repairs.map(r => ({
        ...r,
        status: "Pending" as RepairStatus, // Default status
        createdAt: new Date().toISOString()
      }));
      setRepairs([...newRepairsWithStatus, ...repairs]);
      // Update data.repairs to match (though in real backend this is relational)
      data.repairs = newRepairsWithStatus;
    }

    const newClosure: DailyClosure = {
      id: `new-${Date.now()}`,
      date: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      status: variance < 0 ? "flagged" : "pending",
      variance,
      shopId: activeShopId,
      ...data,
    };

    setClosures([newClosure, ...closures]);

    if (variance < 0) {
      const newAlert: Alert = {
        id: `alert-${Date.now()}`,
        date: new Date().toISOString(),
        type: "cash_shortage",
        status: "active",
        message: `Cash shortage of ${Math.abs(variance).toLocaleString()} UGX detected today.`
      };
      setAlerts([newAlert, ...alerts]);
    }
  };

  const updateClosureStatus = (id: string, status: DailyClosure["status"]) => {
    setClosures(closures.map(c => c.id === id ? { ...c, status } : c));
  };

  const addProduct = (product: Omit<Product, "id">) => {
    setProducts([...products, { ...product, id: `p-${Date.now()}` }]);
  };

  const addCustomer = (customer: Omit<Customer, "id" | "joinedAt" | "devices">) => {
    setCustomers([...customers, { 
      ...customer, 
      id: `c-${Date.now()}`, 
      joinedAt: new Date().toISOString(),
      devices: []
    }]);
  };

  const updateRepairStatus = (id: string, status: RepairStatus) => {
    setRepairs(repairs.map(r => r.id === id ? { ...r, status } : r));
    // Also update in closures (deep update simulation)
    setClosures(closures.map(c => ({
      ...c,
      repairs: c.repairs?.map(r => r.id === id ? { ...r, status } : r)
    })));
  };

  return (
    <DataContext.Provider value={{ 
      userRole,
      activeShopId,
      shops: MOCK_SHOPS,
      closures: closures.filter(c => c.shopId === activeShopId), // Filter by shop
      alerts, 
      products, 
      customers,
      repairs, // In real app, maybe filter by shop too
      setActiveShopId,
      addClosure, 
      updateClosureStatus,
      addProduct,
      addCustomer,
      updateRepairStatus
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
