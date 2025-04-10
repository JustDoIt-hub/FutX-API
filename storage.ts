import { 
  users, type User, type InsertUser,
  players, type Player, type InsertPlayer,
  userPlayers, type UserPlayer, type InsertUserPlayer,
  teams, type Team, type InsertTeam,
  matches, type Match, type InsertMatch,
  spinHistory, type SpinHistory, type InsertSpinHistory,
  tournaments, type Tournament, type InsertTournament,
  tournamentParticipants, type TournamentParticipant, type InsertTournamentParticipant,
  positionEnum, eventEnum, formationEnum, playStyleEnum, tournamentStatusEnum
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql as sqlQuery } from "drizzle-orm";

// Define the storage interface
export interface IStorage {
  // User related functions
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User | undefined>;
  
  // Player related functions
  getPlayer(id: number): Promise<Player | undefined>;
  getPlayersByIds(ids: number[]): Promise<Player[]>;
  getPlayersByPosition(position: string): Promise<Player[]>;
  getPlayersByEvent(event: string): Promise<Player[]>;
  getPlayersByOverallRange(min: number, max: number): Promise<Player[]>;
  getRandomPlayerByFilters(position: string, event: string, overallRange: string): Promise<Player | undefined>;
  
  // User-Player related functions
  getUserPlayers(userId: number): Promise<Player[]>;
  addPlayerToUser(userId: number, playerId: number): Promise<UserPlayer>;
  
  // Team related functions
  getTeam(id: number): Promise<Team | undefined>;
  getUserTeams(userId: number): Promise<Team[]>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: number, data: Partial<Team>): Promise<Team | undefined>;
  
  // Match related functions
  getMatch(id: number): Promise<Match | undefined>;
  getUserMatches(userId: number): Promise<Match[]>;
  createMatch(match: InsertMatch): Promise<Match>;
  getTournamentMatches(tournamentId: number): Promise<Match[]>;
  
  // Spin history related functions
  getSpinHistory(userId: number, limit?: number): Promise<SpinHistory[]>;
  createSpinHistory(spinHistory: InsertSpinHistory): Promise<SpinHistory>;
  
  // Tournament related functions
  getTournament(id: number): Promise<Tournament | undefined>;
  getTournaments(status?: string): Promise<Tournament[]>;
  createTournament(tournament: InsertTournament): Promise<Tournament>;
  updateTournament(id: number, data: Partial<Tournament>): Promise<Tournament | undefined>;
  
  // Tournament participant related functions
  getTournamentParticipants(tournamentId: number): Promise<TournamentParticipant[]>;
  getUserTournamentParticipations(userId: number): Promise<TournamentParticipant[]>;
  addParticipantToTournament(participant: InsertTournamentParticipant): Promise<TournamentParticipant>;
  updateTournamentParticipant(id: number, data: Partial<TournamentParticipant>): Promise<TournamentParticipant | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User related functions
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.telegram_id, telegramId));
    return user;
  }
  
  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }
  
  async updateUser(id: number, data: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }
  
  // Player related functions
  async getPlayer(id: number): Promise<Player | undefined> {
    const [player] = await db.select().from(players).where(eq(players.id, id));
    return player;
  }
  
  async getPlayersByIds(ids: number[]): Promise<Player[]> {
    if (ids.length === 0) return [];
    return await db.select().from(players).where(sqlQuery`${players.id} IN ${ids}`);
  }
  
  async getPlayersByPosition(position: string): Promise<Player[]> {
    return await db.select().from(players).where(eq(players.position, position));
  }
  
  async getPlayersByEvent(event: string): Promise<Player[]> {
    return await db.select().from(players).where(eq(players.event, event));
  }
  
  async getPlayersByOverallRange(min: number, max: number): Promise<Player[]> {
    return await db
      .select()
      .from(players)
      .where(
        and(
          sqlQuery`${players.overall} >= ${min}`,
          sqlQuery`${players.overall} <= ${max}`
        )
      );
  }
  
  async getRandomPlayerByFilters(position: string, event: string, overallRange: string): Promise<Player | undefined> {
    let minRange = 1;
    let maxRange = 99;
    
    if (overallRange.includes("-")) {
      const [min, max] = overallRange.split("-");
      minRange = parseInt(min);
      maxRange = parseInt(max);
    } else if (overallRange.includes("+")) {
      minRange = parseInt(overallRange.replace("+", ""));
    }
    
    const [player] = await db
      .select()
      .from(players)
      .where(
        and(
          eq(players.position, position),
          eq(players.event, event),
          sqlQuery`${players.overall} >= ${minRange}`,
          sqlQuery`${players.overall} <= ${maxRange}`
        )
      )
      .orderBy(sqlQuery`RANDOM()`)
      .limit(1);
    
    return player;
  }
  
  // User-Player related functions
  async getUserPlayers(userId: number): Promise<Player[]> {
    const userPlayerRecords = await db
      .select()
      .from(userPlayers)
      .innerJoin(players, eq(userPlayers.player_id, players.id))
      .where(eq(userPlayers.user_id, userId));
    
    return userPlayerRecords.map(record => record.players);
  }
  
  async addPlayerToUser(userId: number, playerId: number): Promise<UserPlayer> {
    const [userPlayer] = await db
      .insert(userPlayers)
      .values({ user_id: userId, player_id: playerId })
      .returning();
    
    return userPlayer;
  }
  
  // Team related functions
  async getTeam(id: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }
  
  async getUserTeams(userId: number): Promise<Team[]> {
    return await db.select().from(teams).where(eq(teams.user_id, userId));
  }
  
  async createTeam(team: InsertTeam): Promise<Team> {
    const [newTeam] = await db.insert(teams).values(team).returning();
    return newTeam;
  }
  
  async updateTeam(id: number, data: Partial<Team>): Promise<Team | undefined> {
    const [updatedTeam] = await db
      .update(teams)
      .set(data)
      .where(eq(teams.id, id))
      .returning();
    return updatedTeam;
  }
  
  // Match related functions
  async getMatch(id: number): Promise<Match | undefined> {
    const [match] = await db.select().from(matches).where(eq(matches.id, id));
    return match;
  }
  
  async getUserMatches(userId: number): Promise<Match[]> {
    return await db
      .select()
      .from(matches)
      .where(eq(matches.user_id, userId))
      .orderBy(desc(matches.played_at));
  }
  
  async createMatch(match: InsertMatch): Promise<Match> {
    const [newMatch] = await db.insert(matches).values(match).returning();
    return newMatch;
  }
  
  async getTournamentMatches(tournamentId: number): Promise<Match[]> {
    return await db
      .select()
      .from(matches)
      .where(eq(matches.tournament_id, tournamentId))
      .orderBy(desc(matches.played_at));
  }
  
  // Spin history related functions
  async getSpinHistory(userId: number, limit: number = 5): Promise<SpinHistory[]> {
    return await db
      .select()
      .from(spinHistory)
      .where(eq(spinHistory.user_id, userId))
      .orderBy(desc(spinHistory.spun_at))
      .limit(limit);
  }
  
  async createSpinHistory(history: InsertSpinHistory): Promise<SpinHistory> {
    const [newHistory] = await db.insert(spinHistory).values(history).returning();
    return newHistory;
  }
  
  // Tournament related functions
  async getTournament(id: number): Promise<Tournament | undefined> {
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id));
    return tournament;
  }
  
  async getTournaments(status?: string): Promise<Tournament[]> {
    if (status) {
      return await db
        .select()
        .from(tournaments)
        .where(eq(tournaments.status, status))
        .orderBy(desc(tournaments.created_at));
    }
    
    return await db
      .select()
      .from(tournaments)
      .orderBy(desc(tournaments.created_at));
  }
  
  async createTournament(tournament: InsertTournament): Promise<Tournament> {
    const [newTournament] = await db.insert(tournaments).values(tournament).returning();
    return newTournament;
  }
  
  async updateTournament(id: number, data: Partial<Tournament>): Promise<Tournament | undefined> {
    const [updatedTournament] = await db
      .update(tournaments)
      .set(data)
      .where(eq(tournaments.id, id))
      .returning();
    return updatedTournament;
  }
  
  // Tournament participant related functions
  async getTournamentParticipants(tournamentId: number): Promise<TournamentParticipant[]> {
    return await db
      .select()
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournament_id, tournamentId));
  }
  
  async getUserTournamentParticipations(userId: number): Promise<TournamentParticipant[]> {
    return await db
      .select()
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.user_id, userId));
  }
  
  async addParticipantToTournament(participant: InsertTournamentParticipant): Promise<TournamentParticipant> {
    // First, increment the current_participants count for the tournament
    await db
      .update(tournaments)
      .set({
        current_participants: sqlQuery`${tournaments.current_participants} + 1`,
      })
      .where(eq(tournaments.id, participant.tournament_id));
    
    // Then add the participant
    const [newParticipant] = await db
      .insert(tournamentParticipants)
      .values(participant)
      .returning();
    
    return newParticipant;
  }
  
  async updateTournamentParticipant(id: number, data: Partial<TournamentParticipant>): Promise<TournamentParticipant | undefined> {
    const [updatedParticipant] = await db
      .update(tournamentParticipants)
      .set(data)
      .where(eq(tournamentParticipants.id, id))
      .returning();
    return updatedParticipant;
  }
}

// Use the DatabaseStorage implementation
export const storage = new DatabaseStorage();
