import { describe, expect, it } from "vitest";
import {
  codeSchema,
  identifierSchema,
  jobInputSchema,
  normaliseNigerianPhone,
  registerSchema,
} from "./schemas";
import { formatPay, formatPhone } from "./format";

describe("normaliseNigerianPhone", () => {
  it.each([
    ["08031234567", "+2348031234567"],
    ["0803 123 4567", "+2348031234567"],
    ["+234 803 123 4567", "+2348031234567"],
    ["2349031234567", "+2349031234567"],
    ["7031234567", "+2347031234567"],
  ])("normalises %s", (input, expected) => {
    expect(normaliseNigerianPhone(input)).toBe(expected);
  });

  it.each(["12345", "05031234567", "+44 7700 900123", "080312345678"])("rejects %s", (input) => {
    expect(normaliseNigerianPhone(input)).toBeNull();
  });
});

describe("registerSchema", () => {
  const valid = {
    role: "worker",
    fullName: "  Ade Okafor ",
    email: " ADE@Example.com ",
    phone: "0803 123 4567",
    password: "correct-horse-battery",
    acceptTerms: true,
    code: "123456",
  };

  it("normalises fields", () => {
    const parsed = registerSchema.parse(valid);
    expect(parsed).toMatchObject({
      fullName: "Ade Okafor",
      email: "ade@example.com",
      phone: "+2348031234567",
      preferredLanguage: "en",
    });
  });

  it("rejects admin self-registration", () => {
    expect(registerSchema.safeParse({ ...valid, role: "admin" }).success).toBe(false);
  });

  it("requires terms acceptance", () => {
    expect(registerSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false);
  });

  it("uses plain-language error messages", () => {
    const result = registerSchema.safeParse({ ...valid, fullName: "A", role: undefined });
    const messages = Object.fromEntries(result.error!.issues.map((i) => [i.path.join("."), i.message]));
    expect(messages.fullName).toBe("Use at least 2 characters");
    expect(messages.role).toBe("Choose one of the options");
    expect(messages.email).toBeUndefined();
  });

  it("rejects short passwords", () => {
    expect(registerSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
  });

  it("makes email optional (many workers only have a phone)", () => {
    const parsed = registerSchema.parse({ ...valid, email: "" });
    expect(parsed.email).toBeUndefined();
  });
});

describe("identifierSchema", () => {
  it.each([
    ["0803 123 4567", "+2348031234567"],
    [" Ade@Example.com ", "ade@example.com"],
  ])("normalises %s", (input, expected) => {
    expect(identifierSchema.parse(input)).toBe(expected);
  });

  it.each(["", "12345", "not-an-email@"])("rejects %j", (input) => {
    expect(identifierSchema.safeParse(input).success).toBe(false);
  });
});

describe("codeSchema", () => {
  it("accepts exactly six digits", () => {
    expect(codeSchema.parse(" 012345 ")).toBe("012345");
    expect(codeSchema.safeParse("12345").success).toBe(false);
    expect(codeSchema.safeParse("12345a").success).toBe(false);
  });
});

describe("jobInputSchema", () => {
  const job = {
    title: "Tractor operator",
    description: "Operate and maintain a tractor for land preparation across 40 hectares.",
    category: "machinery",
    employmentType: "full_time",
    state: "Oyo",
    town: "Ogbomoso",
    payMin: "90000",
    payMax: "130000",
    payPeriod: "month",
    positions: "2",
  };

  it("coerces numeric form values", () => {
    const parsed = jobInputSchema.parse(job);
    expect(parsed.payMin).toBe(90000);
    expect(parsed.status).toBe("open");
  });

  it("rejects inverted pay ranges", () => {
    const result = jobInputSchema.safeParse({ ...job, payMin: 200000 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["payMax"]);
  });
});

describe("formatPhone", () => {
  it("groups Nigerian numbers for reading", () => {
    expect(formatPhone("+2348031234567")).toBe("+234 803 123 4567");
  });
});

describe("formatPay", () => {
  it("formats ranges in naira", () => {
    expect(formatPay(45000, 60000, "month")).toMatch(/45,000.*60,000.*\/ month/);
  });
});
