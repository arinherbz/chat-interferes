import React, { useRef, useState } from "react";
import { Button } from "./button";

interface Props {
  onUpload: (url: string) => void;
  accept?: string;
  multiple?: boolean;
  capture?: "user" | "environment";
  uploadFolder?: string;
}

export function FileUpload({ onUpload, accept = "image/*", multiple = false, capture = "environment", uploadFolder }: Props) {
  const [uploading, setUploading] = useState(false);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      for (let i = 0; i < files.length; i++) fd.append("files", files[i]);
      const path = uploadFolder ? `/api/uploads?folder=${encodeURIComponent(uploadFolder)}` : "/api/uploads";
      const res = await fetch(path, { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      const body = await res.json();
      const metas = Array.isArray(body) ? body : Array.isArray(body?.files) ? body.files : [];
      if (metas[0]?.url) {
        onUpload(metas[0].url as string);
      }
    } catch (err) {
      console.error(err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (libraryInputRef.current) libraryInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={libraryInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept={accept}
        multiple={false}
        capture={capture}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => libraryInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? "Uploading..." : "Choose file"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => cameraInputRef.current?.click()}
        disabled={uploading}
      >
        Use camera
      </Button>
    </div>
  );
}
