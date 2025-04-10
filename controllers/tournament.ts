import { Request, Response } from "express";
import { storage } from "../storage";
import {
  createTournamentSchema,
  joinTournamentSchema,
  tournamentStatusEnum
} from "@shared/schema";
import { z } from "zod";

/**
 * Create a new tournament
 */
export async function createTournament(req: Request, res: Response) {
  try {
    const userId = 1; // Default user ID
    const data = createTournamentSchema.parse(req.body);
    
    // Convert ISO date strings to Date objects
    const tournamentData = {
      ...data,
      starts_at: data.starts_at ? new Date(data.starts_at) : undefined,
      ends_at: data.ends_at ? new Date(data.ends_at) : undefined,
    };
    
    const tournament = await storage.createTournament({
      name: tournamentData.name,
      description: tournamentData.description,
      prize_coins: tournamentData.prize_coins,
      max_participants: tournamentData.max_participants,
      status: "REGISTRATION", // Always start in registration phase
      starts_at: tournamentData.starts_at,
      ends_at: tournamentData.ends_at,
    });
    
    res.status(201).json(tournament);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("Error creating tournament:", error);
    res.status(500).json({ error: "Failed to create tournament" });
  }
}

/**
 * Get all tournaments
 */
export async function getTournaments(req: Request, res: Response) {
  try {
    const status = req.query.status as string | undefined;
    let validStatus: string | undefined = undefined;
    
    if (status) {
      // Validate status is a valid tournament status
      if (status === "REGISTRATION" || status === "IN_PROGRESS" || status === "COMPLETED") {
        validStatus = status;
      }
    }
    
    const tournaments = await storage.getTournaments(validStatus);
    res.json({ tournaments });
  } catch (error) {
    console.error("Error getting tournaments:", error);
    res.status(500).json({ error: "Failed to get tournaments" });
  }
}

/**
 * Get tournament by ID with participants
 */
export async function getTournamentDetails(req: Request, res: Response) {
  try {
    const tournamentId = parseInt(req.params.id);
    if (isNaN(tournamentId)) {
      return res.status(400).json({ error: "Invalid tournament ID" });
    }
    
    const tournament = await storage.getTournament(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    
    // Get tournament participants with their teams
    const participants = await storage.getTournamentParticipants(tournamentId);
    
    // Get all matches for this tournament
    const matches = await storage.getTournamentMatches(tournamentId);
    
    res.json({
      tournament,
      participants,
      matches
    });
  } catch (error) {
    console.error("Error getting tournament details:", error);
    res.status(500).json({ error: "Failed to get tournament details" });
  }
}

/**
 * Join a tournament with a team
 */
export async function joinTournament(req: Request, res: Response) {
  try {
    const userId = 1; // Default user ID
    const data = joinTournamentSchema.parse(req.body);
    
    // Check if tournament exists and is in REGISTRATION status
    const tournament = await storage.getTournament(data.tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    
    if (tournament.status !== "REGISTRATION") {
      return res.status(400).json({ error: "Tournament is not open for registration" });
    }
    
    if (tournament.current_participants >= tournament.max_participants) {
      return res.status(400).json({ error: "Tournament is already full" });
    }
    
    // Check if team exists and belongs to user
    const team = await storage.getTeam(data.teamId);
    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }
    
    if (team.user_id !== userId) {
      return res.status(403).json({ error: "You can only join with your own teams" });
    }
    
    // Check if user is already participating in this tournament
    const existingParticipations = await storage.getTournamentParticipants(data.tournamentId);
    const alreadyParticipating = existingParticipations.some(p => p.user_id === userId);
    if (alreadyParticipating) {
      return res.status(400).json({ error: "You are already participating in this tournament" });
    }
    
    // Add participant to tournament
    const participant = await storage.addParticipantToTournament({
      tournament_id: data.tournamentId,
      user_id: userId,
      team_id: data.teamId,
    });
    
    res.status(201).json(participant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("Error joining tournament:", error);
    res.status(500).json({ error: "Failed to join tournament" });
  }
}

/**
 * Leave a tournament
 */
export async function leaveTournament(req: Request, res: Response) {
  try {
    const userId = 1; // Default user ID
    const tournamentId = parseInt(req.params.id);
    if (isNaN(tournamentId)) {
      return res.status(400).json({ error: "Invalid tournament ID" });
    }
    
    // Check if tournament exists and is in REGISTRATION status
    const tournament = await storage.getTournament(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    
    if (tournament.status !== "REGISTRATION") {
      return res.status(400).json({ error: "Cannot leave a tournament that has already started" });
    }
    
    // Find the user's participation
    const participations = await storage.getTournamentParticipants(tournamentId);
    const userParticipation = participations.find(p => p.user_id === userId);
    
    if (!userParticipation) {
      return res.status(404).json({ error: "You are not participating in this tournament" });
    }
    
    // Mark as eliminated and update tournament participant count
    await storage.updateTournamentParticipant(userParticipation.id, {
      eliminated: true,
    });
    
    await storage.updateTournament(tournamentId, {
      current_participants: tournament.current_participants - 1,
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error leaving tournament:", error);
    res.status(500).json({ error: "Failed to leave tournament" });
  }
}

/**
 * Start a tournament (admin function)
 */
export async function startTournament(req: Request, res: Response) {
  try {
    const tournamentId = parseInt(req.params.id);
    if (isNaN(tournamentId)) {
      return res.status(400).json({ error: "Invalid tournament ID" });
    }
    
    // Check if tournament exists and is in REGISTRATION status
    const tournament = await storage.getTournament(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    
    if (tournament.status !== "REGISTRATION") {
      return res.status(400).json({ error: "Tournament has already started or finished" });
    }
    
    if (tournament.current_participants < 2) {
      return res.status(400).json({ error: "Tournament needs at least 2 participants to start" });
    }
    
    // Get active participants (not eliminated)
    const participants = await storage.getTournamentParticipants(tournamentId);
    const activeParticipants = participants.filter(p => !p.eliminated);
    
    // Generate tournament bracket
    const bracket = generateTournamentBracket(activeParticipants);
    
    // Update tournament status and bracket
    await storage.updateTournament(tournamentId, {
      status: "IN_PROGRESS",
      bracket: bracket,
      starts_at: new Date(),
    });
    
    res.json({ success: true, bracket });
  } catch (error) {
    console.error("Error starting tournament:", error);
    res.status(500).json({ error: "Failed to start tournament" });
  }
}

/**
 * Generate a tournament bracket
 */
function generateTournamentBracket(participants: any[]) {
  // Shuffle participants for random matchups
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  
  // Calculate rounds needed (2^n ≥ participants.length)
  const numParticipants = shuffled.length;
  const rounds = Math.ceil(Math.log2(numParticipants));
  const totalPositions = Math.pow(2, rounds);
  
  // Initial bracket with all positions
  const bracket = {
    rounds,
    currentRound: 1,
    matches: [] as any[],
  };
  
  // Create first round matches
  for (let i = 0; i < totalPositions / 2; i++) {
    const homeParticipant = shuffled[i] || null;
    const awayParticipant = shuffled[totalPositions - 1 - i] || null;
    
    bracket.matches.push({
      round: 1,
      position: i + 1,
      homeParticipantId: homeParticipant?.id || null,
      awayParticipantId: awayParticipant?.id || null,
      winnerId: null,
      matchId: null, // Will be populated once the match is created
      completed: false,
    });
  }
  
  // Create placeholders for future rounds
  for (let round = 2; round <= rounds; round++) {
    const matchesInRound = Math.pow(2, rounds - round);
    for (let i = 0; i < matchesInRound; i++) {
      bracket.matches.push({
        round,
        position: i + 1,
        homeParticipantId: null,
        awayParticipantId: null,
        winnerId: null,
        matchId: null,
        completed: false,
      });
    }
  }
  
  return bracket;
}

/**
 * Record a tournament match result
 */
export async function recordTournamentMatchResult(req: Request, res: Response) {
  try {
    const tournamentId = parseInt(req.params.id);
    const matchPosition = parseInt(req.params.matchPosition);
    const round = parseInt(req.params.round);
    
    if (isNaN(tournamentId) || isNaN(matchPosition) || isNaN(round)) {
      return res.status(400).json({ error: "Invalid parameters" });
    }
    
    const data = z.object({
      winnerId: z.number(),
      matchId: z.number(),
    }).parse(req.body);
    
    // Get tournament
    const tournament = await storage.getTournament(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    
    if (tournament.status !== "IN_PROGRESS") {
      return res.status(400).json({ error: "Tournament is not in progress" });
    }
    
    // Update the bracket
    const bracket = tournament.bracket as any;
    if (!bracket || !bracket.matches) {
      return res.status(400).json({ error: "Tournament bracket not found" });
    }
    
    // Find the match in the bracket
    const matchIndex = bracket.matches.findIndex(
      (m: any) => m.round === round && m.position === matchPosition
    );
    
    if (matchIndex === -1) {
      return res.status(404).json({ error: "Match not found in bracket" });
    }
    
    // Update match with result
    bracket.matches[matchIndex].winnerId = data.winnerId;
    bracket.matches[matchIndex].matchId = data.matchId;
    bracket.matches[matchIndex].completed = true;
    
    // If not final round, advance winner to next round
    if (round < bracket.rounds) {
      const nextRound = round + 1;
      const nextPosition = Math.ceil(matchPosition / 2);
      
      // Find the next round match
      const nextMatchIndex = bracket.matches.findIndex(
        (m: any) => m.round === nextRound && m.position === nextPosition
      );
      
      if (nextMatchIndex !== -1) {
        // Determine if the winner goes to home or away position
        if (matchPosition % 2 === 1) { // Odd positions go to home
          bracket.matches[nextMatchIndex].homeParticipantId = data.winnerId;
        } else { // Even positions go to away
          bracket.matches[nextMatchIndex].awayParticipantId = data.winnerId;
        }
      }
    }
    
    // Check if all matches in the current round are completed
    const currentRoundMatches = bracket.matches.filter((m: any) => m.round === bracket.currentRound);
    const allCompleted = currentRoundMatches.every((m: any) => m.completed);
    
    // If all completed and not the final round, advance to next round
    if (allCompleted && bracket.currentRound < bracket.rounds) {
      bracket.currentRound += 1;
    }
    
    // If final round completed, end the tournament
    if (bracket.currentRound === bracket.rounds && allCompleted) {
      // Get winner ID from the final match
      const finalMatch = bracket.matches.find(
        (m: any) => m.round === bracket.rounds && m.position === 1
      );
      
      // Update tournament as completed
      await storage.updateTournament(tournamentId, {
        status: "COMPLETED",
        bracket: bracket,
        winner_id: finalMatch?.winnerId || null,
        ends_at: new Date(),
      });
      
      // If winner exists, add coins as prize
      if (finalMatch?.winnerId) {
        const winner = await storage.getUser(finalMatch.winnerId);
        if (winner) {
          await storage.updateUser(winner.id, {
            coins: winner.coins + tournament.prize_coins,
          });
        }
      }
    } else {
      // Just update the bracket
      await storage.updateTournament(tournamentId, {
        bracket: bracket,
      });
    }
    
    res.json({ success: true, bracket });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("Error recording match result:", error);
    res.status(500).json({ error: "Failed to record match result" });
  }
}