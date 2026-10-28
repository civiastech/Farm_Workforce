/**
 * Validation messages users see on forms. English is the default (and what the API uses);
 * the web app swaps in the active language with setValidationMessages().
 * `{n}` is replaced with the relevant number.
 */
export interface ValidationMessages {
  required: string;
  invalid: string;
  minChars: string;
  maxChars: string;
  minNumber: string;
  maxNumber: string;
  maxItems: string;
  chooseOption: string;
  chooseState: string;
  email: string;
  phone: string;
  identifier: string;
  code: string;
  enterPassword: string;
  acceptTerms: string;
  payRange: string;
}

export const englishValidationMessages: ValidationMessages = {
  required: "This field is required",
  invalid: "Please check this value",
  minChars: "Use at least {n} characters",
  maxChars: "Use at most {n} characters",
  minNumber: "Must be at least {n}",
  maxNumber: "Must be at most {n}",
  maxItems: "Choose at most {n}",
  chooseOption: "Choose one of the options",
  chooseState: "Choose a state",
  email: "Enter a valid email address",
  phone: "Enter a valid Nigerian mobile number, e.g. 0803 123 4567",
  identifier: "Enter your mobile number or email address",
  code: "Enter the 6-digit code",
  enterPassword: "Enter your password",
  acceptTerms: "You must accept the terms and privacy notice",
  payRange: "Maximum pay must be at least the minimum pay",
};

let current = englishValidationMessages;

export function setValidationMessages(messages: ValidationMessages): void {
  current = messages;
}

/** Looks up a message in the active language, filling in `{n}`. */
export function vm(key: keyof ValidationMessages, n?: number | bigint): string {
  const message = current[key];
  return n === undefined ? message : message.replace("{n}", String(n));
}
