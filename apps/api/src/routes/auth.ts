import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@fwp/shared";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { passwordResetTokens, sessions, users } from "../db/schema";
import { audit } from "../lib/audit";
import { AppError, badRequest, conflict, unauthorized } from "../lib/errors";
import { dummyPasswordHash, hashPassword, needsRehash, verifyPassword } from "../lib/password";
import { generateToken, hashToken } from "../lib/tokens";
import { parse } from "../lib/validation";
import { endSession, requireUser, startSession } from "../plugins/auth";
import { getCurrentUser } from "../services/users";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export const authRoutes: FastifyPluginAsync = async (app) => {
  const strictLimit = {
    config: { rateLimit: { max: app.config.AUTH_RATE_LIMIT_PER_MINUTE, timeWindow: "1 minute" } },
  };

  app.post("/auth/register", strictLimit, async (request, reply) => {
    const input = parse(registerSchema, request.body);

    const [existing] = await app.db.select({ id: users.id }).from(users).where(eq(users.email, input.email));
    if (existing) throw conflict("An account with this email already exists. Try signing in instead.");

    const [user] = await app.db
      .insert(users)
      .values({
        email: input.email,
        passwordHash: await hashPassword(input.password),
        role: input.role,
        fullName: input.fullName,
        phone: input.phone,
        preferredLanguage: input.preferredLanguage,
        termsAcceptedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning({ id: users.id });
    if (!user) throw conflict("An account with this email already exists. Try signing in instead.");

    await startSession(request, reply, user.id);
    await audit(request, {
      action: "auth.register",
      actorId: user.id,
      entityType: "user",
      entityId: user.id,
    });
    return reply.status(201).send({ user: await getCurrentUser(app.db, user.id) });
  });

  app.post("/auth/login", strictLimit, async (request, reply) => {
    const input = parse(loginSchema, request.body);
    const [user] = await app.db.select().from(users).where(eq(users.email, input.email)).limit(1);

    // Always run a hash comparison so response time doesn't reveal whether the email exists.
    const valid = await verifyPassword(input.password, user?.passwordHash ?? (await dummyPasswordHash));
    if (!user || !valid) {
      await audit(request, {
        action: "auth.login_failed",
        actorId: user?.id ?? null,
        metadata: { email: input.email },
      });
      throw unauthorized("Incorrect email or password");
    }
    if (user.disabledAt) {
      throw new AppError(403, "account_disabled", "This account has been disabled. Please contact support.");
    }

    await app.db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        ...(needsRehash(user.passwordHash) ? { passwordHash: await hashPassword(input.password) } : {}),
      })
      .where(eq(users.id, user.id));

    await startSession(request, reply, user.id);
    await audit(request, { action: "auth.login", actorId: user.id });
    return { user: await getCurrentUser(app.db, user.id) };
  });

  app.post("/auth/logout", async (request, reply) => {
    await endSession(request, reply);
    return reply.status(204).send();
  });

  app.get("/auth/me", async (request) => {
    if (!request.user) return { user: null };
    return { user: await getCurrentUser(app.db, request.user.id) };
  });

  app.post("/auth/password/forgot", strictLimit, async (request, reply) => {
    const { email } = parse(forgotPasswordSchema, request.body);
    const [user] = await app.db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.disabledAt)))
      .limit(1);

    // Same response whether or not the account exists, to avoid revealing registered emails.
    if (user) {
      const token = generateToken();
      await app.db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
      await app.db.insert(passwordResetTokens).values({
        id: hashToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      });
      const link = `${app.config.APP_ORIGIN}/reset-password?token=${encodeURIComponent(token)}`;
      try {
        await app.mailer.send({
          to: email,
          subject: "Reset your Farm Workforce password",
          text: [
            `Hello ${user.fullName},`,
            "",
            "We received a request to reset your password. Use the link below within 1 hour:",
            link,
            "",
            "If you did not ask for this, you can ignore this email — your password will not change.",
          ].join("\n"),
        });
      } catch (error) {
        request.log.error({ err: error }, "Failed to send password reset email");
      }
      await audit(request, { action: "auth.password_reset_requested", actorId: user.id });
    }
    return reply.status(202).send({ ok: true });
  });

  app.post("/auth/password/reset", strictLimit, async (request, reply) => {
    const input = parse(resetPasswordSchema, request.body);
    const tokenId = hashToken(input.token);

    const userId = await app.db.transaction(async (tx) => {
      const [token] = await tx
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(passwordResetTokens.id, tokenId),
            isNull(passwordResetTokens.usedAt),
            gt(passwordResetTokens.expiresAt, new Date()),
          ),
        )
        .returning({ userId: passwordResetTokens.userId });
      if (!token) throw badRequest("This reset link is invalid or has expired. Please request a new one.");

      await tx
        .update(users)
        .set({ passwordHash: await hashPassword(input.password) })
        .where(eq(users.id, token.userId));
      // Sign out everywhere: whoever had access before the reset no longer does.
      await tx.delete(sessions).where(eq(sessions.userId, token.userId));
      return token.userId;
    });

    await audit(request, { action: "auth.password_reset", actorId: userId });
    return reply.status(204).send();
  });

  app.post("/auth/password/change", strictLimit, async (request, reply) => {
    const sessionUser = requireUser(request);
    const input = parse(changePasswordSchema, request.body);

    const [user] = await app.db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, sessionUser.id));
    if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw badRequest("Your current password is incorrect", { currentPassword: "Incorrect password" });
    }

    await app.db
      .update(users)
      .set({ passwordHash: await hashPassword(input.newPassword) })
      .where(eq(users.id, sessionUser.id));
    await app.db
      .delete(sessions)
      .where(and(eq(sessions.userId, sessionUser.id), ne(sessions.id, sessionUser.sessionId)));

    await audit(request, { action: "auth.password_changed" });
    return reply.status(204).send();
  });
};
