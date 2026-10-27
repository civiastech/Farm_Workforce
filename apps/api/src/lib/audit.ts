import type { FastifyRequest } from "fastify";
import { auditLogs } from "../db/schema";

export interface AuditEntry {
  action: string;
  actorId?: string | null;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Records a security or moderation event. Failures are logged, never thrown:
 * an audit hiccup must not break the user's request.
 */
export async function audit(request: FastifyRequest, entry: AuditEntry): Promise<void> {
  try {
    await request.server.db.insert(auditLogs).values({
      actorId: entry.actorId ?? request.user?.id ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata,
      ip: request.ip,
    });
  } catch (error) {
    request.log.error({ err: error, audit: entry }, "Failed to write audit log");
  }
}
