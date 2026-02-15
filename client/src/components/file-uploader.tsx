import { useCallback, useRef, useState } from "react";
import { Upload, X, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface UploadedFileMeta {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: string;
}

interface FileUploaderProps {
  value: UploadedFileMeta[];
  onChange: (files: UploadedFileMeta[]) => void;
  multiple?: boolean;
  accept?: string;
  maxFiles?: number;
  className?: string;
}

export function FileUploader({
  value,
  onChange,
  multiple = true,
  accept = "image/*,application/pdf,text/plain",
  maxFiles = 5,
  className,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);
      setIsUploading(true);

      try {
        const canReplaceSingle = maxFiles === 1;
        const remaining = canReplaceSingle ? 1 : Math.max(0, maxFiles - value.length);
        if (remaining === 0) {
          setIsUploading(false);
          return;
        }
        const formData = new FormData();
        Array.from(files)
          .slice(0, remaining)
          .forEach((file) => formData.append("files", file));

        const res = await fetch("/api/uploads", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Upload failed");
        }

        const metas = (await res.json()) as UploadedFileMeta[];
        if (canReplaceSingle) {
          onChange([metas[0]]);
        } else {
          onChange([...value, ...metas]);
        }
      } catch (err: any) {
        setError(err?.message || "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [maxFiles, onChange, value]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const triggerSelect = () => {
    inputRef.current?.click();
  };

  const removeFile = (id: string) => {
    onChange(value.filter((f) => f.id !== id));
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-4 sm:p-5 flex flex-col gap-3 items-center text-center transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-slate-200 bg-white"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        <Upload className="w-6 h-6 text-primary" />
        <p className="text-sm text-slate-600">
          Drag & drop photos or receipts, or use your camera
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          <Button
            size="sm"
            variant="outline"
            onClick={triggerSelect}
            disabled={isUploading || (value.length >= maxFiles && maxFiles !== 1)}
          >
            <Upload className="w-4 h-4 mr-2" />
            Choose files
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => triggerSelect()}
            disabled={isUploading || (value.length >= maxFiles && maxFiles !== 1)}
          >
            <Camera className="w-4 h-4 mr-2" />
            Use camera
          </Button>
        </div>
        {isUploading && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Uploading...
          </div>
        )}
        {error && <div className="text-sm text-red-600">{error}</div>}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          capture="environment"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <p className="text-xs text-slate-500">
          Up to {maxFiles} files. Images, PDFs, or text. Max 10MB each.
        </p>
      </div>

      {value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {value.map((file) => (
            <div
              key={file.id}
              className="border rounded-lg p-3 bg-white shadow-sm flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="truncate text-sm font-medium">{file.filename}</div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => removeFile(file.id)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="text-xs text-slate-500">
                {(file.size / 1024).toFixed(1)} KB • {file.contentType}
              </div>
              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Preview
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
