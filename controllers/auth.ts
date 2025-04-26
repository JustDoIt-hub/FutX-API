import { Request, Response } from 'express';
import { storage } from '../storage';
import { telegramAuthSchema } from '@shared/schema';
import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';
import 'express-session';
const log = (...args: any[]) => console.log("[LOG]", ...args);


// Extend session to include userId
declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

export async function telegramLogin(req: Request, res: Response) {
  try {
    log('Telegram login attempt', 'auth');

    // Validate Telegram payload
    const payload = telegramAuthSchema.parse(req.body);
    log(`Telegram payload validated: ${JSON.stringify(payload)}`, 'auth');

    // Check if user already exists
    let user = await storage.getUserByTelegramId(payload.id);

    if (user) {
      log(`Found existing user with Telegram ID ${payload.id}`, 'auth');
    } else {
      log(`No user found with Telegram ID ${payload.id}, creating one`, 'auth');

      // Create a new user
      const username = payload.username || `tg_user_${payload.id}`;
      user = await storage.createUser({
        telegramId: payload.id,
        telegramUsername: payload.username,
        coins: 5000, // Starting coins
      });
    }

    // Store in session
    if (req.session) {
      req.session.userId = user.id;
      log(`Stored user ID ${user.id} in session`, 'auth');
    }

    // Return user info
    const { password, ...userInfo } = user;
    return res.status(200).json({ message: 'Telegram login successful', user: userInfo });

  } catch (error) {
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      log(`Telegram login validation error: ${validationError}`, 'auth');
      return res.status(400).json({ message: 'Invalid Telegram login payload' });
    }
    
    log(`Telegram login error: ${error instanceof Error ? error.message : String(error)}`, 'auth');
    return res.status(500).json({ message: 'Telegram login failed' });
  }
}

