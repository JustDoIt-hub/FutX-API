// import { Request, Response } from 'express';
// import { storage } from '../storage';
// import { telegramAuthSchema } from '@shared/schema';
// import { ZodError } from 'zod';
// import { fromZodError } from 'zod-validation-error';
// import { createHmac } from 'crypto';
// import 'express-session';

// const log = (...args: any[]) => console.log("[LOG]", ...args);

// declare module 'express-session' {
//   interface SessionData {
//     userId: number;
//   }
// }

// const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

// function verifyTelegramHash(payload: Record<string, any>) {
//   const { hash, ...authData } = payload;

//   log('Verifying hash for payload:', authData);

//   const secretKey = createHmac('sha256', TELEGRAM_BOT_TOKEN)
//     .update('WebAppData')
//     .digest();

//   const dataCheckString = Object.entries(authData)
//     .sort(([a], [b]) => a.localeCompare(b))
//     .map(([key, value]) => `${key}=${value}`)
//     .join('\n');

//   log('Data check string:', dataCheckString);

//   const hmac = createHmac('sha256', secretKey)
//     .update(dataCheckString)
//     .digest('hex');

//   log('Generated HMAC:', hmac);

//   return hmac === hash;
// }

// export async function login(req: Request, res: Response) {
//   try {
//     log('Telegram login attempt', 'auth');

//     // ✅ USE req.query INSTEAD OF req.body
//     log('Received payload:', req.query);

//     const payload = telegramAuthSchema.parse(req.query);
//     log(`Telegram payload validated: ${JSON.stringify(payload)}`, 'auth');

//     // ✅ Hash verification
//     if (!verifyTelegramHash(payload)) {
//       log('Hash mismatch detected', 'auth');
//       return res.status(403).json({ message: 'Invalid Telegram login: hash mismatch' });
//     }

//     log('Telegram hash verified successfully', 'auth');

//     // Check if user already exists
//     let user = await storage.getUserByTelegramId(payload.id);

//     if (!user) {
//       log(`No user found with Telegram ID ${payload.id}, creating one`, 'auth');
//       user = await storage.createUser({
//         telegramId: payload.id,
//         telegramUsername: payload.username,
//         coins: 5000,
//       });
//     } else {
//       log(`Found existing user with Telegram ID ${payload.id}`, 'auth');
//     }

//     if (req.session) {
//       req.session.userId = user.id;
//       log(`Stored user ID ${user.id} in session`, 'auth');
//     }

//     const { password, ...userInfo } = user;
//     return res.status(200).json({ message: 'Telegram login successful', user: userInfo });

//   } catch (error) {
//     if (error instanceof ZodError) {
//       const validationError = fromZodError(error);
//       log(`Telegram login validation error: ${validationError}`, 'auth');
//       return res.status(400).json({ message: 'Invalid Telegram login payload' });
//     }

//     log(`Telegram login error: ${error instanceof Error ? error.message : String(error)}`, 'auth');
//     return res.status(500).json({ message: 'Telegram login failed' });
//   }
// }

// export async function getCurrentUser(req: Request, res: Response) {
//   if (!req.session?.userId) {
//     return res.status(401).json({ message: "Not authenticated" });
//   }

//   const user = await storage.getUserById(req.session.userId);
//   if (!user) {
//     return res.status(404).json({ message: "User not found" });
//   }

//   const { password, ...userInfo } = user;
//   return res.json({ user: userInfo });
// }

// export async function logout(req: Request, res: Response) {
//   req.session?.destroy((err) => {
//     if (err) {
//       console.error("Failed to destroy session:", err);
//       return res.status(500).json({ message: "Logout failed" });
//     }
//     res.clearCookie("connect.sid");
//     return res.json({ message: "Logged out" });
//   });
// }
import { Request, Response } from 'express';
import { storage } from '../storage';
import { telegramAuthSchema } from '@shared/schema';
import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { createHmac } from 'crypto';
import 'express-session';

const log = (...args: any[]) => console.log("[LOG]", ...args);

declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

function verifyTelegramHash(payload: Record<string, any>) {
  const { hash, ...authData } = payload;

  log('Verifying hash for payload:', authData);

  const secretKey = createHmac('sha256', TELEGRAM_BOT_TOKEN)
    .update('WebAppData')
    .digest();

  const dataCheckString = Object.entries(authData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  log('Data check string:', dataCheckString);

  const hmac = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  log('Generated HMAC:', hmac);

  return hmac === hash;
}

export async function login(req: Request, res: Response) {
  try {
    log('Telegram login attempt', 'auth');
    log('Received payload:', req.query);

    // 🛠 Fix types before validation
    if (typeof req.query.id === 'string') {
      req.query.id = Number(req.query.id);
    }
    if (typeof req.query.auth_date === 'string') {
      req.query.auth_date = Number(req.query.auth_date);
    }

    const payload = telegramAuthSchema.parse(req.query);
    log(`Telegram payload validated: ${JSON.stringify(payload)}`, 'auth');

    // ✅ Hash verification
    if (!verifyTelegramHash(payload)) {
      log('Hash mismatch detected', 'auth');
      return res.status(403).json({ message: 'Invalid Telegram login: hash mismatch' });
    }

    log('Telegram hash verified successfully', 'auth');

    // 🔍 Check if user already exists
    let user = await storage.getUserByTelegramId(payload.id);

    if (!user) {
      log(`No user found with Telegram ID ${payload.id}, creating one`, 'auth');
      user = await storage.createUser({
        telegramId: payload.id,
        telegramUsername: payload.username,
        coins: 5000,
      });
    } else {
      log(`Found existing user with Telegram ID ${payload.id}`, 'auth');
    }

    // ✅ Save user ID in session
    if (req.session) {
      req.session.userId = user.id;
      log(`Stored user ID ${user.id} in session`, 'auth');
    }

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
