import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { z } from "zod";
import { useI18n } from "../i18n";
import type { ApiError } from "./api";

export type FieldErrors = Record<string, string>;

/**
 * Reads a form into a plain object. Checkboxes become booleans; fields named
 * with a trailing [] (e.g. "skills[]") are collected into arrays.
 */
export function readForm(form: HTMLFormElement): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const element of Array.from(form.elements)) {
    if (!(
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement
    ))
      continue;
    if (!element.name || element.disabled) continue;
    if (element instanceof HTMLInputElement && element.type === "checkbox") {
      data[element.name] = element.checked;
    } else if (element instanceof HTMLInputElement && element.type === "radio") {
      if (element.checked) data[element.name] = element.value;
    } else {
      data[element.name] = element.value;
    }
  }
  return data;
}

function issuesToFields(error: z.ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    fields[key] ??= issue.message;
  }
  return fields;
}

/**
 * Form submission with shared-schema validation in the browser (instant feedback)
 * and server-side field errors mapped onto the same inputs.
 */
export function useFormSubmit<S extends z.ZodType, TResult>(
  schema: S,
  submit: (values: z.output<S>) => Promise<TResult>,
  options: Omit<UseMutationOptions<TResult, ApiError, z.output<S>>, "mutationFn"> & {
    transform?: (raw: Record<string, unknown>) => Record<string, unknown>;
  } = {},
) {
  const { transform, ...mutationOptions } = options;
  const { errorMessage } = useI18n();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const mutation = useMutation<TResult, ApiError, z.output<S>>({ mutationFn: submit, ...mutationOptions });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const raw = readForm(form);
    const parsed = schema.safeParse(transform ? transform(raw) : raw);
    if (!parsed.success) {
      const fields = issuesToFields(parsed.error);
      setFieldErrors(fields);
      focusFirstError(form, fields);
      return;
    }
    setFieldErrors({});
    mutation.mutate(parsed.data, {
      onError: (error) => {
        // Errors with a known code (e.g. wrong_password) show the translated message on their fields.
        const message = errorMessage(error);
        const fields = Object.fromEntries(Object.keys(error.fields).map((field) => [field, message]));
        setFieldErrors(fields);
        focusFirstError(form, fields);
      },
    });
  }

  const formError =
    mutation.error && Object.keys(mutation.error.fields).length === 0 ? errorMessage(mutation.error) : null;

  return { onSubmit, fieldErrors, formError, isPending: mutation.isPending, mutation };
}

function focusFirstError(form: HTMLFormElement, fields: FieldErrors) {
  const first = Object.keys(fields)[0];
  if (!first) return;
  const element = form.querySelector<HTMLElement>(`[name="${CSS.escape(first)}"]`);
  element?.focus();
}
