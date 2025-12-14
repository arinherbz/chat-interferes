import { createContext, useContext, useState, ReactNode } from "react";
import { format, subDays } from "date-fns";

export interface Product {
  id: string;
  name: string;
  category: "iPhone" | "Samsung" | "Accessories" | "Other";
  price: number;
  stock: number;
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

export interface Repair {
  id: string;
  deviceBrand: string;
  deviceModel: string;
  imei: string;
  repairType: string;
  price: number;
  notes: string;
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
}

export interface Alert {
  id: string;
  date: string;
  type: "missing_report" | "cash_shortage";
  status: "active" | "resolved";
  message: string;
}

interface DataContextType {
  userRole: "owner" | "staff" | "supervisor"; // Exposed for UI logic
  closures: DailyClosure[];
  alerts: Alert[];
  products: Product[];
  customers: Customer[];
  addClosure: (data: Omit<DailyClosure, "id" | "date" | "submittedAt" | "status" | "variance">) => void;
  updateClosureStatus: (id: string, status: DailyClosure["status"]) => void;
  addProduct: (product: Omit<Product, "id">) => void;
  addCustomer: (customer: Omit<Customer, "id" | "joinedAt" | "devices">) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// --- MOCK DATA GENERATION ---

const MOCK_PRODUCTS: Product[] = [
  { id: "p1", name: "iPhone 13 Pro Max", category: "iPhone", price: 3500000, stock: 5 },
  { id: "p2", name: "Samsung Galaxy S22", category: "Samsung", price: 2800000, stock: 3 },
  { id: "p3", name: "Tempered Glass Screen", category: "Accessories", price: 15000, stock: 100 },
  { id: "p4", name: "iPhone 14 Case", category: "Accessories", price: 25000, stock: 50 },
  { id: "p5", name: "USB-C Charger", category: "Accessories", price: 35000, stock: 30 },
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
  const mtn = 500000;
  const airtel = 300000;
  
  return {
    id: `c-${i}`,
    date: date.toISOString(),
    cashExpected,
    cashCounted,
    mtnAmount: mtn,
    airtelAmount: airtel,
    variance: (cashCounted + mtn + airtel) - (cashExpected + mtn + airtel),
    submittedBy: "Sarah Staff",
    submittedAt: date.toISOString(),
    status: isShortage ? "flagged" : "confirmed",
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
        notes: "Customer provided screen"
      }
    ] : [],
    sales: [
      { id: `s-${i}-1`, productId: "p3", productName: "Tempered Glass Screen", quantity: 2, totalPrice: 30000 },
      { id: `s-${i}-2`, productId: "p5", productName: "USB-C Charger", quantity: 1, totalPrice: 35000 }
    ]
  };
});

const MOCK_ALERTS: Alert[] = [
  {
    id: "a-1",
    date: subDays(new Date(), 2).toISOString(),
    type: "cash_shortage",
    status: "active",
    message: "Cash shortage of 50,000 UGX on " + format(subDays(new Date(), 2), "MMM dd"),
  }
];

export function DataProvider({ children }: { children: ReactNode }) {
  const [closures, setClosures] = useState<DailyClosure[]>(MOCK_CLOSURES);
  const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS);
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [customers, setCustomers] = useState<Customer[]>(MOCK_CUSTOMERS);
  
  // In a real app, this would come from AuthContext, but we need it here for logic sometimes
  const userRole = "owner"; 

  const addClosure = (data: Omit<DailyClosure, "id" | "date" | "submittedAt" | "status" | "variance">) => {
    const variance = (Number(data.cashCounted) + Number(data.mtnAmount) + Number(data.airtelAmount)) - (Number(data.cashExpected) + Number(data.mtnAmount) + Number(data.airtelAmount));
    
    const newClosure: DailyClosure = {
      id: `new-${Date.now()}`,
      date: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      status: variance < 0 ? "flagged" : "pending",
      variance,
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

  return (
    <DataContext.Provider value={{ 
      userRole,
      closures, 
      alerts, 
      products, 
      customers,
      addClosure, 
      updateClosureStatus,
      addProduct,
      addCustomer
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
