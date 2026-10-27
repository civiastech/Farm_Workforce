import { describe, expect, it } from "vitest";
import { toQuery } from "./api";
import { readForm } from "./forms";

describe("readForm", () => {
  it("reads text, selects, checkboxes and checked radios", () => {
    document.body.innerHTML = `
      <form>
        <input name="fullName" value="Ade" />
        <select name="state"><option value="Oyo" selected>Oyo</option></select>
        <input type="checkbox" name="acceptTerms" checked />
        <input type="checkbox" name="mealsProvided" />
        <input type="radio" name="role" value="worker" />
        <input type="radio" name="role" value="employer" checked />
        <input name="ignored" disabled value="x" />
      </form>`;
    expect(readForm(document.querySelector("form")!)).toEqual({
      fullName: "Ade",
      state: "Oyo",
      acceptTerms: true,
      mealsProvided: false,
      role: "employer",
    });
  });
});

describe("toQuery", () => {
  it("skips empty values", () => {
    expect(toQuery({ q: "tractor", state: "", page: 2, category: undefined })).toBe("?q=tractor&page=2");
    expect(toQuery({ q: "" })).toBe("");
  });
});
