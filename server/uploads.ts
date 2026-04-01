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
ensureDir(uploadRoot);
const PRODUCT_IMAGE_FOLDER = "product-images";

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function normalizeUploadFolder(input?: string | null) {
  const normalized = (input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/-]/g, "-")
    .replace(/\/+/g, "/")
    .replace(/^-+|-+$/g, "");

  if (!normalized) return "misc";
  return normalized.split("/").filter(Boolean).join("/");
}

function getQueryFolder(value: unknown) {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const now = new Date();
    const dateFolder = now.toISOString().slice(0, 10);
    const folder = normalizeUploadFolder(getQueryFolder(req.query.folder));
    const target = path.join(uploadRoot, folder, dateFolder);
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
  fileFilter: (req, file, cb) => {
    const folder = normalizeUploadFolder(getQueryFolder(req.query.folder));
    const allowedMimePrefixes = folder === PRODUCT_IMAGE_FOLDER
      ? ["image/"]
      : ["image/", "application/pdf", "text/plain"];

    if (folder === PRODUCT_IMAGE_FOLDER && !file.mimetype.startsWith("image/")) {
      cb(new Error("Product images must be PNG, JPG, WEBP, or GIF"));
      return;
    }

    if (allowedMimePrefixes.some((p) => file.mimetype.startsWith(p))) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"));
    }
  },
}).fields([
  { name: "files", maxCount: 5 },
  { name: "file", maxCount: 1 },
]);

export function handleUpload(req: Request, res: Response) {
  uploadMiddleware(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ message: err.message || "Upload failed" });
    }
    const now = new Date();
    const grouped = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
    const files = Object.values(grouped).flat();
    const metas: UploadedFileMeta[] = files.map((file) => {
      const id = path.parse(file.filename).name;
      const relativeDir = path.relative(uploadRoot, file.destination).split(path.sep).join("/");
      return {
        id,
        url: `/uploads/${relativeDir}/${file.filename}`,
        filename: file.originalname,
        contentType: file.mimetype,
        size: file.size,
        uploadedAt: now.toISOString(),
      };
    });
    res.json(metas);
  });
}

export function removeUploadedFileByUrl(url?: string | null) {
  if (!url || !url.startsWith("/uploads/")) return;
  const relativePath = url.replace(/^\/uploads\//, "");
  const target = path.join(uploadRoot, relativePath);
  if (!target.startsWith(uploadRoot)) return;
  try {
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
    }
  } catch {}
}
