import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Printer, X } from "lucide-react";
import { format } from "date-fns";

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  serial?: string;
}

export interface ReceiptData {
  type: "sale" | "repair" | "trade-in";
  transactionNumber: string;
  date: string;
  shop: {
    name: string;
    location: string;
    phone?: string;
    email?: string;
  };
  customer?: {
    name: string;
    phone?: string;
    email?: string;
  };
  items: ReceiptItem[];
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  paymentMethod: string;
  paidAmount?: number;
  change?: number;
  servedBy: string;
  tradeInValue?: number;
  notes?: string;
}

interface ReceiptProps {
  isOpen: boolean;
  onClose: () => void;
  data: ReceiptData;
}

export function Receipt({ isOpen, onClose, data }: ReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${data.transactionNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
              padding: 12px;
              max-width: 300px;
              margin: 0 auto;
              color: #1d1d1f;
              font-size: 11px;
              line-height: 1.4;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-mono { font-family: 'SF Mono', Monaco, monospace; }
            .font-medium { font-weight: 500; }
            .font-semibold { font-weight: 600; }
            .text-base { font-size: 16px; }
            .text-\\[15px\\] { font-size: 15px; }
            .text-\\[12px\\] { font-size: 12px; }
            .text-\\[11px\\] { font-size: 11px; }
            .text-\\[10px\\] { font-size: 10px; }
            .text-\\[9px\\] { font-size: 9px; }
            .text-\\[\\#1d1d1f\\] { color: #1d1d1f; }
            .text-\\[\\#86868b\\] { color: #86868b; }
            .text-\\[\\#34c759\\] { color: #34c759; }
            .text-\\[\\#007aff\\] { color: #007aff; }
            .bg-\\[\\#f5f5f7\\] { background-color: #f5f5f7; }
            .border-t { border-top-width: 1px; border-top-style: solid; }
            .border-t-2 { border-top-width: 2px; border-top-style: solid; }
            .border-dashed { border-style: dashed; }
            .border-\\[\\#d2d2d7\\] { border-color: #d2d2d7; }
            .border-\\[\\#1d1d1f\\] { border-color: #1d1d1f; }
            .my-3 { margin-top: 12px; margin-bottom: 12px; }
            .my-4 { margin-top: 16px; margin-bottom: 16px; }
            .mt-0\\.5 { margin-top: 2px; }
            .mt-2 { margin-top: 8px; }
            .mt-3 { margin-top: 12px; }
            .mb-2 { margin-bottom: 8px; }
            .mb-3 { margin-bottom: 12px; }
            .pt-2 { padding-top: 8px; }
            .py-1 { padding-top: 4px; padding-bottom: 4px; }
            .p-2 { padding: 8px; }
            .px-3 { padding-left: 12px; padding-right: 12px; }
            .py-4 { padding-top: 16px; padding-bottom: 16px; }
            .pr-2 { padding-right: 8px; }
            .space-y-0\\.5 > * + * { margin-top: 2px; }
            .space-y-1 > * + * { margin-top: 4px; }
            .space-y-2 > * + * { margin-top: 8px; }
            .flex { display: flex; }
            .flex-1 { flex: 1 1 0%; }
            .justify-between { justify-content: space-between; }
            .justify-center { justify-content: center; }
            .leading-tight { line-height: 1.25; }
            .tracking-tight { letter-spacing: -0.025em; }
            .tracking-wide { letter-spacing: 0.025em; }
            .uppercase { text-transform: uppercase; }
            .whitespace-nowrap { white-space: nowrap; }
            .rounded { border-radius: 4px; }
            svg { display: inline-block; vertical-align: middle; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  };

  const formatCurrency = (amount: number) => {
    return `UGX ${amount.toLocaleString()}`;
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "sale": return "Sales Receipt";
      case "repair": return "Repair Receipt";
      case "trade-in": return "Trade-In Receipt";
      default: return "Receipt";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            {getTypeLabel(data.type)}
          </DialogTitle>
          <DialogDescription className="sr-only">
            View and print your receipt
          </DialogDescription>
        </DialogHeader>

        <div ref={receiptRef} className="bg-white px-3 py-4 font-['SF_Pro_Text',-apple-system,BlinkMacSystemFont,sans-serif]" data-testid="receipt-content">
          <div className="text-center mb-3">
            <h2 className="text-base font-semibold text-[#1d1d1f] tracking-tight">{data.shop.name}</h2>
            <p className="text-[11px] text-[#86868b] leading-tight">{data.shop.location}</p>
            {data.shop.phone && <p className="text-[11px] text-[#86868b]">{data.shop.phone}</p>}
          </div>

          <div className="border-t border-dashed border-[#d2d2d7] my-3" />

          <div className="text-[11px] text-[#86868b] space-y-0.5 mb-2">
            <div className="flex justify-between">
              <span>Date</span>
              <span className="text-[#1d1d1f]">{format(new Date(data.date), "MMM dd, yyyy HH:mm")}</span>
            </div>
            <div className="flex justify-between">
              <span>Receipt</span>
              <span className="font-mono text-[#1d1d1f]">{data.transactionNumber}</span>
            </div>
          </div>

          {data.customer && (
            <div className="text-[11px] mb-2">
              <span className="text-[#86868b] uppercase tracking-wide text-[10px] font-medium">Customer</span>
              <p className="font-medium text-[#1d1d1f] mt-0.5">{data.customer.name}</p>
              {data.customer.phone && <p className="text-[#86868b]">{data.customer.phone}</p>}
            </div>
          )}

          <div className="border-t border-dashed border-[#d2d2d7] my-3" />

          <div className="space-y-2">
            {data.items.map((item, index) => (
              <div key={index} className="flex justify-between text-[12px] py-1">
                <div className="flex-1 pr-2">
                  <div className="font-medium text-[#1d1d1f] leading-tight">{item.name}</div>
                  {item.serial && (
                    <div className="text-[9px] text-[#86868b] font-mono mt-0.5">{item.serial}</div>
                  )}
                  {item.quantity > 1 && (
                    <div className="text-[10px] text-[#86868b]">{item.quantity} x {formatCurrency(item.unitPrice)}</div>
                  )}
                </div>
                <div className="font-mono text-[#1d1d1f] text-right whitespace-nowrap">
                  {formatCurrency(item.totalPrice)}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-[#d2d2d7] my-3" />

          <div className="space-y-1 text-[12px]">
            <div className="flex justify-between text-[#86868b]">
              <span>Subtotal</span>
              <span className="font-mono text-[#1d1d1f]">{formatCurrency(data.subtotal)}</span>
            </div>
            {data.discount && data.discount > 0 && (
              <div className="flex justify-between text-[#34c759]">
                <span>Discount</span>
                <span className="font-mono">-{formatCurrency(data.discount)}</span>
              </div>
            )}
            {data.tradeInValue && data.tradeInValue > 0 && (
              <div className="flex justify-between text-[#007aff]">
                <span>Trade-In Credit</span>
                <span className="font-mono">-{formatCurrency(data.tradeInValue)}</span>
              </div>
            )}
            {data.tax && data.tax > 0 && (
              <div className="flex justify-between text-[#86868b]">
                <span>Tax</span>
                <span className="font-mono text-[#1d1d1f]">{formatCurrency(data.tax)}</span>
              </div>
            )}
            <div className="border-t-2 border-[#1d1d1f] pt-2 mt-2">
              <div className="flex justify-between text-[15px] font-semibold text-[#1d1d1f]">
                <span>Total</span>
                <span className="font-mono">{formatCurrency(data.total)}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 text-center text-[11px] text-[#86868b]">
            <p>Payment: <span className="text-[#1d1d1f]">{data.paymentMethod}</span></p>
            {data.paidAmount !== undefined && (
              <p className="mt-0.5">
                Paid: <span className="text-[#1d1d1f]">{formatCurrency(data.paidAmount)}</span>
                {data.change !== undefined && data.change > 0 && (
                  <span> | Change: <span className="text-[#1d1d1f]">{formatCurrency(data.change)}</span></span>
                )}
              </p>
            )}
          </div>

          <div className="flex justify-center my-4">
            <QRCodeSVG 
              value={`${data.type}:${data.transactionNumber}`}
              size={64}
              level="M"
              className="mx-auto"
            />
          </div>
          <p className="text-center text-[9px] text-[#86868b] font-mono">
            {data.transactionNumber}
          </p>

          <div className="border-t border-dashed border-[#d2d2d7] my-3" />

          <div className="text-center text-[11px] text-[#86868b]">
            <p>Served by <span className="text-[#1d1d1f]">{data.servedBy}</span></p>
            <p className="mt-2 font-medium text-[#1d1d1f]">Thank you for your business!</p>
          </div>

          {data.notes && (
            <div className="mt-3 p-2 bg-[#f5f5f7] rounded text-[11px] text-[#1d1d1f]">
              <span className="text-[#86868b]">Note:</span> {data.notes}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
          <Button className="flex-1" onClick={handlePrint} data-testid="btn-print-receipt">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function generateSaleReceipt(
  sale: {
    saleNumber: string;
    customerName?: string;
    customerPhone?: string;
    items: { name: string; quantity: number; unitPrice: number; totalPrice: number; serial?: string }[];
    totalAmount: number;
    discount?: number;
    tax?: number;
    paymentMethod: string;
    paidAmount?: number;
    soldBy: string;
    createdAt: string;
  },
  shop: { name: string; location: string; phone?: string }
): ReceiptData {
  const subtotal = sale.items.reduce((sum, item) => sum + item.totalPrice, 0);
  const discount = sale.discount ?? 0;
  const tax = sale.tax ?? 0;
  const total = subtotal - discount + tax;
  const paidAmount = sale.paidAmount ?? total;
  const change = paidAmount > total ? paidAmount - total : 0;

  return {
    type: "sale",
    transactionNumber: sale.saleNumber,
    date: sale.createdAt,
    shop,
    customer: sale.customerName ? { name: sale.customerName, phone: sale.customerPhone } : undefined,
    items: sale.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      serial: item.serial,
    })),
    subtotal,
    discount: discount > 0 ? discount : undefined,
    tax: tax > 0 ? tax : undefined,
    total,
    paymentMethod: sale.paymentMethod,
    paidAmount,
    change: change > 0 ? change : undefined,
    servedBy: sale.soldBy,
  };
}

export function generateRepairReceipt(
  repair: {
    repairNumber: string;
    deviceBrand: string;
    deviceModel: string;
    imei: string;
    repairType: string;
    price: number;
    customerName?: string;
    technician?: string;
    createdAt: string;
  },
  shop: { name: string; location: string }
): ReceiptData {
  return {
    type: "repair",
    transactionNumber: repair.repairNumber,
    date: repair.createdAt,
    shop,
    customer: repair.customerName ? { name: repair.customerName } : undefined,
    items: [{
      name: `${repair.deviceBrand} ${repair.deviceModel} - ${repair.repairType}`,
      quantity: 1,
      unitPrice: repair.price,
      totalPrice: repair.price,
      serial: repair.imei,
    }],
    subtotal: repair.price,
    total: repair.price,
    paymentMethod: "Pending",
    servedBy: repair.technician || "Staff",
  };
}

export function generateTradeInReceipt(
  tradeIn: {
    tradeInNumber: string;
    brand: string;
    model: string;
    imei: string;
    calculatedOffer: number;
    customerName: string;
    customerPhone?: string;
    payoutMethod?: string;
    processedByName?: string;
    createdAt: string;
  },
  shop: { name: string; location: string }
): ReceiptData {
  return {
    type: "trade-in",
    transactionNumber: tradeIn.tradeInNumber,
    date: tradeIn.createdAt,
    shop,
    customer: { 
      name: tradeIn.customerName,
      phone: tradeIn.customerPhone,
    },
    items: [{
      name: `${tradeIn.brand} ${tradeIn.model} (Trade-In)`,
      quantity: 1,
      unitPrice: tradeIn.calculatedOffer,
      totalPrice: tradeIn.calculatedOffer,
      serial: tradeIn.imei,
    }],
    subtotal: tradeIn.calculatedOffer,
    total: tradeIn.calculatedOffer,
    paymentMethod: tradeIn.payoutMethod || "Cash",
    servedBy: tradeIn.processedByName || "Staff",
    notes: "Trade-in value to be paid to customer",
  };
}
