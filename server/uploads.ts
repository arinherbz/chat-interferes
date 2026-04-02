import type { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { sql as sqlFn } from "drizzle-orm";
import { db, pool } from "./db";
import { mediaAssets } from "@shared/schema";

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

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
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

function buildProductImageUrl(assetId: string, filename: string) {
  return `/uploads/media/${assetId}/${encodeURIComponent(filename)}`;
}

function shouldPersistInDatabase(file: Express.Multer.File) {
  return file.mimetype.startsWith("image/");
}

function saveFileToDisk(folder: string, file: Express.Multer.File) {
  const now = new Date();
  const dateFolder = now.toISOString().slice(0, 10);
  const targetDir = path.join(uploadRoot, folder, dateFolder);
  ensureDir(targetDir);

  const id = crypto.randomUUID();
  const ext = path.extname(file.originalname) || "";
  const filename = `${id}${ext}`;
  const target = path.join(targetDir, filename);
  fs.writeFileSync(target, file.buffer);

  return {
    id,
    url: `/uploads/${folder}/${dateFolder}/${filename}`,
    filename: file.originalname,
    contentType: file.mimetype,
    size: file.size,
    uploadedAt: now.toISOString(),
  } satisfies UploadedFileMeta;
}

async function saveImageToDatabase(folder: string, file: Express.Multer.File) {
  if (!pool) {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await db.run(sqlFn`
      INSERT INTO media_assets (
        id, folder, filename, content_type, size, data_base64, created_at
      ) VALUES (
        ${id}, ${folder}, ${file.originalname}, ${file.mimetype}, ${file.size}, ${file.buffer.toString("base64")}, ${createdAt}
      )
    `);

    return {
      id,
      url: buildProductImageUrl(id, file.originalname),
      filename: file.originalname,
      contentType: file.mimetype,
      size: file.size,
      uploadedAt: createdAt,
    } satisfies UploadedFileMeta;
  }

  const [created] = await db.insert(mediaAssets).values({
    folder,
    filename: file.originalname,
    contentType: file.mimetype,
    size: file.size,
    dataBase64: file.buffer.toString("base64"),
  }).returning();

  return {
    id: created.id,
    url: buildProductImageUrl(created.id, created.filename),
    filename: created.filename,
    contentType: created.contentType,
    size: created.size,
    uploadedAt: created.createdAt instanceof Date
      ? created.createdAt.toISOString()
      : new Date(String(created.createdAt ?? Date.now())).toISOString(),
    shopId: created.shopId ?? undefined,
  } satisfies UploadedFileMeta;
}

export function handleUpload(req: Request, res: Response) {
  uploadMiddleware(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ message: err.message || "Upload failed" });
    }
    const grouped = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
    const files = Object.values(grouped).flat();
    const folder = normalizeUploadFolder(getQueryFolder(req.query.folder));

    Promise.all(
      files.map((file) => {
        if (shouldPersistInDatabase(file)) {
          return saveImageToDatabase(folder, file);
        }
        return Promise.resolve(saveFileToDisk(folder, file));
      }),
    )
      .then((metas) => {
        res.json(metas);
      })
      .catch((uploadError: any) => {
        res.status(500).json({ message: uploadError?.message || "Upload failed" });
      });
  });
}

export function removeUploadedFileByUrl(url?: string | null) {
  if (!url || !url.startsWith("/uploads/")) return;
  const mediaMatch = url.match(/^\/uploads\/media\/([^/]+)/);
  if (mediaMatch) {
    void db.delete(mediaAssets).where(eq(mediaAssets.id, mediaMatch[1]));
    return;
  }
  const relativePath = url.replace(/^\/uploads\//, "");
  const target = path.join(uploadRoot, relativePath);
  if (!target.startsWith(uploadRoot)) return;
  try {
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
    }
  } catch {}
}

export async function serveUploadedMedia(req: Request, res: Response) {
  const assetId = req.params.id;
  const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, assetId));
  if (!asset) {
    res.status(404).send("Not found");
    return;
  }

  res.setHeader("Content-Type", asset.contentType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.send(Buffer.from(asset.dataBase64, "base64"));
}
