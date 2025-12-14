import { createContext, useContext, useState, ReactNode } from "react";
import { format, subDays } from "date-fns";

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
}

export interface Alert {
  id: string;
  date: string;
  type: "missing_report" | "cash_shortage";
  status: "active" | "resolved";
  message: string;
}

interface DataContextType {
  closures: DailyClosure[];
  alerts: Alert[];
  addClosure: (data: Omit<DailyClosure, "id" | "date" | "submittedAt" | "status" | "variance">) => void;
  updateClosureStatus: (id: string, status: DailyClosure["status"]) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Generate some mock history
const MOCK_CLOSURES: DailyClosure[] = Array.from({ length: 7 }).map((_, i) => {
  const date = subDays(new Date(), i + 1);
  const isShortage = i === 2; // Simulate one bad day
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
    variance: (cashCounted + mtn + airtel) - (cashExpected + mtn + airtel), // Simplified for mock
    submittedBy: "Sarah Staff",
    submittedAt: date.toISOString(),
    status: isShortage ? "flagged" : "confirmed",
    proofs: {
      cashDrawer: "https://placehold.co/400x300?text=Cash+Drawer",
      mtn: "https://placehold.co/400x300?text=MTN+Proof",
      airtel: "https://placehold.co/400x300?text=Airtel+Proof",
    }
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

  const addClosure = (data: Omit<DailyClosure, "id" | "date" | "submittedAt" | "status" | "variance">) => {
    const variance = (Number(data.cashCounted) + Number(data.mtnAmount) + Number(data.airtelAmount)) - (Number(data.cashExpected) + Number(data.mtnAmount) + Number(data.airtelAmount)); // Simplified logic
    
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

  return (
    <DataContext.Provider value={{ closures, alerts, addClosure, updateClosureStatus }}>
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
