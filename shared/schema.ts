import { pgTable, text, serial, integer, boolean, json, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import 'dotenv/config';


// User table with Telegram information
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  telegram_id: text("telegram_id").unique(),
  telegram_username: text("telegram_username"),
  coins: integer("coins").default(0).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Available player positions
export const positionEnum = pgEnum("position", [
  "GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"
]);

// Available events for players
export const eventEnum = pgEnum("event", [
  "TOTS", "TOTY", "ICY_MAGICIANS", "FUTURE_STARS", "ICONS", "HEROES"
]);

// Player schema
export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  position: positionEnum("position").notNull(),
  event: eventEnum("event").notNull(),
  overall: integer("overall").notNull(),
  pace: integer("pace").notNull(),
  shooting: integer("shooting").notNull(),
  passing: integer("passing").notNull(),
  dribbling: integer("dribbling").notNull(),
  defense: integer("defense").notNull(),
  physical: integer("physical").notNull(),
  image_url: text("image_url"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// User-player collection relationship
export const userPlayers = pgTable("user_players", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  player_id: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  acquired_at: timestamp("acquired_at").defaultNow().notNull(),
});

// Formation schema for team building
export const formationEnum = pgEnum("formation", [
  "4-3-3", "4-4-2", "3-5-2", "4-2-3-1", "5-3-2", "4-1-2-1-2" 
]);

// Play style schema for team building
export const playStyleEnum = pgEnum("play_style", [
  "TIKI_TAKA", "COUNTER_ATTACK", "TOTAL_FOOTBALL", "HIGH_PRESS"
]);

// Tournament status enum
export const tournamentStatusEnum = pgEnum("tournament_status", [
  "REGISTRATION", "IN_PROGRESS", "COMPLETED"
]);

// Tournaments table
export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  prize_coins: integer("prize_coins").default(5000).notNull(),
  max_participants: integer("max_participants").default(16).notNull(),
  current_participants: integer("current_participants").default(0).notNull(),
  status: tournamentStatusEnum("status").default("REGISTRATION").notNull(),
  bracket: json("bracket"),
  winner_id: integer("winner_id").references(() => users.id, { onDelete: "set null" }),
  created_at: timestamp("created_at").defaultNow().notNull(),
  starts_at: timestamp("starts_at"),
  ends_at: timestamp("ends_at"),
});

// Teams schema for user's created teams
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  formation: formationEnum("formation").notNull(),
  play_style: playStyleEnum("play_style").notNull(),
  players: json("players").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Tournament participants table
export const tournamentParticipants = pgTable("tournament_participants", {
  id: serial("id").primaryKey(),
  tournament_id: integer("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  user_id: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  team_id: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  eliminated: boolean("eliminated").default(false).notNull(),
  position: integer("position"),
  joined_at: timestamp("joined_at").defaultNow().notNull(),
});

// Match results schema
export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  team_id: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  opponent_team: json("opponent_team").notNull(),
  user_score: integer("user_score").notNull(),
  opponent_score: integer("opponent_score").notNull(),
  possession: integer("possession").notNull(),
  shots: integer("shots").notNull(),
  shots_on_target: integer("shots_on_target").notNull(),
  corners: integer("corners").notNull(),
  commentary: json("commentary").notNull(),
  tournament_id: integer("tournament_id").references(() => tournaments.id, { onDelete: "set null" }),
  tournament_round: integer("tournament_round"),
  played_at: timestamp("played_at").defaultNow().notNull(),
});

// Recent spins history
export const spinHistory = pgTable("spin_history", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  player_id: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  position_result: positionEnum("position_result").notNull(),
  event_result: eventEnum("event_result").notNull(),
  ovr_result: text("ovr_result").notNull(),
  spun_at: timestamp("spun_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  telegram_id: true,
  telegram_username: true,
  coins: true,
});

export const insertPlayerSchema = createInsertSchema(players).pick({
  name: true,
  position: true,
  event: true,
  overall: true,
  pace: true,
  shooting: true,
  passing: true,
  dribbling: true,
  defense: true,
  physical: true,
  image_url: true,
});

export const insertUserPlayerSchema = createInsertSchema(userPlayers).pick({
  user_id: true,
  player_id: true,
});

export const insertTeamSchema = createInsertSchema(teams).pick({
  user_id: true,
  name: true,
  formation: true,
  play_style: true,
  players: true,
});

export const insertMatchSchema = createInsertSchema(matches).pick({
  user_id: true,
  team_id: true,
  opponent_team: true,
  user_score: true,
  opponent_score: true,
  possession: true,
  shots: true,
  shots_on_target: true,
  corners: true,
  commentary: true,
  tournament_id: true,
  tournament_round: true,
});

export const insertSpinHistorySchema = createInsertSchema(spinHistory).pick({
  user_id: true,
  player_id: true,
  position_result: true,
  event_result: true,
  ovr_result: true,
});

// Types for typescript
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Player = typeof players.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;

export type UserPlayer = typeof userPlayers.$inferSelect;
export type InsertUserPlayer = z.infer<typeof insertUserPlayerSchema>;

export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

export type Match = typeof matches.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;

export type SpinHistory = typeof spinHistory.$inferSelect;
export type InsertSpinHistory = z.infer<typeof insertSpinHistorySchema>;

// Insert schemas for tournaments
export const insertTournamentSchema = createInsertSchema(tournaments).pick({
  name: true,
  description: true,
  prize_coins: true,
  max_participants: true,
  status: true,
  starts_at: true,
  ends_at: true,
});

export const insertTournamentParticipantSchema = createInsertSchema(tournamentParticipants).pick({
  tournament_id: true,
  user_id: true,
  team_id: true,
});

// Types for tournaments
export type Tournament = typeof tournaments.$inferSelect;
export type InsertTournament = z.infer<typeof insertTournamentSchema>;

export type TournamentParticipant = typeof tournamentParticipants.$inferSelect;
export type InsertTournamentParticipant = z.infer<typeof insertTournamentParticipantSchema>;

// Validation schemas for API requests
export const telegramAuthSchema = z.object({
  code: z.string().min(6).max(10),
});

export const spinRequestSchema = z.object({
  type: z.enum(["position", "event", "ovr", "all"]),
});

export const createTeamSchema = z.object({
  name: z.string().min(3).max(30),
  formation: z.enum(["4-3-3", "4-4-2", "3-5-2", "4-2-3-1", "5-3-2", "4-1-2-1-2"]),
  playStyle: z.enum(["TIKI_TAKA", "COUNTER_ATTACK", "TOTAL_FOOTBALL", "HIGH_PRESS"]),
  players: z.array(z.number()),
});

export const startMatchSchema = z.object({
  teamId: z.number(),
});

export const createTournamentSchema = z.object({
  name: z.string().min(3).max(50),
  description: z.string().optional(),
  prize_coins: z.number().min(500).default(5000),
  max_participants: z.number().min(4).max(32).default(16),
  starts_at: z.string().optional(), // ISO date string
  ends_at: z.string().optional(), // ISO date string
});

export const joinTournamentSchema = z.object({
  tournamentId: z.number(),
  teamId: z.number(),
});
