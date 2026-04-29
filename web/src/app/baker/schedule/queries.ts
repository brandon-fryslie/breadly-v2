// Server-only data helpers for /baker/schedule. Kept out of any "use server"
// file so they can't be invoked as RPCs.

import "server-only";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { schedules, type Schedule } from "@/db/schema";

export async function listSchedules(userId: string): Promise<Schedule[]> {
  return db
    .select()
    .from(schedules)
    .where(eq(schedules.bakerId, userId))
    .orderBy(desc(schedules.active), desc(schedules.updatedAt));
}

export async function getSchedule(
  userId: string,
  id: string,
): Promise<Schedule | null> {
  const row = await db.query.schedules.findFirst({
    where: and(eq(schedules.id, id), eq(schedules.bakerId, userId)),
  });
  return row ?? null;
}
