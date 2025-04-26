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
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized: no user session' });

    const { type } = spinRequestSchema.parse(req.body);

    const positionResult = (type === 'position' || type === 'all') ? getRandomItem(positions) : null;
    const eventResult = (type === 'event' || type === 'all') ? getRandomItem(events) : null;
    const ovrResult = (type === 'ovr' || type === 'all') ? getRandomItem(ovrRanges) : null;

    let player = null;

    if (type === 'all' && positionResult && eventResult) {
      player = await storage.getRandomPlayerByFilters(positionResult, eventResult);
      if (!player) {
        console.log(`[Fallback] No player matching position=${positionResult} + event=${eventResult}`);
        const candidates = await storage.getPlayersByPosition(positionResult);
        if (candidates.length > 0) {
          player = getRandomItem(candidates);
        }
      }
    } else if (type === 'position' && positionResult) {
      const candidates = await storage.getPlayersByPosition(positionResult);
      if (candidates.length > 0) {
        player = getRandomItem(candidates);
      }
    } else if (type === 'event' && eventResult) {
      const candidates = await storage.getPlayersByEvent(eventResult);
      if (candidates.length > 0) {
        player = getRandomItem(candidates);
      }
    } else {
      console.log(`Unsupported spin type: ${type}`);
    }

    if (!player) {
      return res.status(404).json({ message: "No suitable player found for spin." });
    }

    await storage.addPlayerToUser({
      userId,
      playerId: player.id,
      quantity: 1,
      howgot: 'hunt',
      tradable: false
    });

    await storage.createSpinHistory({
      userId,
      playerId: player.id
    });

    return res.status(200).json({
      type,
      positionResult,
      eventResult,
      ovrResult,
      player
    });

  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: fromZodError(error).message });
    }
    console.error('Spin error:', error);
    return res.status(500).json({ message: `Spin failed: ${error instanceof Error ? error.message : String(error)}` });
  }
}

export async function getRecentSpins(req: Request, res: Response) {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized: no user session' });

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
    const spinHistoryItems = await storage.getSpinHistory(userId, limit);

    const playerIds = spinHistoryItems.map(item => item.playerId);
    const players = await storage.getPlayersByIds(playerIds);

    const recentSpins = spinHistoryItems.map(item => {
      const player = players.find(p => p.id === item.playerId);
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
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized: no user session' });

    const players = await storage.getUserPlayers(userId);
    return res.status(200).json({ players });
  } catch (error) {
    console.error('Get user players error:', error);
    return res.status(500).json({ message: 'Failed to get user players' });
  }
}
