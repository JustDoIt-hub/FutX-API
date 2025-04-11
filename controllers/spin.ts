import { Request, Response } from 'express';
import { storage } from '../storage';
import { spinRequestSchema } from '@shared/schema';
import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';


const positions = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"];
const events = ["ICY_MAGICIANS", "FUTURE_STARS", "ICON", "GOLD"];
const ovrRanges = ["90+", "85-89", "80-84", "75-79", "70-74"];

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}


export async function getSpinOptions(req: Request, res: Response) {
  try {
    return res.status(200).json({ positions, events, ovrRanges });
  } catch (error) {
    console.error('Get spin options error:', error);
    return res.status(500).json({ message: 'Failed to get spin options' });
  }
}


export async function performSpin(req: Request, res: Response) {
  try {
    const userId = req.session?.userId || 1;
    const { type } = spinRequestSchema.parse(req.body);

    let positionResult: string | null = null;
    let eventResult: string | null = null;
    let ovrResult: string | null = null;

    if (type === 'position' || type === 'all') positionResult = getRandomItem(positions);
    if (type === 'event' || type === 'all') eventResult = getRandomItem(events);
    if (type === 'ovr' || type === 'all') ovrResult = getRandomItem(ovrRanges);

    if (type === 'all' && positionResult && eventResult && ovrResult) {
      try {
        console.log(`Searching player with: position=${positionResult}, event=${eventResult}, ovr=${ovrResult}`);
        let player = await storage.getRandomPlayerByFilters(positionResult, eventResult, ovrResult);

        if (!player) {
          console.log(`Fallback to any player with position=${positionResult}`);
          const candidates = await storage.getPlayersByPosition(positionResult);
          if (candidates.length > 0) player = getRandomItem(candidates);
        }

        if (player) {
          await storage.addPlayerToUser({
            userId,
            playerId: player.playerId,
            quantity: 1,
            howgot: 'hunt',
            tradable: false
          });

          await storage.createSpinHistory({
            userId,
            playerId: player.playerId
          });

          return res.status(200).json({
            type,
            positionResult,
            eventResult,
            ovrResult,
            player
          });
        }
      } catch (err) {
        console.error('Error during spin:', err);
      }
    }

    return res.status(200).json({ type, positionResult, eventResult, ovrResult });

  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: fromZodError(error).message });
    }
    console.error('Spin error:', error);
    return res.status(500).json({ message: 'Failed to perform spin' });
  }
}

export async function getRecentSpins(req: Request, res: Response) {
  try {
    const userId = req.session?.userId || 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
    const spinHistoryItems = await storage.getSpinHistory(userId, limit);

    const playerIds = spinHistoryItems.map(item => item.player_id);
    const players = await storage.getPlayersByIds(playerIds);

    const recentSpins = spinHistoryItems.map(item => {
      const player = players.find(p => p.playerId === item.player_id);
      return { ...item, player };
    });

    return res.status(200).json({ recentSpins });
  } catch (error) {
    console.error('Get recent spins error:', error);
    return res.status(500).json({ message: 'Failed to get recent spins' });
  }
}


export async function getUserPlayers(req: Request, res: Response) {
  try {
    const userId = req.session?.userId || 1;
    const players = await storage.getUserPlayers(userId);
    return res.status(200).json({ players });
  } catch (error) {
    console.error('Get user players error:', error);
    return res.status(500).json({ message: 'Failed to get players' });
  }
}
