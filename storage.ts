// import {
//   users, type User, type InsertUser,
//   players, type Player,
//   userPlayers, type UserPlayer, type InsertUserPlayer,
//   spinHistory, type SpinHistory, type InsertSpinHistory
// } from "@shared/schema";

// import { db } from "./db";
// import { eq, and, sql as sqlQuery, desc } from "drizzle-orm";

// export interface IStorage {
//   getUser(id: number): Promise<User | undefined>;
//   getUserByTelegramId(telegramId: string): Promise<User | undefined>;
//   createUser(user: InsertUser): Promise<User>;
//   updateUser(id: number, data: Partial<User>): Promise<User | undefined>;

//   getPlayer(id: number): Promise<Player | undefined>;
//   getPlayersByIds(ids: number[]): Promise<Player[]>;
//   getPlayersByPosition(position: string): Promise<Player[]>;
//   getRandomPlayerByFilters(position: string, category: string): Promise<Player | undefined>;

//   getUserPlayers(userId: number): Promise<Player[]>;
//   addPlayerToUser(userId: number, playerId: number): Promise<UserPlayer>;

//   getSpinHistory(userId: number, limit?: number): Promise<SpinHistory[]>;
//   createSpinHistory(history: InsertSpinHistory): Promise<SpinHistory>;
// }

// export class DatabaseStorage implements IStorage {
//   // --- User ---
//   async getUser(id: number): Promise<User | undefined> {
//     const [user] = await db.select().from(users).where(eq(users.id, id));
//     return user;
//   }

//   async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
//     const [user] = await db.select().from(users).where(eq(users.telegram_id, telegramId));
//     return user;
//   }

//   async createUser(user: InsertUser): Promise<User> {
//     const [newUser] = await db.insert(users).values(user).returning();
//     return newUser;
//   }

//   async updateUser(id: number, data: Partial<User>): Promise<User | undefined> {
//     const [updatedUser] = await db.update(users).set(data).where(eq(users.id, id)).returning();
//     return updatedUser;
//   }

//   // --- Player ---
//   async getPlayer(id: number): Promise<Player | undefined> {
//     const [player] = await db.select().from(players).where(eq(players.id, id));
//     return player;
//   }

//   async getPlayersByIds(ids: number[]): Promise<Player[]> {
//     if (ids.length === 0) return [];
//     return await db.select().from(players).where(sqlQuery`${players.id} IN ${ids}`);
//   }

//   async getPlayersByPosition(position: string): Promise<Player[]> {
//     return await db.select().from(players).where(eq(players.position, position));
//   }

//   async getRandomPlayerByFilters(position: string, category: string): Promise<Player | undefined> {
//     const [player] = await db
//       .select()
//       .from(players)
//       .where(and(
//         eq(players.position, position),
//         eq(players.category, category) // `category` is your event
//       ))
//       .orderBy(sqlQuery`RANDOM()`)
//       .limit(1);

//     return player;
//   }

//   // --- User-Player Collection ---
//   async getUserPlayers(userId: number): Promise<Player[]> {
//     const userPlayerRecords = await db
//       .select()
//       .from(userPlayers)
//       .innerJoin(players, eq(userPlayers.player_id, players.id))
//       .where(eq(userPlayers.user_id, userId));

//     return userPlayerRecords.map(record => record.players);
//   }

//   async addPlayerToUser(userId: number, playerId: number): Promise<UserPlayer> {
//     const existing = await db
//       .select()
//       .from(userPlayers)
//       .where(and(eq(userPlayers.user_id, userId), eq(userPlayers.player_id, playerId)));

//     if (existing.length > 0) {
//       const [updated] = await db
//         .update(userPlayers)
//         .set({ quantity: sqlQuery`${userPlayers.quantity} + 1` })
//         .where(and(eq(userPlayers.user_id, userId), eq(userPlayers.player_id, playerId)))
//         .returning();
//       return updated;
//     } else {
//       const [inserted] = await db
//         .insert(userPlayers)
//         .values({
//           user_id: userId,
//           player_id: playerId,
//           quantity: 1,
//           howgot: "hunt",
//           tradable: false
//         })
//         .returning();
//       return inserted;
//     }
//   }

//   // --- Spin History ---
//   async getSpinHistory(userId: number, limit = 5): Promise<SpinHistory[]> {
//     return await db
//       .select()
//       .from(spinHistory)
//       .where(eq(spinHistory.user_id, userId))
//       .orderBy(desc(spinHistory.spun_at))
//       .limit(limit);
//   }

//   async createSpinHistory(history: InsertSpinHistory): Promise<SpinHistory> {
//     const [newHistory] = await db.insert(spinHistory).values(history).returning();
//     return newHistory;
//   }
// }

// export const storage = new DatabaseStorage();
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

  async getUserByTelegramId(telegramId: string) {
    return (await db.select().from(users).where(eq(users.telegram_id, telegramId)))[0];
  }

  async createUser(data: InsertUser) {
    return (await db.insert(users).values(data).returning())[0];
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
