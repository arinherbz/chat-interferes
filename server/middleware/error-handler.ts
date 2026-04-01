import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError, sendFailure } from "../utils/api-response";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) {
    return;
  }

  if (err instanceof HttpError) {
    return sendFailure(res, err.status, err.message, err.details);
  }

  if (err instanceof ZodError) {
    return sendFailure(res, 400, err.errors[0]?.message ?? "Invalid request", err.errors);
  }

  const message = err instanceof Error ? err.message : "Internal Server Error";
  console.error("[express:error]", err);
  return sendFailure(res, 500, message);
}

