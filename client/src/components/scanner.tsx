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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      stopReader();
      return;
    }
    startReader();
    return () => stopReader();
  }, [open]);

  const startReader = async () => {
    try {
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const preferred = devices.find((d) => /back|rear|environment/i.test(d.label))?.deviceId || devices[0]?.deviceId;
      await reader.decodeFromVideoDevice(preferred || undefined, videoRef.current!, (result, err) => {
        if (result) {
          onDetected(result.getText());
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
      onDetected(result.getText());
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
        <div className="relative rounded-lg overflow-hidden bg-black/80 aspect-video">
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
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-slate-600">
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
        {error && <div className="text-sm text-red-600">{error}</div>}
      </DialogContent>
    </Dialog>
  );
}
