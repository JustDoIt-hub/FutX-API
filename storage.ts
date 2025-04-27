import {
  users, type User, type InsertUser,
  players, type Player,
  userPlayers, type UserPlayer, type InsertUserPlayer,
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
    return (await db.select().from(users).where(eq(users.id, id)))[0];
  }

  async getUserByTelegramId(telegramId: string | number) {
  return (await db.select().from(users).where(eq(users.telegram_id, String(telegramId))))[0];
}


  async createUser(data: InsertUser) {
  return (await db.insert(users).values({
    telegram_id: data.telegramId,          // map camelCase to snake_case
    telegram_username: data.telegramUsername,
    coins: data.coins,
  }).returning())[0];
}


  async updateUser(id: number, data: Partial<User>) {
    return (await db.update(users).set(data).where(eq(users.id, id)).returning())[0];
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
        rating: players.rating,
        imageUrl: players.image_url,
      })
      .from(userPlayers)
      .innerJoin(players, eq(userPlayers.player_id, players.id))
      .where(eq(userPlayers.user_id, userId));
  }

  async addPlayerToUser(params: AddPlayerToUserParams) {
    const {
      userId,
      playerId,
      quantity = 1,
      howgot = "hunt",
      tradable = false
    } = params;

    const existing = await db
      .select()
      .from(userPlayers)
      .where(and(
        eq(userPlayers.user_id, userId),
        eq(userPlayers.player_id, playerId)
      ));

    if (existing.length > 0) {
      return (await db
        .update(userPlayers)
        .set({
          quantity: sql`${userPlayers.quantity} + ${quantity}`
        })
        .where(and(
          eq(userPlayers.user_id, userId),
          eq(userPlayers.player_id, playerId)
        ))
        .returning())[0];
    } else {
      return (await db
        .insert(userPlayers)
        .values({
          user_id: userId,
          player_id: playerId,
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
      .where(eq(spinHistory.user_id, userId))
      .orderBy(desc(spinHistory.spun_at))
      .limit(limit);
  }

  async createSpinHistory(data: InsertSpinHistory) {
    return (await db.insert(spinHistory).values(data).returning())[0];
  }
}

// Export instance
export const storage = new DatabaseStorage();
