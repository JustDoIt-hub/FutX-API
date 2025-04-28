// storage.ts
import {
  users, type User, type InsertUser,
  players, type Player,
  spinHistory, type SpinHistory, type InsertSpinHistory
} from "@shared/schema";

import { db } from "./db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

interface AddPlayerToUserParams {
  userId: number;
  playerId: number;
  quantity?: number;
  howgot?: string;
  tradable?: boolean;
}

export class DatabaseStorage {
  // --- Users ---
  async getUser(id: number) {
    return (await db.select().from(users).where(eq(users.userId, id)))[0];
  }

  async getUserByTelegramId(telegramId: number) {
    // Assuming you have a telegram_id field; adjust if needed
    return (await db.select().from(users).where(eq(users.userId, telegramId)))[0];
  }

  async createUser(data: { telegram_id: number; telegram_username: string; coins: number; }) {
  console.log("[DEBUG] About to insert user with data:", data);
  return (await db.insert(users).values({
    // Don't insert userId manually
    playerId: 1, // starter player if needed
    quantity: 1,
    ...data,
  }).returning())[0];
}


  async updateUser(id: number, data: Partial<User>) {
    return (await db.update(users).set(data).where(eq(users.userId, id)).returning())[0];
  }

  // --- Players ---
  async getPlayer(id: number) {
    return (await db.select().from(players).where(eq(players.id, id)))[0];
  }

  async getPlayersByIds(ids: number[]) {
    if (ids.length === 0) return [];
    return await db.select().from(players).where(inArray(players.id, ids));
  }

  async getPlayersByPosition(position: string) {
    return await db.select().from(players).where(eq(players.position, position));
  }

  async getRandomPlayerByFilters(position: string, event: string) {
    return (await db
      .select()
      .from(players)
      .where(and(
        eq(players.position, position),
        eq(players.event, event)
      ))
      .orderBy(sql`RANDOM()`)
      .limit(1))[0];
  }

  // --- User-Player Collection ---
  async getUserPlayers(userId: number) {
    return await db
      .select({
        id: players.id,
        name: players.name,
        position: players.position,
        event: players.event,
        attack: players.attack,
        defense: players.defense,
        hp: players.hp,
        fileId: players.fileId,
      })
      .from(users)
      .innerJoin(players, eq(users.playerId, players.id))
      .where(eq(users.userId, userId));
  }

  async addPlayerToUser(params: AddPlayerToUserParams) {
    const {
      userId,
      playerId,
      quantity = 1,
      howgot = "hunt",
      tradable = true
    } = params;

    const existing = await db
      .select()
      .from(users)
      .where(and(
        eq(users.userId, userId),
        eq(users.playerId, playerId)
      ));

    if (existing.length > 0) {
      return (await db
        .update(users)
        .set({
          quantity: sql`${users.quantity} + ${quantity}`
        })
        .where(and(
          eq(users.userId, userId),
          eq(users.playerId, playerId)
        ))
        .returning())[0];
    } else {
      return (await db
        .insert(users)
        .values({
          userId: userId,
          playerId: playerId,
          quantity,
          howgot,
          tradable
        })
        .returning())[0];
    }
  }

  // --- Spin History ---
  async getSpinHistory(userId: number, limit = 5) {
    return await db
      .select()
      .from(spinHistory)
      .where(eq(spinHistory.userId, userId))
      .orderBy(desc(spinHistory.spunAt))
      .limit(limit);
  }

  async createSpinHistory(data: InsertSpinHistory) {
    return (await db.insert(spinHistory).values(data).returning())[0];
  }
}

export const storage = new DatabaseStorage();
