import type { FastifyBaseLogger } from "fastify";
import type { Config } from "../config";

export interface SmsSender {
  /** Sends one SMS. `to` is E.164 (+234…). Throws if the provider rejects it. */
  send(to: string, text: string): Promise<void>;
}

const TIMEOUT_MS = 10_000;

/**
 * Rewrites text into the GSM-7 alphabet. Any character outside it (ẹ, ọ, ṣ, ƙ, “ ” …) switches
 * the whole SMS to UCS-2, which cuts a segment from 160 to 70 characters and multiplies the cost.
 */
export function toGsm7(text: string): string {
  return text
    .replace(/[ƙƘ]/g, (c) => (c === "ƙ" ? "k" : "K"))
    .replace(/[ɗƊ]/g, (c) => (c === "ɗ" ? "d" : "D"))
    .replace(/[ƴƳ]/g, (c) => (c === "ƴ" ? "y" : "Y"))
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/₦/g, "N")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e\n]/g, "");
}

async function failure(provider: string, response: Response): Promise<Error> {
  const body = (await response.text().catch(() => "")).slice(0, 300);
  return new Error(`${provider} responded ${response.status}: ${body}`);
}

function termii(config: Config): SmsSender {
  return {
    async send(to, text) {
      const response = await fetch(`${config.TERMII_BASE_URL}/api/sms/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: config.TERMII_API_KEY,
          to: to.replace(/^\+/, ""),
          from: config.SMS_SENDER_ID,
          sms: toGsm7(text),
          type: "plain",
          channel: config.TERMII_CHANNEL,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw await failure("Termii", response);
    },
  };
}

function africasTalking(config: Config): SmsSender {
  const host =
    config.AT_USERNAME === "sandbox"
      ? "https://api.sandbox.africastalking.com"
      : "https://api.africastalking.com";
  return {
    async send(to, text) {
      const form = new URLSearchParams({ username: config.AT_USERNAME!, to, message: toGsm7(text) });
      if (config.SMS_SENDER_ID) form.set("from", config.SMS_SENDER_ID);
      const response = await fetch(`${host}/version1/messaging`, {
        method: "POST",
        headers: {
          apiKey: config.AT_API_KEY!,
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: form,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw await failure("Africa's Talking", response);
      const result = (await response.json()) as {
        SMSMessageData?: { Recipients?: { status: string; statusCode: number }[] };
      };
      const recipient = result.SMSMessageData?.Recipients?.[0];
      // 100 = processed, 101 = sent, 102 = queued.
      if (!recipient || recipient.statusCode > 102) {
        throw new Error(
          `Africa's Talking did not accept the message: ${recipient?.status ?? "no recipient"}`,
        );
      }
    },
  };
}

export function createSmsSender(config: Config, logger: FastifyBaseLogger): SmsSender {
  if (config.SMS_TRANSPORT === "termii") return termii(config);
  if (config.SMS_TRANSPORT === "africastalking") return africasTalking(config);

  // Development transport: prints the SMS to the log instead of sending it.
  return {
    async send(to, text) {
      logger.info({ sms: { to, text: toGsm7(text) } }, `[sms:log] → ${to}`);
    },
  };
}

/** Captures messages in memory — used by tests. */
export function createMemorySms(): SmsSender & { sent: { to: string; text: string }[]; failNext: number } {
  const memory = {
    sent: [] as { to: string; text: string }[],
    /** Number of upcoming sends that should throw, to test retries. */
    failNext: 0,
    async send(to: string, text: string) {
      if (memory.failNext > 0) {
        memory.failNext -= 1;
        throw new Error("Simulated SMS failure");
      }
      memory.sent.push({ to, text: toGsm7(text) });
    },
  };
  return memory;
}
