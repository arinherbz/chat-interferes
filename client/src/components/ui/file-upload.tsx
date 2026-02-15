import React, { useRef, useState } from "react";
import { Button } from "./button";

interface Props {
  onUpload: (url: string) => void;
  accept?: string;
  multiple?: boolean;
  capture?: string;
}

export function FileUpload({ onUpload, accept = "image/*", multiple = false, capture = "environment" }: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      for (let i = 0; i < files.length; i++) fd.append("files", files[i]);
      const res = await fetch("/api/uploads", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      const metas = await res.json();
      if (Array.isArray(metas) && metas[0]) {
        onUpload(metas[0].url);
      }
    } catch (err) {
      console.error(err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label className="inline-flex">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          capture={capture}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button variant="outline">{uploading ? "Uploading..." : "Upload"}</Button>
      </label>
    </div>
  );
}
