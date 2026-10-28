import type { Role } from "@fwp/shared";
import type { Config } from "./config";
import type { Database } from "./db/client";
import type { Mailer } from "./lib/mailer";
import type { Outbox } from "./lib/outbox";
import type { SmsSender } from "./lib/sms";

export interface SessionUser {
  id: string;
  email: string | null;
  role: Role;
  fullName: string;
  sessionId: string;
}

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
    config: Config;
    mailer: Mailer;
    sms: SmsSender;
    outbox: Outbox;
  }
  interface FastifyRequest {
    user: SessionUser | null;
  }
}
