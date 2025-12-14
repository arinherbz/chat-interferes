import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X, Camera, RefreshCw } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export function BarcodeScanner({ onScan, isOpen, onClose, title = "Scan Barcode" }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  // We use a div ID for the scanner
  const scannerRegionId = "html5qr-code-full-region";

  useEffect(() => {
    if (!isOpen) return;

    // Small timeout to ensure DOM is ready and dialog animation is done
    const timeoutId = setTimeout(() => {
      startScanner();
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async () => {
    try {
      const element = document.getElementById(scannerRegionId);
      if (!element) {
        console.error("Scanner element not found");
        return;
      }

      if (scannerRef.current) {
        // Already initialized
        return;
      }

      const html5QrCode = new Html5Qrcode(scannerRegionId);
      scannerRef.current = html5QrCode;

      // Formats are actually configured on the instance, not start() config for Html5Qrcode class
      // But for Html5QrcodeScanner it was in config.
      // For Html5Qrcode class, we might need to rely on the default or check docs.
      // Actually, formatsToSupport is ignored in start() config for Html5Qrcode.
      // It should be passed to the constructor if possible, but the constructor only takes verbose.
      // The library detects formats automatically in standard mode, or we can use the experimental features.
      // However, usually it supports common formats by default.
      
      await html5QrCode.start(
        { facingMode: "environment" }, // Prefer back camera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // Success callback
          onScan(decodedText);
          // Optional: pause or stop? 
          // We'll stop scanning once we find something to avoid double-scans
          stopScanner();
        },
        (errorMessage) => {
          // parse error, ignore it.
        }
      );
    } catch (err) {
      console.error("Failed to start scanner", err);
      setError("Could not start camera. Please ensure permissions are granted and you are using HTTPS or localhost.");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.error("Failed to stop scanner", err);
      }
      scannerRef.current = null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center min-h-[300px] bg-black/5 rounded-lg overflow-hidden relative">
          {!error ? (
            <div id={scannerRegionId} className="w-full h-full min-h-[300px]" />
          ) : (
            <div className="p-6 text-center text-red-500">
              <p>{error}</p>
              <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Reload Page
              </Button>
            </div>
          )}
          
          <div className="text-xs text-slate-500 mt-4 text-center px-4">
            Point camera at a barcode or QR code. Ensure good lighting.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
