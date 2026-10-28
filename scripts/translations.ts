/**
 * Spreadsheet round trip for translators, so reviewers never edit code.
 *
 *   npm run translations:export            → translations/review-<lang>.csv for every language but English
 *   npm run translations:import -- <file>  → applies the "corrected" column back into the code
 *
 * The CSV has: key, english, current, corrected, notes. Reviewers fill in "corrected" only where
 * the current text is wrong. Keys starting with "sms." are the SMS texts (written without tone
 * marks on purpose; see apps/api/src/lib/messages.ts).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { SMS_TEMPLATES } from "../apps/api/src/lib/messages";
import { en } from "../apps/web/src/i18n/en";
import fr from "../apps/web/src/i18n/fr";
import ha from "../apps/web/src/i18n/ha";
import ig from "../apps/web/src/i18n/ig";
import pcm from "../apps/web/src/i18n/pcm";
import yo from "../apps/web/src/i18n/yo";

const ROOT = resolve(import.meta.dirname, "..");
const WEB: Record<string, Record<string, string>> = { fr, ha, ig, pcm, yo };
const LANGUAGES = Object.keys(WEB);
const COLUMNS = ["key", "english", "current", "corrected", "notes"];

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1])
    .sort()
    .join(",");

// ---------------------------------------------------------------- CSV

function toCsv(rows: string[][]): string {
  const cell = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  // The byte-order mark makes Excel open the file as UTF-8, so ẹ, ọ, ṣ and ƙ survive.
  return `\uFEFF${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === "," || c === ";") {
      // Some spreadsheet locales save with semicolons.
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((value) => value.trim() !== ""));
}

// ---------------------------------------------------------------- Export

function exportAll() {
  mkdirSync(resolve(ROOT, "translations"), { recursive: true });
  for (const lang of LANGUAGES) {
    const rows = [COLUMNS];
    for (const [key, english] of Object.entries(en)) rows.push([key, english, WEB[lang]![key] ?? "", "", ""]);
    const sms = SMS_TEMPLATES[lang as keyof typeof SMS_TEMPLATES];
    for (const [key, english] of Object.entries(SMS_TEMPLATES.en)) {
      rows.push([`sms.${key}`, english, sms[key as keyof typeof sms], "", ""]);
    }
    const file = resolve(ROOT, "translations", `review-${lang}.csv`);
    writeFileSync(file, toCsv(rows));
    console.log(`Wrote ${file} (${rows.length - 1} texts)`);
  }
}

// ---------------------------------------------------------------- Import

/** Replaces one `"key": "value",` entry in a web dictionary file. */
function replaceWebEntry(source: string, key: string, value: string): string {
  const pattern = new RegExp(`^(  "${key.replace(/\./g, "\\.")}":)\\s*"(?:[^"\\\\]|\\\\.)*",$`, "m");
  if (!pattern.test(source)) throw new Error(`key ${key} not found`);
  return source.replace(pattern, (_m, start: string) => `${start} ${JSON.stringify(value)},`);
}

/** Replaces one template inside the `lang: { … }` block of messages.ts. */
function replaceSmsEntry(source: string, lang: string, key: string, value: string): string {
  const blockStart = source.indexOf(`\n  ${lang}: {`);
  const blockEnd = source.indexOf("\n  },", blockStart);
  if (blockStart < 0 || blockEnd < 0) throw new Error(`SMS block for ${lang} not found`);
  const block = source.slice(blockStart, blockEnd);
  const pattern = new RegExp(`(\\n    ${key}:\\s*)(["'])(?:\\\\.|(?!\\2).)*\\2`);
  if (!pattern.test(block)) throw new Error(`SMS text ${key} not found`);
  const updated = block.replace(pattern, (_m, start: string) => `${start}${JSON.stringify(value)}`);
  return source.slice(0, blockStart) + updated + source.slice(blockEnd);
}

function importFile(file: string) {
  const lang = /review-(\w+)\.csv$/.exec(basename(file))?.[1];
  if (!lang || !LANGUAGES.includes(lang)) {
    throw new Error(`Name the file review-<lang>.csv, where <lang> is one of: ${LANGUAGES.join(", ")}`);
  }
  const [header, ...rows] = parseCsv(readFileSync(file, "utf8"));
  const col = (name: string) => header!.findIndex((h) => h.trim().toLowerCase() === name);
  const [keyCol, correctedCol] = [col("key"), col("corrected")];
  if (keyCol < 0 || correctedCol < 0) throw new Error('The sheet needs "key" and "corrected" columns');

  const webPath = resolve(ROOT, "apps/web/src/i18n", `${lang}.ts`);
  const smsPath = resolve(ROOT, "apps/api/src/lib/messages.ts");
  let web = readFileSync(webPath, "utf8");
  let sms = readFileSync(smsPath, "utf8");
  const problems: string[] = [];
  let applied = 0;

  for (const row of rows) {
    const key = row[keyCol]?.trim() ?? "";
    const corrected = row[correctedCol]?.trim() ?? "";
    if (!key || !corrected) continue;

    const isSms = key.startsWith("sms.");
    const smsKey = key.slice(4) as keyof (typeof SMS_TEMPLATES)["en"];
    const english = isSms ? SMS_TEMPLATES.en[smsKey] : (en as Record<string, string>)[key];
    if (english === undefined) {
      problems.push(`${key}: unknown key (was it renamed?)`);
      continue;
    }
    if (placeholders(corrected) !== placeholders(english)) {
      problems.push(`${key}: must keep exactly these placeholders: ${placeholders(english) || "(none)"}`);
      continue;
    }
    if (isSms && /[^\x20-\x7e]/.test(corrected)) {
      problems.push(`${key}: SMS text must use plain letters only (no tone marks or special characters)`);
      continue;
    }
    try {
      if (isSms) sms = replaceSmsEntry(sms, lang, smsKey, corrected);
      else web = replaceWebEntry(web, key, corrected);
      applied++;
    } catch (error) {
      problems.push(`${key}: ${(error as Error).message}`);
    }
  }

  writeFileSync(webPath, web);
  writeFileSync(smsPath, sms);
  console.log(`Applied ${applied} correction${applied === 1 ? "" : "s"} for ${lang}.`);
  if (problems.length) {
    console.log(`\nNot applied (fix these in the sheet and import again):\n  ${problems.join("\n  ")}`);
    process.exitCode = 1;
  }
  console.log("\nNext: npx prettier --write apps && npm run check");
}

const [command, file] = process.argv.slice(2);
if (command === "export") exportAll();
else if (command === "import" && file) importFile(resolve(file));
else {
  console.error("Usage: translations export | translations import <review-xx.csv>");
  process.exitCode = 1;
}
