// import { pgTable, text, serial, integer, boolean, json, timestamp, pgEnum,bigint,varchar} from "drizzle-orm/pg-core";
// import { createInsertSchema } from "drizzle-zod";
// import { relations } from "drizzle-orm";
// import { z } from "zod";
// import 'dotenv/config';


// // User table with all information of collection of that user 

// export const users = pgTable(
//   "users",
//   {
//     userId: bigint("user_id", { mode: "number" }).notNull(),
//     playerId: integer("player_id").notNull(),
//     quantity: integer("quantity").notNull().default(1),
//     favFileId: varchar("fav_file_id", { length: 10000 }),
//     lastClaimed: timestamp("last_claimed", { withTimezone: false }),
//     forceSub: boolean("force_sub").default(false),
//     chosenTitle: varchar("chosen_title", { length: 255 }),
//     status: varchar("status", { length: 20 }).default("active"),
//     rank: varchar("rank", { length: 2 }),
//     favMediaType: varchar("fav_media_type", { length: 10 }),
//     tradable: boolean("tradable").default(true),
//     howgot: varchar("howgot", { length: 20 }),
//   },
//   (table) => {
//     return {
//       pk: primaryKey({ columns: [table.userId, table.playerId] }),
//     };
//   }
// );
// export const userPlayers = users;



// export const players = pgTable("players", {
//   playerId: serial("player_id").primaryKey(),
//   name: varchar("name", { length: 100 }).notNull(),
//   category: varchar("category", { length: 100 }).notNull(),
//   rarity: varchar("rarity", { length: 100 }).notNull(),
//   fileId: varchar("file_id", { length: 5000 }),
//   attack: integer("attack").default(0),
//   defense: integer("defense").default(0),
//   hp: integer("hp").default(100),
//   imageData: text("image_data"),
//   gifFileId: text("gif_file_id"),
//   price: integer("price").default(0),
//   isManager: boolean("is_manager").default(false),
//   isGk: boolean("is_gk").default(false),
//   position: varchar("position", { length: 50 }),
// });

// export const spinHistory = pgTable("spin_history", {
//   id: serial("id").primaryKey(),
//   userId: bigint("user_id", { mode: "number" }).notNull(),
//   playerId: integer("player_id").notNull(),
//   spunAt: timestamp("spun_at").defaultNow(),
// });

// // Available player positions
// export const positionEnum = pgEnum("position", [
//   "GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"
// ]);

// // Available events for players
// export const eventEnum = pgEnum("event", [
//   "ICY_MAGICIANS", "FUTURE_STARS", "ICON", "GOLD"
// ]);


// export const usersRelations = relations(users, ({ one }) => ({
//   player: one(players, {
//     fields: [users.playerId],
//     references: [players.playerId],
//   }),
// }));

// export const playersRelations = relations(players, ({ many }) => ({
//   collectedBy: many(users),
// }));


// export const insertSpinHistorySchema = createInsertSchema(spinHistory).pick({
//   userId: true,
//   playerId: true,
// });

// export const insertSpinUserSchema = createInsertSchema(users).pick({
//   userId: true,
//   playerId: true,
//   quantity: true,
// }).extend({
//   howgot: z.literal('hunt'),
//   tradable: z.literal(false),
// });


// export const spinRequestSchema = z.object({
//   type: z.enum(["position", "event", "ovr", "all"]),
// });

// export type Player = typeof players.$inferSelect;

// // export type UserPlayer = typeof userPlayers.$inferSelect;
// export type UserPlayer = typeof users.$inferSelect;

// export type InsertUserPlayer = z.infer<typeof insertUserPlayerSchema>;

// export type SpinHistory = typeof spinHistory.$inferSelect;
// export type InsertSpinHistory = z.infer<typeof insertSpinHistorySchema>;

import { pgTable, text, serial, integer, boolean, json, timestamp, pgEnum, bigint, varchar, foreignKey, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";
import 'dotenv/config';

// Available player positions
export const positionEnum = pgEnum("position", [
  "GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"
]);

// Enum for user status
export const statusEnum = pgEnum("status", ["active", "inactive", "banned"]);

// User table with all information of collection of that user
export const users = pgTable(
  "users",
  {
    userId: bigint("user_id", { mode: "number" }).notNull(),
    playerId: integer("player_id").notNull(),
    quantity: integer("quantity").notNull().default(1),
    favFileId: varchar("fav_file_id", { length: 10000 }),
    lastClaimed: timestamp("last_claimed", { withTimezone: false }),
    forceSub: boolean("force_sub").default(false),
    chosenTitle: varchar("chosen_title", { length: 255 }),
    status: statusEnum("status").default("active"),
    rank: varchar("rank", { length: 2 }),
    favMediaType: varchar("fav_media_type", { length: 10 }),
    tradable: boolean("tradable").default(true),
    howgot: varchar("howgot", { length: 20 }),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.userId, table.playerId] }),
    };
  }
);

export const userPlayers = users;

// Players table
export const players = pgTable("players", {
  playerId: serial("player_id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  rarity: varchar("rarity", { length: 100 }).notNull(),
  fileId: varchar("file_id", { length: 5000 }),
  attack: integer("attack").default(0),
  defense: integer("defense").default(0),
  hp: integer("hp").default(100),
  imageData: text("image_data"),
  gifFileId: text("gif_file_id"),
  price: integer("price").default(0),
  isManager: boolean("is_manager").default(false),
  isGk: boolean("is_gk").default(false),
  position: positionEnum.notNull(), // Correct usage of the enum here
});

// Spin History table
export const spinHistory = pgTable("spin_history", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number" }).notNull(),
  playerId: integer("player_id").notNull(),
  spunAt: timestamp("spun_at").defaultNow(),
}, (table) => {
  return {
    fk_user: foreignKey(table.userId).references(users.userId),
    fk_player: foreignKey(table.playerId).references(players.playerId),
  };
});

// Available events for players
export const eventEnum = pgEnum("event", [
  "ICY_MAGICIANS", "FUTURE_STARS", "ICON", "GOLD"
]);

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  player: one(players, {
    fields: [users.playerId],
    references: [players.playerId],
  }),
}));

export const playersRelations = relations(players, ({ many }) => ({
  collectedBy: many(users),
}));

// Insert Schemas
export const insertSpinHistorySchema = createInsertSchema(spinHistory).pick({
  userId: true,
  playerId: true,
});

export const insertSpinUserSchema = createInsertSchema(users).pick({
  userId: true,
  playerId: true,
  quantity: true,
}).extend({
  howgot: z.literal('hunt'),
  tradable: z.literal(false),
});

export const spinRequestSchema = z.object({
  type: z.enum(["position", "event", "ovr", "all"]),
});

// ** NEW SCHEMAS **

// Create Team Schema
export const createTeamSchema = z.object({
  teamName: z.string().min(3, "Team name should be at least 3 characters long"),
  managerId: z.number().int().positive("Manager ID must be a positive integer"),
  players: z.array(z.number().int().positive("Player ID must be a positive integer")),
});

// Start Match Schema
export const startMatchSchema = z.object({
  teamAId: z.number().int().positive("Team A ID must be a positive integer"),
  teamBId: z.number().int().positive("Team B ID must be a positive integer"),
  matchDate: z.date(),
  location: z.string().min(3, "Location should be at least 3 characters long"),
});

// Create Tournament Schema
export const createTournamentSchema = z.object({
  tournamentName: z.string().min(3, "Tournament name should be at least 3 characters long"),
  startDate: z.date(),
  endDate: z.date(),
  teams: z.array(z.number().int().positive("Team ID must be a positive integer")),
});

// Join Tournament Schema
export const joinTournamentSchema = z.object({
  userId: z.number().int().positive("User ID must be a positive integer"),
  tournamentId: z.number().int().positive("Tournament ID must be a positive integer"),
});

// Exported Types
export type Player = typeof players.$inferSelect;
export type UserPlayer = typeof users.$inferSelect;
export type SpinHistory = typeof spinHistory.$inferSelect;
export type InsertSpinHistory = z.infer<typeof insertSpinHistorySchema>;
export type InsertUserPlayer = z.infer<typeof insertSpinUserSchema>;

// Export types for new schemas
export type CreateTeam = z.infer<typeof createTeamSchema>;
export type StartMatch = z.infer<typeof startMatchSchema>;
export type CreateTournament = z.infer<typeof createTournamentSchema>;
export type JoinTournament = z.infer<typeof joinTournamentSchema>;
