import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner, Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
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
  
  // We use a div ID for the scanner
  const scannerRegionId = "html5qr-code-full-region";

  useEffect(() => {
    if (!isOpen) return;

    let html5QrcodeScanner: Html5QrcodeScanner | null = null;

    // Small timeout to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      try {
        // Clear previous instance if any (though we rely on cleanup)
        const element = document.getElementById(scannerRegionId);
        if (!element) return;

        html5QrcodeScanner = new Html5QrcodeScanner(
          scannerRegionId,
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true,
            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
            ]
          },
          /* verbose= */ false
        );

        html5QrcodeScanner.render(
          (decodedText) => {
            // Success callback
            onScan(decodedText);
            // Optional: Close on success? Or let parent handle it.
            // Usually we want to beep or pause. 
            // We'll let parent close it or keep scanning.
            // For this UI, we might want to auto-close if it's a modal.
            // But let's just trigger the callback.
            
            // To prevent rapid-fire scanning of the same code, the library handles some of this,
            // but we might want to pause.
            html5QrcodeScanner?.pause(true);
            setTimeout(() => html5QrcodeScanner?.resume(), 2000); 
          },
          (errorMessage) => {
            // parse error, ignore it.
          }
        );
      } catch (err) {
        console.error("Failed to start scanner", err);
        setError("Could not start camera. Please ensure permissions are granted.");
      }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner. ", error);
        });
      }
    };
  }, [isOpen, onScan]);

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
            <div id={scannerRegionId} className="w-full" />
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
