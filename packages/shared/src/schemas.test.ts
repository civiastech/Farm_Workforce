import { describe, expect, it } from "vitest";
import { jobInputSchema, normaliseNigerianPhone, registerSchema } from "./schemas";
import { formatPay } from "./format";

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

describe("formatPay", () => {
  it("formats ranges in naira", () => {
    expect(formatPay(45000, 60000, "month")).toMatch(/45,000.*60,000.*\/ month/);
  });
});
