import type { Response } from "express";

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiFailure = {
  success: false;
  error: string;
  message?: string;
  details?: unknown;
};

export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

export function sendSuccess<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({
    success: true,
    data,
  } satisfies ApiSuccess<T>);
}

export function sendFailure(res: Response, status: number, error: string, details?: unknown) {
  return res.status(status).json({
    success: false,
    error,
    message: error,
    ...(details === undefined ? {} : { details }),
  } satisfies ApiFailure);
}
