import type { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

export interface UploadedFileMeta {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  shopId?: string | null;
}

const uploadRoot = path.join(process.cwd(), "uploads");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const now = new Date();
    const dateFolder = now.toISOString().slice(0, 10);
    const target = path.join(uploadRoot, dateFolder);
    ensureDir(target);
    cb(null, target);
  },
  filename: (_req, file, cb) => {
    const id = crypto.randomUUID();
    const ext = path.extname(file.originalname) || "";
    cb(null, `${id}${ext}`);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/", "application/pdf", "text/plain"];
    if (allowed.some((p) => file.mimetype.startsWith(p))) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"));
    }
  },
}).array("files", 5);

export function handleUpload(req: Request, res: Response) {
  uploadMiddleware(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ message: err.message || "Upload failed" });
    }
    const now = new Date();
    const dateFolder = now.toISOString().slice(0, 10);
    const files = (req.files as Express.Multer.File[]) || [];
    const metas: UploadedFileMeta[] = files.map((file) => {
      const id = path.parse(file.filename).name;
      return {
        id,
        url: `/uploads/${dateFolder}/${file.filename}`,
        filename: file.originalname,
        contentType: file.mimetype,
        size: file.size,
        uploadedAt: now.toISOString(),
      };
    });
    res.json(metas);
  });
}
