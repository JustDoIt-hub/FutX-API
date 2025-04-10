import { Request, Response } from 'express';
import { storage } from '../storage';
import { telegramAuthSchema } from '@shared/schema';
import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { log } from '../vite';
import 'express-session';

// Extend the session type to include userId
declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

// Simple login function that auto-creates a demo user
export async function login(req: Request, res: Response) {
  try {
    log('Simple login attempt', 'auth');
    
    // Create a username with timestamp to ensure uniqueness
    const username = `user_${Date.now()}`;
    
    // Create a new user
    log(`Creating new user with username: ${username}`, 'auth');
    const user = await storage.createUser({
      username,
      password: Math.random().toString(36).slice(2), // Generate a random password
      telegram_id: null,
      telegram_username: null,
      coins: 5000 // Give new users some starting coins
    });
    
    log(`New user created with ID: ${user.id}`, 'auth');
    
    // Store user in session
    if (req.session) {
      req.session.userId = user.id;
      log(`User ID ${user.id} stored in session`, 'auth');
    } else {
      log('Session object not available!', 'auth');
    }
    
    // Return user info (excluding password)
    const { password, ...userInfo } = user;
    return res.status(200).json({ 
      message: 'Login successful',
      user: userInfo
    });
    
  } catch (error) {
    log(`Login error: ${error instanceof Error ? error.message : String(error)}`, 'auth');
    return res.status(500).json({ message: 'Login failed' });
  }
}

export async function getCurrentUser(req: Request, res: Response) {
  try {
    // Check if there's a userId in the session
    let userId = req.session?.userId;
    
    // If no user in session, let's auto-create a guest user
    if (!userId) {
      log('No user in session, creating a guest user', 'auth');
      
      // Create a username with timestamp to ensure uniqueness
      const username = `guest_${Date.now()}`;
      
      // Create a new user
      const user = await storage.createUser({
        username,
        password: Math.random().toString(36).slice(2), // Generate a random password
        telegram_id: null,
        telegram_username: null,
        coins: 10000 // Give guest users plenty of coins
      });
      
      // Store user in session
      if (req.session) {
        req.session.userId = user.id;
        userId = user.id;
        log(`Created and stored guest user ID ${user.id} in session`, 'auth');
      }
      
      // Return user info
      const { password, ...userInfo } = user;
      return res.status(200).json({ user: userInfo });
    }
    
    // If we have a userId, fetch the user data
    log(`Fetching current user with ID: ${userId}`, 'auth');
    const user = await storage.getUser(userId);
    
    if (!user) {
      log(`User with ID ${userId} not found in database, creating new guest user`, 'auth');
      // Create a new guest user if the user was not found
      return login(req, res);
    }
    
    log(`Returned user info for ID: ${userId}`, 'auth');
    const { password, ...userInfo } = user;
    return res.status(200).json({ user: userInfo });
    
  } catch (error) {
    log(`Get current user error: ${error instanceof Error ? error.message : String(error)}`, 'auth');
    // Try to create a guest user on error
    return login(req, res);
  }
}

export async function logout(req: Request, res: Response) {
  if (req.session) {
    const userId = req.session.userId;
    log(`Logging out user with ID: ${userId}`, 'auth');
    
    req.session.destroy((err) => {
      if (err) {
        log(`Error destroying session: ${err.message}`, 'auth');
        return res.status(500).json({ message: 'Failed to logout' });
      }
      
      log('Session destroyed, clearing cookie', 'auth');
      res.clearCookie('connect.sid');
      return res.status(200).json({ message: 'Logged out successfully' });
    });
  } else {
    log('No session found for logout', 'auth');
    return res.status(200).json({ message: 'Already logged out' });
  }
}
