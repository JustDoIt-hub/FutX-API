import { Request, Response } from 'express';
import { storage } from '../storage';
import { telegramAuthSchema } from '@shared/schema';
import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';
import 'express-session';

// ✅ Local logger
const log = (...args: any[]) => console.log("[LOG]", ...args);

// Extend session to include userId
declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

// ✅ Telegram login
export async function telegramLogin(req: Request, res: Response) {
  try {
    log('Telegram login attempt', 'auth');

    // Validate Telegram payload
    const payload = telegramAuthSchema.parse(req.body);
    log(`Telegram payload validated: ${JSON.stringify(payload)}`, 'auth');

    // Check if user exists
    let user = await storage.getUserByTelegramId(payload.id);

    if (user) {
      log(`Found existing user with Telegram ID ${payload.id}`, 'auth');
    } else {
      log(`No user found, creating one`, 'auth');
      const username = payload.username || `tg_user_${payload.id}`;

      user = await storage.createUser({
        username,
        telegramId: payload.id,
        telegramUsername: payload.username,
        coins: 5000, // Starting coins
      });
    }

    // Store user ID in session
    if (req.session) {
      req.session.userId = user.id;
      log(`Stored user ID ${user.id} in session`, 'auth');
    }

    const { password, ...userInfo } = user;
    return res.status(200).json({ message: 'Telegram login successful', user: userInfo });

  } catch (error) {
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      log(`Validation error: ${validationError}`, 'auth');
      return res.status(400).json({ message: 'Invalid Telegram login payload' });
    }
    log(`Error: ${error instanceof Error ? error.message : String(error)}`, 'auth');
    return res.status(500).json({ message: 'Telegram login failed' });
  }
}

// ✅ Logout
export async function logout(req: Request, res: Response) {
  if (req.session) {
    const userId = req.session.userId;
    log(`Logging out user ID: ${userId}`, 'auth');

    req.session.destroy((err) => {
      if (err) {
        log(`Logout error: ${err.message}`, 'auth');
        return res.status(500).json({ message: 'Logout failed' });
      }
      res.clearCookie('fut.draft.session');
      res.status(200).json({ message: 'Logged out successfully' });
    });
  } else {
    res.status(200).json({ message: 'Already logged out' });
  }
}

// ✅ Get Current User
export async function getCurrentUser(req: Request, res: Response) {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = await storage.getUser(req.session.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { password, ...userInfo } = user;
    return res.status(200).json({ user: userInfo });
  } catch (error) {
    log(`GetCurrentUser error: ${error instanceof Error ? error.message : String(error)}`, 'auth');
    return res.status(500).json({ message: 'Failed to get user' });
  }
}
