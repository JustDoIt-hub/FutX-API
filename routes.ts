// import type { Express } from "express";
// import { Request, Response } from "express";
// import { createServer, type Server } from "http";
// import { storage } from "./storage";
// import session from "express-session";
// import memorystore from "memorystore";
// import { WebSocketServer, WebSocket } from "ws";

// // Import controllers (✅ one time only)
// import { login, getCurrentUser, logout } from "./controllers/auth";
// import { getSpinOptions, performSpin, getRecentSpins, getUserPlayers } from "./controllers/spin";
// import { getUserTeams, createTeam, getTeamDetails, updateTeam, deleteTeam } from "./controllers/team";
// import { startMatch, getMatchHistory, getMatchDetails, handleMatchSimulation } from "./controllers/match";
// import { 
//   createTournament, 
//   getTournaments,
//   getTournamentDetails,
//   joinTournament,
//   leaveTournament,
//   startTournament,
//   recordTournamentMatchResult
// } from "./controllers/tournament";

// const MemoryStore = memorystore(session);
// const activeConnections = new Map<number, WebSocket>();

// export async function registerRoutes(app: Express): Promise<Server> {
//   const httpServer = createServer(app);

//   const sessionMiddleware = session({
//     name: 'fut.draft.session',
//     store: new MemoryStore({
//       checkPeriod: 86400000,
//     }),
//     secret: process.env.SESSION_SECRET || "fut-draft-secret",
//     resave: false,
//     saveUninitialized: false,
//     cookie: {
//       secure: false,
//       httpOnly: true,
//       maxAge: 7 * 24 * 60 * 60 * 1000,
//       sameSite: 'lax',
//       path: '/'
//     },
//   });

//   app.use(sessionMiddleware);

//   // ✅ Register HTTP routes INSIDE the function, after `app` exists.
//   app.get('/api/auth/telegram',login)
//   app.get('/api/auth/me', getCurrentUser);
//   app.post('/api/auth/logout', logout);

//   // Spin
//   app.get('/api/spin/options', getSpinOptions);
//   app.post('/api/spin', performSpin);
//   app.get('/api/spin/recent', getRecentSpins);

//   // Players
//   app.get('/api/players', getUserPlayers);

//   // Teams
//   app.get('/api/teams', getUserTeams);
//   app.post('/api/teams', createTeam);
//   app.get('/api/teams/:id', getTeamDetails);
//   app.put('/api/teams/:id', updateTeam);
//   app.delete('/api/teams/:id', deleteTeam);

//   // Matches
//   app.post('/api/matches/start', startMatch);
//   app.get('/api/matches', getMatchHistory);
//   app.get('/api/matches/:id', getMatchDetails);

//   // Tournaments
//   app.get('/api/tournaments', getTournaments);
//   app.post('/api/tournaments', createTournament);
//   app.get('/api/tournaments/:id', getTournamentDetails);
//   app.post('/api/tournaments/:id/join', joinTournament);
//   app.post('/api/tournaments/:id/leave', leaveTournament);
//   app.post('/api/tournaments/:id/start', startTournament);
//   app.post('/api/tournaments/:id/match/:round/:matchPosition', recordTournamentMatchResult);

//   // WebSocket
//   const wss = new WebSocketServer({ 
//     server: httpServer, 
//     path: '/ws',
//   });

//   console.log('WebSocket server initialized', 'websocket');

//   wss.on('connection', (ws: WebSocket) => {
//     console.log('New WebSocket connection established', 'websocket');
//     (ws as any).userId = null;

//     ws.on('message', (messageData: string) => {
//       try {
//         console.log(`Received WebSocket message: ${messageData}`, 'websocket');
//         const data = JSON.parse(messageData);

//         if (data.type === 'authenticate' && data.userId) {
//           const userId = Number(data.userId);
//           console.log(`User ${userId} authenticated via WebSocket`, 'websocket');
//           (ws as any).userId = userId;
//           activeConnections.set(userId, ws);

//           ws.send(JSON.stringify({
//             type: 'auth_success',
//             message: 'Authentication successful'
//           }));

//         } else if (data.type === 'start_match' && data.userId && data.teamId) {
//           const userId = Number(data.userId);
//           const teamId = Number(data.teamId);

//           console.log(`Starting match simulation for user ${userId}, team ${teamId}`, 'websocket');
//           handleMatchSimulation(ws, userId, teamId);

//         } else {
//           console.log(`Unknown message type: ${data.type}`, 'websocket');
//           ws.send(JSON.stringify({ 
//             type: 'error', 
//             message: 'Unknown message type'
//           }));
//         }

//       } catch (error) {
//         console.log(`WebSocket message parsing error: ${error instanceof Error ? error.message : String(error)}`, 'websocket');
//         ws.send(JSON.stringify({ 
//           type: 'error', 
//           message: 'Invalid message format' 
//         }));
//       }
//     });

//     ws.on('close', () => {
//       const userId = (ws as any).userId;
//       if (userId) {
//         console.log(`WebSocket connection closed for user ${userId}`, 'websocket');
//         activeConnections.delete(userId);
//       } else {
//         console.log('WebSocket connection closed (unauthenticated)', 'websocket');
//       }
//     });

//     ws.on('error', (error) => {
//       console.log(`WebSocket error: ${error.message}`, 'websocket');
//     });

//     ws.send(JSON.stringify({ 
//       type: 'connected', 
//       message: 'Connected to FUT Draft WebSocket server' 
//     }));
//   });

//   return httpServer
// }




import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import memorystore from "memorystore";
import { WebSocketServer, WebSocket } from "ws";

// Import controllers
import { login, getCurrentUser, logout } from "./controllers/auth";
import { getSpinOptions, performSpin, getRecentSpins, getUserPlayers } from "./controllers/spin";
import { getUserTeams, createTeam, getTeamDetails, updateTeam, deleteTeam } from "./controllers/team";
import { startMatch, getMatchHistory, getMatchDetails, handleMatchSimulation } from "./controllers/match";
import { 
  createTournament, 
  getTournaments,
  getTournamentDetails,
  joinTournament,
  leaveTournament,
  startTournament,
  recordTournamentMatchResult
} from "./controllers/tournament";

const MemoryStore = memorystore(session);
const activeConnections = new Map<number, WebSocket>();

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  const sessionMiddleware = session({
    name: 'fut.draft.session',
    store: new MemoryStore({
      checkPeriod: 86400000, // Clear expired sessions daily
    }),
    secret: process.env.SESSION_SECRET || "fut-draft-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // Set to true in production
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
      sameSite: 'lax',
    },
  });

  app.use(sessionMiddleware);

  // User Authentication Routes
  app.get('/api/auth/login', login);
  app.get('/api/auth/me', getCurrentUser);
  app.post('/api/auth/logout', logout);

  // Spin Routes
  app.get('/api/spin/options', getSpinOptions);
  app.post('/api/spin', performSpin);
  app.get('/api/spin/recent', getRecentSpins);

  // Players Routes
  app.get('/api/players', getUserPlayers);

  // Teams Routes
  app.get('/api/teams', getUserTeams);
  app.post('/api/teams', createTeam);
  app.get('/api/teams/:id', getTeamDetails);
  app.put('/api/teams/:id', updateTeam);
  app.delete('/api/teams/:id', deleteTeam);

  // Matches Routes
  app.post('/api/matches/start', startMatch);
  app.get('/api/matches', getMatchHistory);
  app.get('/api/matches/:id', getMatchDetails);

  // Tournaments Routes
  app.get('/api/tournaments', getTournaments);
  app.post('/api/tournaments', createTournament);
  app.get('/api/tournaments/:id', getTournamentDetails);
  app.post('/api/tournaments/:id/join', joinTournament);
  app.post('/api/tournaments/:id/leave', leaveTournament);
  app.post('/api/tournaments/:id/start', startTournament);
  app.post('/api/tournaments/:id/match/:round/:matchPosition', recordTournamentMatchResult);

  // WebSocket Server
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
  });

  console.log('WebSocket server initialized', 'websocket');

  wss.on('connection', (ws: WebSocket) => {
    console.log('New WebSocket connection established', 'websocket');

    ws.on('message', (messageData: string) => {
      try {
        const data = JSON.parse(messageData);

        if (data.type === 'authenticate' && data.userId) {
          const userId = Number(data.userId);
          console.log(`User ${userId} authenticated via WebSocket`, 'websocket');
          (ws as any).userId = userId;
          activeConnections.set(userId, ws);

          ws.send(JSON.stringify({
            type: 'auth_success',
            message: 'Authentication successful',
          }));
        } else if (data.type === 'start_match' && data.userId && data.teamId) {
          const userId = Number(data.userId);
          const teamId = Number(data.teamId);
          handleMatchSimulation(ws, userId, teamId);
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      const userId = (ws as any).userId;
      if (userId) {
        activeConnections.delete(userId);
        console.log(`WebSocket connection closed for user ${userId}`, 'websocket');
      }
    });
  });

  return httpServer;
}

