export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) =>
  new AppError(400, "bad_request", message, fields);
export const validationError = (fields: Record<string, string>) =>
  new AppError(422, "validation_failed", "Some fields need attention", fields);
export const unauthorized = (message = "Please sign in to continue") =>
  new AppError(401, "unauthorized", message);
export const forbidden = (message = "You do not have permission to do that") =>
  new AppError(403, "forbidden", message);
export const notFound = (what = "Resource") => new AppError(404, "not_found", `${what} not found`);
export const conflict = (message: string) => new AppError(409, "conflict", message);
