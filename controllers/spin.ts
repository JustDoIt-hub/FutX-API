import { Request, Response } from 'express';
import { storage } from '../storage';
import { spinRequestSchema } from '@shared/schema';
import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';

// Possible positions for the spin
const positions = [
  "GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"
];

// Possible events for the spin
const events = [
  "TOTS", "TOTY", "ICY_MAGICIANS", "FUTURE_STARS", "ICONS", "HEROES"
];

// Possible OVR ranges for the spin
const ovrRanges = [
  "90+", "85-89", "80-84", "75-79", "70-74"
];

// Helper function to get a random item from an array
function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export async function getSpinOptions(req: Request, res: Response) {
  try {
    return res.status(200).json({
      positions,
      events,
      ovrRanges
    });
  } catch (error) {
    console.error('Get spin options error:', error);
    return res.status(500).json({ message: 'Failed to get spin options' });
  }
}

export async function performSpin(req: Request, res: Response) {
  try {
    // Use default user ID (1) instead of requiring authentication
    const userId = req.session?.userId || 1;
    
    // Validate request body
    const { type } = spinRequestSchema.parse(req.body);
    
    // Get random values based on the spin type
    let positionResult: string | null = null;
    let eventResult: string | null = null;
    let ovrResult: string | null = null;
    
    if (type === 'position' || type === 'all') {
      positionResult = getRandomItem(positions);
    }
    
    if (type === 'event' || type === 'all') {
      eventResult = getRandomItem(events);
    }
    
    if (type === 'ovr' || type === 'all') {
      ovrResult = getRandomItem(ovrRanges);
    }
    
    // If all three options are selected, find a matching player
    if (type === 'all' && positionResult && eventResult && ovrResult) {
      try {
        console.log(`Looking for player with position=${positionResult}, event=${eventResult}, ovrRange=${ovrResult}`);
        
        // Try to find a player with the exact filters
        let player = await storage.getRandomPlayerByFilters(
          positionResult,
          eventResult,
          ovrResult
        );
        
        // If no player found, try relaxing the criteria by getting any player with matching position
        if (!player) {
          console.log(`No exact match found, getting player with position=${positionResult}`);
          
          // Get all players with the position
          const positionPlayers = await storage.getPlayersByPosition(positionResult);
          
          if (positionPlayers.length > 0) {
            // Pick a random player from the available ones
            player = getRandomItem(positionPlayers);
            console.log(`Selected player: ${player.name} (${player.position}, ${player.event}, ${player.overall})`);
          }
        }
        
        if (player) {
          // Add player to user's collection
          await storage.addPlayerToUser(userId, player.id);
          
          // Record the spin in history
          await storage.createSpinHistory({
            user_id: userId,
            player_id: player.id,
            position_result: positionResult as any,
            event_result: eventResult as any,
            ovr_result: ovrResult
          });
          
          return res.status(200).json({
            type,
            positionResult,
            eventResult,
            ovrResult,
            player
          });
        } else {
          console.log('No player found even after relaxing criteria');
        }
      } catch (error) {
        console.error('Error finding player:', error);
      }
    }
    
    // Return just the spin results if we don't have a full match or couldn't find a player
    return res.status(200).json({
      type,
      positionResult,
      eventResult,
      ovrResult
    });
    
  } catch (error) {
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.message });
    }
    
    console.error('Spin error:', error);
    return res.status(500).json({ message: 'Failed to perform spin' });
  }
}

export async function getRecentSpins(req: Request, res: Response) {
  try {
    // Use default user ID (1) instead of requiring authentication
    const userId = req.session?.userId || 1;
    
    // Get recent spin history with limit
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
    const spinHistoryItems = await storage.getSpinHistory(userId, limit);
    
    // Get the player details for each spin
    const playerIds = spinHistoryItems.map(item => item.player_id);
    const players = await storage.getPlayersByIds(playerIds);
    
    // Map player details to spin history
    const recentSpins = spinHistoryItems.map(item => {
      const player = players.find(p => p.id === item.player_id);
      return {
        ...item,
        player
      };
    });
    
    return res.status(200).json({ recentSpins });
    
  } catch (error) {
    console.error('Get recent spins error:', error);
    return res.status(500).json({ message: 'Failed to get recent spins' });
  }
}

export async function getUserPlayers(req: Request, res: Response) {
  try {
    // Use default user ID (1) instead of requiring authentication
    const userId = req.session?.userId || 1;
    
    // Get all players for the user
    const players = await storage.getUserPlayers(userId);
    
    return res.status(200).json({ players });
    
  } catch (error) {
    console.error('Get user players error:', error);
    return res.status(500).json({ message: 'Failed to get players' });
  }
}
