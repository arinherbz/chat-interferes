import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, Image, X } from "lucide-react";

interface ScannerProps {
  open: boolean;
  onClose: () => void;
  onDetected: (text: string) => void;
  title?: string;
}

export function Scanner({ open, onClose, onDetected, title = "Scan barcode" }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const lastDetectedRef = useRef<{ value: string; ts: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      stopReader();
      return;
    }
    setError(null);
    startReader();
    return () => stopReader();
  }, [open]);

  const startReader = async () => {
    try {
      setError(null);
      stopReader();
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      if (!videoRef.current) {
        setError("Scanner preview could not start. Please reopen the scanner.");
        return;
      }
      if (devices.length === 0) {
        setError("No camera was found on this device.");
        return;
      }
      const preferred = devices.find((d) => /back|rear|environment/i.test(d.label))?.deviceId || devices[0]?.deviceId;
      await reader.decodeFromVideoDevice(preferred || undefined, videoRef.current!, (result, err) => {
        if (result) {
          const value = result.getText().trim();
          const now = Date.now();
          if (
            lastDetectedRef.current &&
            lastDetectedRef.current.value === value &&
            now - lastDetectedRef.current.ts < 750
          ) {
            return;
          }
          lastDetectedRef.current = { value, ts: now };
          onDetected(value);
          onClose();
        }
        if (err && (err as any).name && (err as any).name !== "NotFoundException") {
          setError("Unable to read code. Try again or upload an image.");
        }
      });
    } catch (err: any) {
      setError(err?.message || "Camera unavailable");
    }
  };

  const stopReader = () => {
    (readerRef.current as any)?.reset?.();
    readerRef.current = null;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const reader = new BrowserMultiFormatReader();
      const url = URL.createObjectURL(file);
      const result = await reader.decodeFromImageUrl(url);
      URL.revokeObjectURL(url);
      const value = result.getText().trim();
      lastDetectedRef.current = { value, ts: Date.now() };
      onDetected(value);
      onClose();
    } catch (err: any) {
      setError("Could not decode that image. Try another photo.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(openState) => !openState && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/85 aspect-video shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
          <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
          <div className="absolute inset-0 border-4 border-white/20 pointer-events-none" />
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/60"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="surface-panel flex items-center justify-between gap-3 flex-wrap p-4 shadow-none">
          <div className="text-sm text-muted-foreground">
            Allow camera access or upload a barcode/QR photo to scan.
          </div>
          <Button variant="outline" size="sm" className="flex items-center gap-2" asChild>
            <label className="cursor-pointer">
              <Image className="w-4 h-4" />
              <span>Scan from photo</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          </Button>
        </div>
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50/90 px-3 py-2 text-sm text-rose-600">{error}</div>}
      </DialogContent>
    </Dialog>
  );
}
