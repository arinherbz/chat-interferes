import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Camera, RefreshCw, AlertTriangle, CheckCircle2, Volume2, VolumeX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  detectScanType, 
  validateIMEI, 
  validateSerialFormat, 
  extractDeviceFromTAC,
  speakScannedValue,
  type FakeDeviceCheck
} from "@/lib/scan-utils";

export interface ScanResult {
  rawValue: string;
  type: "imei" | "serial" | "unknown";
  cleanedValue: string;
  confidence: number;
  validation: {
    valid: boolean;
    error?: string;
  };
  deviceInfo?: {
    brand?: string;
    model?: string;
    confidence: number;
  };
}

interface BarcodeScannerProps {
  onScan: (decodedText: string, scanResult?: ScanResult) => void;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  enableTTS?: boolean;
  showValidation?: boolean;
}

export function BarcodeScanner({ 
  onScan, 
  isOpen, 
  onClose, 
  title = "Scan Barcode",
  enableTTS = true,
  showValidation = true
}: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isTTSEnabled, setIsTTSEnabled] = useState(enableTTS);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerRegionId = "html5qr-code-full-region";

  useEffect(() => {
    if (!isOpen) {
      setScanResult(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      startScanner();
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      stopScanner();
    };
  }, [isOpen]);

  const processScan = (decodedText: string): ScanResult => {
    const detection = detectScanType(decodedText);
    
    let validation: { valid: boolean; error?: string } = { valid: true };
    let deviceInfo: { brand?: string; model?: string; confidence: number } | undefined;

    if (detection.type === "imei") {
      validation = validateIMEI(detection.value);
      deviceInfo = extractDeviceFromTAC(detection.value);
    } else if (detection.type === "serial") {
      const serialCheck = validateSerialFormat(detection.value);
      validation = { valid: serialCheck.valid, error: serialCheck.error };
      if (serialCheck.detectedBrand) {
        deviceInfo = { brand: serialCheck.detectedBrand, confidence: 70 };
      }
    }

    return {
      rawValue: decodedText,
      type: detection.type,
      cleanedValue: detection.value,
      confidence: detection.confidence,
      validation,
      deviceInfo
    };
  };

  const startScanner = async () => {
    try {
      const element = document.getElementById(scannerRegionId);
      if (!element) {
        console.error("Scanner element not found");
        return;
      }

      if (scannerRef.current) {
        return;
      }

      const html5QrCode = new Html5Qrcode(scannerRegionId);
      scannerRef.current = html5QrCode;
      
      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          const result = processScan(decodedText);
          setScanResult(result);

          if (isTTSEnabled && result.type !== "unknown") {
            speakScannedValue(result.cleanedValue, result.type);
          }

          stopScanner();
          
          onScan(result.cleanedValue, result);
        },
        () => {}
      );
    } catch (err) {
      console.error("Failed to start scanner", err);
      setError("Could not start camera. Please ensure permissions are granted and you are using HTTPS or localhost.");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        // Ignore errors - scanner may not be running
      }
      try {
        scannerRef.current.clear();
      } catch (err) {
        // Ignore clear errors
      }
      scannerRef.current = null;
    }
  };

  const handleRescan = () => {
    setScanResult(null);
    setError(null);
    setTimeout(() => {
      startScanner();
    }, 100);
  };

  const handleConfirm = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Scan a barcode or QR code with your camera
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center min-h-[300px] bg-black/5 rounded-lg overflow-hidden relative">
          {scanResult ? (
            <div className="p-6 w-full space-y-4" data-testid="scan-result">
              <div className="text-center">
                <Badge 
                  variant={scanResult.validation.valid ? "default" : "destructive"}
                  className="mb-3"
                  data-testid="scan-type-badge"
                >
                  {scanResult.type.toUpperCase()}
                  {scanResult.confidence < 100 && ` (${scanResult.confidence}% confidence)`}
                </Badge>
                
                <p className="text-xl font-mono font-bold text-slate-800 break-all" data-testid="scanned-value">
                  {scanResult.cleanedValue}
                </p>
              </div>

              {showValidation && (
                <div className={`p-3 rounded-lg ${scanResult.validation.valid ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                  <div className="flex items-center gap-2">
                    {scanResult.validation.valid ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <span className="text-sm text-green-800">Valid {scanResult.type === "imei" ? "IMEI" : "Serial"} format</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        <span className="text-sm text-red-800">{scanResult.validation.error}</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {scanResult.deviceInfo && scanResult.deviceInfo.brand && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg" data-testid="detected-device">
                  <p className="text-sm text-blue-800">
                    <strong>Detected Device:</strong> {scanResult.deviceInfo.brand}
                    {scanResult.deviceInfo.model && ` ${scanResult.deviceInfo.model}`}
                    <span className="text-blue-600 text-xs ml-2">
                      ({scanResult.deviceInfo.confidence}% confidence)
                    </span>
                  </p>
                </div>
              )}

              <div className="flex gap-2 justify-center pt-2">
                <Button variant="outline" onClick={handleRescan} data-testid="btn-rescan">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Rescan
                </Button>
                <Button onClick={handleConfirm} data-testid="btn-confirm-scan">
                  Confirm
                </Button>
              </div>
            </div>
          ) : !error ? (
            <>
              <div id={scannerRegionId} className="w-full h-full min-h-[300px]" />
              <div className="absolute top-2 right-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsTTSEnabled(!isTTSEnabled)}
                  className="bg-white/80 hover:bg-white"
                  data-testid="btn-toggle-tts"
                >
                  {isTTSEnabled ? (
                    <Volume2 className="w-4 h-4 text-primary" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-400" />
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-red-500">
              <p>{error}</p>
              <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Reload Page
              </Button>
            </div>
          )}
          
          {!scanResult && !error && (
            <div className="text-xs text-slate-500 mt-4 text-center px-4">
              Point camera at a barcode or QR code. Ensure good lighting.
            </div>
          )}
        </div>
        
        <DialogFooter className="flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {isTTSEnabled ? "TTS enabled - will read scanned value aloud" : "TTS disabled"}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
