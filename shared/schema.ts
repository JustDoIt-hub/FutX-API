import {
  pgTable, text, serial, integer, boolean, timestamp, varchar,
  primaryKey, pgEnum, bigint, check
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

// Enums
export const positionEnum = pgEnum("position", [
  "GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"
]);

export const eventEnum = pgEnum("event", [
  "ICY_MAGICIANS", "FUTURE_STARS", "ICON", "GOLD"
]);

export const howgotEnum = pgEnum("howgot", [
  "hunt", "pack opening", "gift"
]);

// Users table
export const users = pgTable("users", {
  userId: bigint("user_id", { mode: "number" }).notNull(),
  playerId: integer("player_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  favFileId: varchar("fav_file_id", { length: 10000 }),
  lastClaimed: timestamp("last_claimed"),
  forceSub: boolean("force_sub").default(false),
  chosenTitle: varchar("chosen_title", { length: 255 }),
  status: varchar("status", { length: 20 }).default('active'),
  rank: varchar("rank", { length: 2 }),
  favMediaType: varchar("fav_media_type", { length: 10 }),
  tradable: boolean("tradable").default(true),
  howgot: varchar("howgot", { length: 20 }),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.playerId] }),
  quantityNonNegative: check("quantity_non_negative", sql`quantity >= 0`),
}));

// Players table
export const players = pgTable("players", {
  id: serial("player_id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  event: eventEnum("event").notNull(),
  rarity: varchar("rarity", { length: 100 }).notNull(),
  position: positionEnum("position").notNull(),
  fileId: varchar("file_id", { length: 5000 }),
  attack: integer("attack").default(0),
  defense: integer("defense").default(0),
  hp: integer("hp").default(100),
  imageData: text("image_data"),
  gifFileId: text("gif_file_id"),
  price: integer("price").default(0),
  isManager: boolean("is_manager").default(false),
  isGk: boolean("is_gk").default(false),
});

// Spin History
export const spinHistory = pgTable("spin_history", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number" }).notNull(),
  playerId: integer("player_id").notNull(),
  spunAt: timestamp("spun_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  player: one(players, {
    fields: [users.playerId],
    references: [players.id],
  }),
  spins: many(spinHistory),
}));

export const playersRelations = relations(players, ({ many }) => ({
  collectedBy: many(users),
  spunInHistory: many(spinHistory),
}));

export const spinHistoryRelations = relations(spinHistory, ({ one }) => ({
  user: one(users, {
    fields: [spinHistory.userId],
    references: [users.userId],
  }),
  player: one(players, {
    fields: [spinHistory.playerId],
    references: [players.id],
  }),
}));

// Insert Schemas
export const insertSpinHistorySchema = createInsertSchema(spinHistory).pick({
  userId: true,
  playerId: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  userId: true,
  playerId: true,
  quantity: true,
}).extend({
  howgot: z.enum(["hunt", "pack opening", "gift"]).optional(),
  tradable: z.boolean().optional(),
});

// Exported Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Player = typeof players.$inferSelect;
export type InsertPlayer = typeof players.$inferInsert;
export type SpinHistory = typeof spinHistory.$inferSelect;
export type InsertSpinHistory = z.infer<typeof insertSpinHistorySchema>;

// Additional Zod Schemas
export const spinRequestSchema = z.object({
  type: z.enum(['position', 'event', 'ovr', 'all']),
});

export const createTeamSchema = z.object({
  teamName: z.string().min(1, 'Team name cannot be empty'),
  players: z.array(z.number()).min(1, 'At least one player must be selected'),
});

export const startMatchSchema = z.object({
  teamId: z.number(),
  opponentId: z.number(),
});


export const createTournamentSchema = z.object({
  name: z.string().min(1, 'Tournament name cannot be empty'),
  maxPlayers: z.number().min(2, 'Tournament must allow at least 2 players'),
});

export const joinTournamentSchema = z.object({
  tournamentId: z.number(),
});

// Telegram Authentication Schema
export const telegramAuthSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().url().optional(),
  auth_date: z.number(),
  hash: z.string(),
});
