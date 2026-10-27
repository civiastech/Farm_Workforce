import type { CurrentUser } from "@fwp/shared";
import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { employerProfiles, users, workerProfiles } from "../db/schema";
import { notFound } from "../lib/errors";

export async function getCurrentUser(db: Database, userId: string): Promise<CurrentUser> {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      fullName: users.fullName,
      phone: users.phone,
      preferredLanguage: users.preferredLanguage,
      createdAt: users.createdAt,
      workerProfile: workerProfiles.userId,
      employerProfile: employerProfiles.userId,
    })
    .from(users)
    .leftJoin(workerProfiles, eq(workerProfiles.userId, users.id))
    .leftJoin(employerProfiles, eq(employerProfiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) throw notFound("User");

  const { workerProfile, employerProfile, createdAt, ...user } = row;
  return {
    ...user,
    createdAt: createdAt.toISOString(),
    hasProfile: user.role === "admin" || (user.role === "worker" ? !!workerProfile : !!employerProfile),
  };
}
