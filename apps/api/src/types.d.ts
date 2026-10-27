import type { Role } from "@fwp/shared";
import type { Config } from "./config";
import type { Database } from "./db/client";
import type { Mailer } from "./lib/mailer";

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  fullName: string;
  sessionId: string;
}

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
    config: Config;
    mailer: Mailer;
  }
  interface FastifyRequest {
    user: SessionUser | null;
  }
}
