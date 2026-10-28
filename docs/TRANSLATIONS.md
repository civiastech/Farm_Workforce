# Translations

The interface is available in six languages: English, Naijá (Nigerian Pidgin), Hausa, Yorùbá, Igbo and French. Anyone can switch language from the globe button in the header, from the mobile menu, or from the footer. A signed-in user's choice is saved to their account, so it follows them to other devices.

> **Status:** English is the source text. French is a careful translation. **Naijá, Hausa, Yorùbá and Igbo were machine-drafted and must be reviewed by native speakers before launch.** They are understandable, but wording, tone and agricultural vocabulary need a fluent eye.

## Reviewing in a spreadsheet (recommended)

Reviewers don't need to touch code.

1. A developer runs `npm run translations:export`. It writes `translations/review-<lang>.csv` for each language (`pcm`, `ha`, `yo`, `ig`, `fr`).
2. Send the file to the reviewer. It opens in Excel or Google Sheets, with columns **key**, **english**, **current**, **corrected** and **notes**.
3. The reviewer reads the **current** column next to the English. Where it's wrong or unnatural, they type the better text in **corrected**, and can explain in **notes**. Rows that are fine stay empty.
4. Save as CSV (UTF-8) with the same file name, then run `npm run translations:import -- translations/review-yo.csv`.
5. The import applies the corrections and lists any it refused, for example a missing `{placeholder}` or tone marks in an SMS text. Then run `npx prettier --write apps && npm run check`, and commit.

Rows whose key starts with `sms.` are the text messages sent to phones. Keep them in plain letters with no tone marks (ẹ → e, ọ → o, ṣ → s, ƙ → k). Special letters switch an SMS to an encoding that fits only 70 characters instead of 160, which makes each message cost two or three times as much.

## Where the text lives

| File                           | Language                  |
| ------------------------------ | ------------------------- |
| `apps/web/src/i18n/en.ts`      | English (source of truth) |
| `apps/web/src/i18n/pcm.ts`     | Naijá (Nigerian Pidgin)   |
| `apps/web/src/i18n/ha.ts`      | Hausa                     |
| `apps/web/src/i18n/yo.ts`      | Yorùbá                    |
| `apps/web/src/i18n/ig.ts`      | Igbo                      |
| `apps/web/src/i18n/fr.ts`      | French                    |
| `apps/api/src/lib/messages.ts` | SMS texts, all languages  |

Each file is a list of `"key": "text"` lines in the same order as the English file, so a reviewer can put the two side by side.

## Rules for translators

1. **Change only the text on the right of the colon.** Never change the key on the left.
2. **Keep every `{placeholder}` exactly as written**, e.g. `{n}`, `{email}`, `{time}`. They are replaced with numbers, names or links when the page is shown. You may move a placeholder to wherever it reads naturally in your language.
3. **`{em}`** in headings marks the highlighted words (shown in italic green). The highlighted words themselves are in the matching `…Em` key.
4. Keys ending in **`.one` / `.other`** are the singular and plural forms ("1 job found" / "{n} jobs found").
5. Don't translate the brand name **Farm Workforce** or the currency sign **₦**.
6. Keep button labels short. Phones in Nigeria are often 360px wide.

## Checks

`npm test` fails if a translation is missing a key, has an extra or empty one, or has lost or renamed a `{placeholder}`. The type-checker also refuses to build if any language is missing a key.

## What is not translated

- **Content written by users**, such as job titles, descriptions and profiles, appears exactly as the author wrote it.
- **Legal pages** (privacy notice, terms) stay in English until a lawyer approves translations. Other languages show a notice saying so.
- **The moderation console** is an internal staff tool and stays in English. Status labels and dates in it still follow the chosen language.
- **Emails** (password reset, application updates) are currently sent in English.

## Adding a language

1. Add the code and the language's own name to `LANGUAGES` in `packages/shared/src/constants.ts`.
2. Run `npm run db:generate` to create the database migration for the new language value.
3. Copy `en.ts` to `<code>.ts`, translate it, and add the file to the `loaders` and `LOCALE` maps in `apps/web/src/i18n/index.tsx`.
4. Run `npm run check`.
