import { describe, expect, it } from "vitest";
import { en, type MessageKey } from "./en";
import fr from "./fr";
import ha from "./ha";
import ig from "./ig";
import pcm from "./pcm";
import yo from "./yo";

const translations = { fr, ha, ig, pcm, yo };
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe.each(Object.entries(translations))("%s translation", (_lang, messages) => {
  it("keeps every {placeholder} from English", () => {
    const broken = (Object.keys(en) as MessageKey[]).filter(
      (key) => JSON.stringify(placeholders(messages[key])) !== JSON.stringify(placeholders(en[key])),
    );
    expect(broken).toEqual([]);
  });

  it("has no empty strings", () => {
    expect(Object.entries(messages).filter(([, text]) => !text.trim())).toEqual([]);
  });

  it("has no extra keys", () => {
    expect(Object.keys(messages).filter((key) => !(key in en))).toEqual([]);
  });
});
