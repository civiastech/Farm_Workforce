import type { FastifyBaseLogger } from "fastify";
import nodemailer from "nodemailer";
import type { Config } from "../config";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export function createMailer(config: Config, logger: FastifyBaseLogger): Mailer {
  if (config.MAIL_TRANSPORT === "smtp" && config.SMTP_URL) {
    const transport = nodemailer.createTransport(config.SMTP_URL);
    return {
      async send(message) {
        await transport.sendMail({ from: config.MAIL_FROM, ...message });
      },
    };
  }

  // Development transport: prints the email to the log instead of sending it.
  return {
    async send(message) {
      logger.info({ mail: message }, `[mail:log] ${message.subject} → ${message.to}`);
    },
  };
}

/** Captures messages in memory — used by tests. */
export function createMemoryMailer(): Mailer & { sent: MailMessage[] } {
  const sent: MailMessage[] = [];
  return {
    sent,
    async send(message) {
      sent.push(message);
    },
  };
}
