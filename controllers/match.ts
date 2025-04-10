import { Request, Response } from 'express';
import { storage } from '../storage';
import { startMatchSchema } from '@shared/schema';
import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { WebSocket } from 'ws';

// Commentary templates
const goalScoringCommentary = [
  "GOAL! {scorer} finds the back of the net with a brilliant finish!",
  "What a strike from {scorer}! An absolute thunderbolt!",
  "GOAL! {scorer} coolly slots it past the keeper!",
  "A clinical finish from {scorer}! GOAL!",
  "Magnificent team play and {scorer} finishes it off! GOAL!"
];

const missedChanceCommentary = [
  "{player} shoots... but it's just wide of the post!",
  "Great save by the goalkeeper to deny {player}!",
  "{player} tries a speculative effort but it flies over the bar.",
  "So close! {player} hits the woodwork!",
  "{player} should have done better there, a wasted opportunity."
];

const defensiveCommentary = [
  "Brilliant defending from {player} to clear the danger.",
  "{player} with a crucial tackle right on the edge of the box!",
  "The defensive organization is solid, led by {player}.",
  "{player} reads the game perfectly to intercept that pass.",
  "A last-ditch tackle from {player} saves a certain goal!"
];

const possessionCommentary = [
  "The team is building from the back with {player} orchestrating play.",
  "{player} showing great composure on the ball.",
  "Beautiful passing sequence involving {player}.",
  "{player} controls the tempo of the game right now.",
  "Patient build-up play with {player} at the heart of it."
];

// Helper function to get a random item from an array
function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// Helper function to replace player name in commentary
function formatCommentary(template: string, playerName: string): string {
  return template.replace('{player}', playerName).replace('{scorer}', playerName);
}

// Generate a random number between min and max (inclusive)
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate CPU team based on user's team strength
function generateCpuTeam(userTeam: any) {
  // Calculate average rating of user team
  const userTeamRatings = userTeam.players.map((p: any) => p.overall);
  const userTeamAvg = userTeamRatings.reduce((sum: number, rating: number) => sum + rating, 0) / userTeamRatings.length;
  
  // Generate CPU team with slightly lower rating (80-100% of user team)
  const cpuTeamFactor = 0.8 + (Math.random() * 0.2);
  const cpuTeamStrength = Math.floor(userTeamAvg * cpuTeamFactor);
  
  return {
    name: "CPU Team",
    formation: userTeam.formation,
    play_style: userTeam.play_style,
    strength: cpuTeamStrength,
    players: userTeam.players.map((p: any) => ({
      ...p,
      name: `CPU ${p.name}`,
      overall: Math.min(99, Math.max(70, Math.floor(p.overall * cpuTeamFactor)))
    }))
  };
}

// Simulate a match event
function simulateMatchEvent(userTeam: any, cpuTeam: any, minute: number, userAttacking: boolean) {
  const attackingTeam = userAttacking ? userTeam : cpuTeam;
  const defendingTeam = userAttacking ? cpuTeam : userTeam;
  
  const attackingPlayers = attackingTeam.players;
  const defendingPlayers = defendingTeam.players;
  
  // Get random players
  const attacker = getRandomItem(attackingPlayers);
  const defender = getRandomItem(defendingPlayers);
  
  // Compute chance of goal based on player ratings and team style
  const attackerRating = attacker.overall;
  const defenderRating = defender.overall;
  
  // Base chance of a goal is determined by the difference in ratings
  let goalChance = 0.1 + ((attackerRating - defenderRating) * 0.01);
  
  // Adjust for different play styles
  if (attackingTeam.play_style === "COUNTER_ATTACK" && defendingTeam.play_style === "HIGH_PRESS") {
    goalChance += 0.1; // Counter attack is effective against high press
  }
  if (attackingTeam.play_style === "TIKI_TAKA" && defendingTeam.play_style === "COUNTER_ATTACK") {
    goalChance += 0.05; // Tiki-taka slightly favored against counter attack
  }
  
  // Ensure reasonable bounds
  goalChance = Math.min(0.4, Math.max(0.05, goalChance));
  
  const randomChance = Math.random();
  
  let eventType: 'goal' | 'miss' | 'defense' | 'possession';
  
  if (randomChance < goalChance) {
    eventType = 'goal';
  } else if (randomChance < goalChance + 0.3) {
    eventType = 'miss';
  } else if (randomChance < goalChance + 0.6) {
    eventType = 'defense';
  } else {
    eventType = 'possession';
  }
  
  // Generate commentary based on event type
  let commentary: string;
  
  switch (eventType) {
    case 'goal':
      commentary = formatCommentary(getRandomItem(goalScoringCommentary), attacker.name);
      break;
    case 'miss':
      commentary = formatCommentary(getRandomItem(missedChanceCommentary), attacker.name);
      break;
    case 'defense':
      commentary = formatCommentary(getRandomItem(defensiveCommentary), defender.name);
      break;
    case 'possession':
      commentary = formatCommentary(getRandomItem(possessionCommentary), attacker.name);
      break;
  }
  
  return {
    minute,
    eventType,
    commentary,
    player: eventType === 'defense' ? defender : attacker,
    team: eventType === 'defense' ? (userAttacking ? 'CPU' : 'USER') : (userAttacking ? 'USER' : 'CPU')
  };
}

// Handle the match simulation with WebSocket
export function handleMatchSimulation(ws: WebSocket, userId: number, teamId: number) {
  // Function to run match simulation
  const runMatchSimulation = async () => {
    try {
      // Get the user's team
      const team = await storage.getTeam(teamId);
      
      if (!team) {
        ws.send(JSON.stringify({ type: 'error', message: 'Team not found' }));
        ws.close();
        return;
      }
      
      // No need to check team ownership in guest mode
      /*
      // Check if the team belongs to the user
      if (team.user_id !== userId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not authorized to use this team' }));
        ws.close();
        return;
      }
      */
      
      // Generate CPU team
      const cpuTeam = generateCpuTeam(team);
      
      // Send initial match info
      ws.send(JSON.stringify({ 
        type: 'match_start',
        userTeam: team,
        cpuTeam: cpuTeam
      }));
      
      // Match state
      const matchState = {
        minute: 0,
        userScore: 0,
        cpuScore: 0,
        possession: 50, // 50% possession to start
        shots: 0,
        shotsOnTarget: 0,
        corners: 0,
        commentary: [],
        finished: false
      };
      
      // Send match state update
      const sendMatchUpdate = () => {
        ws.send(JSON.stringify({
          type: 'match_update',
          state: matchState
        }));
      };
      
      // Initial update
      sendMatchUpdate();
      
      // Simulate match events every few seconds
      const simInterval = setInterval(() => {
        // Increment match time
        matchState.minute += 1;
        
        // End the match after 90 minutes
        if (matchState.minute >= 90) {
          clearInterval(simInterval);
          matchState.finished = true;
          
          // Save match result
          saveMatchResult(userId, team, cpuTeam, matchState);
          
          // Send final update
          ws.send(JSON.stringify({
            type: 'match_end',
            state: matchState
          }));
          
          return;
        }
        
        // Determine if there's an event at this minute (roughly 20% chance)
        if (Math.random() < 0.2) {
          // Determine attacking team based on possession
          const userAttacking = Math.random() < (matchState.possession / 100);
          
          // Simulate an event
          const event = simulateMatchEvent(team, cpuTeam, matchState.minute, userAttacking);
          
          // Update match stats based on event
          if (event.eventType === 'goal') {
            if (event.team === 'USER') {
              matchState.userScore += 1;
            } else {
              matchState.cpuScore += 1;
            }
            matchState.shots += 1;
            matchState.shotsOnTarget += 1;
          } else if (event.eventType === 'miss') {
            matchState.shots += 1;
            
            // 50% chance the shot was on target
            if (Math.random() < 0.5) {
              matchState.shotsOnTarget += 1;
            }
            
            // 30% chance it results in a corner
            if (Math.random() < 0.3) {
              matchState.corners += 1;
            }
          }
          
          // Add commentary
          matchState.commentary.unshift({
            minute: matchState.minute,
            text: event.commentary
          });
          
          // Keep only the last 10 commentary items
          if (matchState.commentary.length > 10) {
            matchState.commentary.pop();
          }
          
          // Update possession slightly (random drift)
          const possessionDrift = randomInt(-2, 2);
          matchState.possession = Math.min(100, Math.max(0, matchState.possession + possessionDrift));
          
          // Send match update with the event
          ws.send(JSON.stringify({
            type: 'match_event',
            event: event,
            state: matchState
          }));
        }
        
        // Send regular match update
        sendMatchUpdate();
      }, 1000); // Update every second (1 minute of game time)
      
      // Clean up when the client disconnects
      ws.on('close', () => {
        clearInterval(simInterval);
      });
      
    } catch (error) {
      console.error('Match simulation error:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to run match simulation' }));
      ws.close();
    }
  };
  
  // Start the simulation
  runMatchSimulation();
}

// Save match result to database
async function saveMatchResult(userId: number, userTeam: any, cpuTeam: any, matchState: any) {
  try {
    await storage.createMatch({
      user_id: userId,
      team_id: userTeam.id,
      opponent_team: cpuTeam,
      user_score: matchState.userScore,
      opponent_score: matchState.cpuScore,
      possession: matchState.possession,
      shots: matchState.shots,
      shots_on_target: matchState.shotsOnTarget,
      corners: matchState.corners,
      commentary: matchState.commentary
    });
  } catch (error) {
    console.error('Error saving match result:', error);
  }
}

// HTTP endpoint to start a match
export async function startMatch(req: Request, res: Response) {
  try {
    // Use default user ID (1) instead of requiring authentication
    const userId = req.session?.userId || 1;
    
    // Validate request body
    const { teamId } = startMatchSchema.parse(req.body);
    
    // Verify the team exists and belongs to the user
    const team = await storage.getTeam(teamId);
    
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    if (team.user_id !== userId) {
      return res.status(403).json({ message: 'You do not have access to this team' });
    }
    
    // All checks passed - client should now connect to WebSocket
    return res.status(200).json({ 
      message: 'Team verified. Connect to WebSocket to start match.',
      teamId
    });
    
  } catch (error) {
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.message });
    }
    
    console.error('Start match error:', error);
    return res.status(500).json({ message: 'Failed to start match' });
  }
}

// Get match history
export async function getMatchHistory(req: Request, res: Response) {
  try {
    // Use default user ID (1) instead of requiring authentication
    const userId = req.session?.userId || 1;
    
    // Get all matches for the user
    const matches = await storage.getUserMatches(userId);
    
    return res.status(200).json({ matches });
    
  } catch (error) {
    console.error('Get match history error:', error);
    return res.status(500).json({ message: 'Failed to get match history' });
  }
}

// Get match details
export async function getMatchDetails(req: Request, res: Response) {
  try {
    // Use default user ID (1) instead of requiring authentication
    const userId = req.session?.userId || 1;
    
    const matchId = parseInt(req.params.id);
    if (isNaN(matchId)) {
      return res.status(400).json({ message: 'Invalid match ID' });
    }
    
    // Get the match
    const match = await storage.getMatch(matchId);
    
    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }
    
    // Check if the match belongs to the user
    if (match.user_id !== userId) {
      return res.status(403).json({ message: 'You do not have access to this match' });
    }
    
    return res.status(200).json({ match });
    
  } catch (error) {
    console.error('Get match details error:', error);
    return res.status(500).json({ message: 'Failed to get match details' });
  }
}
