import type { z } from "zod";
import { validationError } from "./errors";

/** Parses untrusted input, converting Zod issues into a field → message map for the client. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input ?? {});
  if (result.success) return result.data;

  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    fields[key] ??= issue.message;
  }
  throw validationError(fields);
}
