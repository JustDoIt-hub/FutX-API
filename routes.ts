import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import memorystore from "memorystore";
import { WebSocketServer, WebSocket } from "ws";
import { log } from "./vite";

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

// Store active WebSocket connections with their userId
const activeConnections = new Map<number, WebSocket>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Set up session middleware with a memorable session name
  const sessionMiddleware = session({
    name: 'fut.draft.session',
    store: new MemoryStore({
      checkPeriod: 86400000, // Prune expired entries every 24h
    }),
    secret: process.env.SESSION_SECRET || "fut-draft-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to false for development, true for production
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax', // Allow cookies to be sent with cross-site requests
      path: '/' // Ensure cookie is available for all paths
    },
  });
  
  app.use(sessionMiddleware);
  
  // Set up WebSocket server for match simulation
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
  });
  
  log('WebSocket server initialized', 'websocket');
  
  wss.on('connection', (ws: WebSocket) => {
    log('New WebSocket connection established', 'websocket');
    
    // Set a userId property on the WebSocket object
    (ws as any).userId = null;
    
    ws.on('message', (messageData: string) => {
      try {
        log(`Received WebSocket message: ${messageData}`, 'websocket');
        const data = JSON.parse(messageData);
        
        // Handle authentication
        if (data.type === 'authenticate' && data.userId) {
          const userId = Number(data.userId);
          log(`User ${userId} authenticated via WebSocket`, 'websocket');
          
          // Store the WebSocket connection with userId
          (ws as any).userId = userId;
          activeConnections.set(userId, ws);
          
          ws.send(JSON.stringify({
            type: 'auth_success',
            message: 'Authentication successful'
          }));
        } 
        // Handle match simulation request
        else if (data.type === 'start_match' && data.userId && data.teamId) {
          const userId = Number(data.userId);
          const teamId = Number(data.teamId);
          
          log(`Starting match simulation for user ${userId}, team ${teamId}`, 'websocket');
          handleMatchSimulation(ws, userId, teamId);
        }
        else {
          log(`Unknown message type: ${data.type}`, 'websocket');
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Unknown message type'
          }));
        }
      } catch (error) {
        log(`WebSocket message parsing error: ${error instanceof Error ? error.message : String(error)}`, 'websocket');
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid message format' 
        }));
      }
    });
    
    ws.on('close', () => {
      // Remove connection from active connections
      const userId = (ws as any).userId;
      if (userId) {
        log(`WebSocket connection closed for user ${userId}`, 'websocket');
        activeConnections.delete(userId);
      } else {
        log('WebSocket connection closed (unauthenticated)', 'websocket');
      }
    });
    
    ws.on('error', (error) => {
      log(`WebSocket error: ${error.message}`, 'websocket');
    });
    
    // Send initial connection confirmation
    ws.send(JSON.stringify({ 
      type: 'connected', 
      message: 'Connected to FUT Draft WebSocket server' 
    }));
  });
  
  // Authentication routes
  app.post('/api/auth/login', login);
  app.get('/api/auth/me', getCurrentUser);
  app.post('/api/auth/logout', logout);
  
  // Spin routes
  app.get('/api/spin/options', getSpinOptions);
  app.post('/api/spin', performSpin);
  app.get('/api/spin/recent', getRecentSpins);
  
  // Player collection routes
  app.get('/api/players', getUserPlayers);
  
  // Team management routes
  app.get('/api/teams', getUserTeams);
  app.post('/api/teams', createTeam);
  app.get('/api/teams/:id', getTeamDetails);
  app.put('/api/teams/:id', updateTeam);
  app.delete('/api/teams/:id', deleteTeam);
  
  // Match routes
  app.post('/api/matches/start', startMatch);
  app.get('/api/matches', getMatchHistory);
  app.get('/api/matches/:id', getMatchDetails);
  
  // Tournament routes
  app.get('/api/tournaments', getTournaments);
  app.post('/api/tournaments', createTournament);
  app.get('/api/tournaments/:id', getTournamentDetails);
  app.post('/api/tournaments/:id/join', joinTournament);
  app.post('/api/tournaments/:id/leave', leaveTournament);
  app.post('/api/tournaments/:id/start', startTournament);
  app.post('/api/tournaments/:id/match/:round/:matchPosition', recordTournamentMatchResult);
  
  return httpServer;
}
