import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { MongoDBStorage } from "./mongodb-storage";
import { 
  insertAdminSchema,
  insertResellerSchema, 
  insertKeySchema, 
  keyVerificationSchema, 
  addCreditsSchema,
  gameEnum,
  insertOnlineUpdateSchema,
  updateOnlineUpdateSchema
} from "@shared/schema";
import { nanoid } from "nanoid";
import session from "express-session";
import MemoryStore from "memorystore";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import fs from "fs";
import path from "path";

// Initialize MongoDB storage
const storage = new MongoDBStorage();

// WebSocket clients storage - mapping reseller IDs to their WebSocket connections
const resellerConnections = new Map<number, Set<any>>();

export async function registerRoutes(app: Express): Promise<Server> {
  // MongoDB storage handles all data persistence

  // Set up session middleware
  const SessionStore = MemoryStore(session);
  
  // Check if we're in a production environment
  const isProduction = process.env.NODE_ENV === "production";
  
  console.log("Session configuration:", {
    production: isProduction,
    secureCookie: process.env.COOKIE_SECURE,
    sameSiteCookie: process.env.COOKIE_SAME_SITE
  });
  
  // Set up session with different options based on environment
  const isSecure = process.env.COOKIE_SECURE === "true" || isProduction;
  
  // For SameSite configuration
  // Use 'lax' for better CSRF protection - blocks cross-site requests with credentials
  // while still allowing same-site requests and top-level navigation
  const sameSiteOption: boolean | 'lax' | 'strict' | 'none' | undefined = 'lax';

  // Handle domain for production
  const cookieDomain = isProduction && process.env.PUBLIC_URL 
    ? new URL(process.env.PUBLIC_URL).hostname 
    : undefined;

  // Set up session config
  const sessionConfig: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "keymaster-secret",
    // Setting resave to true to ensure session stays alive
    resave: true, 
    // We need this for the initial session to be saved
    saveUninitialized: true,
    store: new SessionStore({
      checkPeriod: 86400000 // 24 hours
    }),
    cookie: {
      // Must be false for localhost, true for production HTTPS
      secure: isSecure,
      
      // Set to a longer max age (7 days)
      maxAge: 7 * 24 * 60 * 60 * 1000,
      
      // Standard path
      path: "/",
      
      // Set domain conditionally (only in production)
      ...(cookieDomain ? { domain: cookieDomain } : {}),
      
      // Handle sameSite setting
      sameSite: sameSiteOption,
      
      // Secure cookie access - prevent XSS attacks
      httpOnly: true
    },
    // Add proxy trust for production environments
    proxy: isProduction
  };
  
  // Log session configuration
  console.log("Applied session cookie configuration:", {
    secure: sessionConfig.cookie?.secure,
    sameSite: sessionConfig.cookie?.sameSite,
    domain: sessionConfig.cookie?.domain,
    httpOnly: sessionConfig.cookie?.httpOnly,
    production: isProduction
  });
  
  app.use(session(sessionConfig));

  // Set up passport authentication
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure passport strategies
  passport.use('admin', new LocalStrategy(async (username, password, done) => {
    try {
      const isValid = await storage.verifyAdminPassword(username, password);
      if (!isValid) {
        return done(null, false, { message: 'Incorrect username or password' });
      }
      const admin = await storage.getAdminByUsername(username);
      if (!admin) {
        return done(null, false, { message: 'Incorrect username or password' });
      }
      return done(null, { id: admin.id, username: admin.username, role: 'admin' });
    } catch (err) {
      return done(err);
    }
  }));

  passport.use('reseller', new LocalStrategy(async (username, password, done) => {
    try {
      const isValid = await storage.verifyResellerPassword(username, password);
      if (!isValid) {
        return done(null, false, { message: 'Incorrect username or password' });
      }
      const reseller = await storage.getResellerByUsername(username);
      if (!reseller) {
        return done(null, false, { message: 'Incorrect username or password' });
      }
      if (!reseller.isActive) {
        return done(null, false, { message: 'Account is suspended' });
      }
      return done(null, { id: reseller.id, username: reseller.username, role: 'reseller' });
    } catch (err) {
      return done(err);
    }
  }));

  passport.serializeUser((user: any, done) => {
    console.log("Serializing user:", user);
    done(null, JSON.stringify(user));
  });

  passport.deserializeUser((serializedUser: string, done) => {
    try {
      const user = JSON.parse(serializedUser);
      console.log("Deserialized user:", user);
      done(null, user);
    } catch (error) {
      console.error("Error deserializing user:", error);
      done(error, null);
    }
  });

  // Auth middleware
  const isAuthenticated = (req: Request, res: Response, next: Function) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: 'Unauthorized' });
  };

  const isAdmin = (req: Request, res: Response, next: Function) => {
    if (req.isAuthenticated() && (req.user as any).role === 'admin') {
      return next();
    }
    res.status(403).json({ message: 'Forbidden' });
  };

  const isReseller = (req: Request, res: Response, next: Function) => {
    if (req.isAuthenticated() && (req.user as any).role === 'reseller') {
      return next();
    }
    res.status(403).json({ message: 'Forbidden' });
  };

  // CSRF protection middleware for admin write endpoints
  const csrfProtection = (req: Request, res: Response, next: Function) => {
    // Get the expected origin from environment or default to the request host
    const isProduction = process.env.NODE_ENV === "production";
    let expectedOrigin: string;
    
    if (isProduction && process.env.PUBLIC_URL) {
      expectedOrigin = process.env.PUBLIC_URL.replace(/\/$/, ''); // Remove trailing slash
    } else {
      // In development, construct from request
      expectedOrigin = `${req.protocol}://${req.get('host')}`;
    }
    
    // Check Origin header first (preferred)
    const origin = req.get('Origin');
    if (origin) {
      if (origin !== expectedOrigin) {
        console.warn(`CSRF: Invalid origin - expected: ${expectedOrigin}, received: ${origin}`);
        return res.status(403).json({ message: 'Forbidden: Invalid origin' });
      }
    } else {
      // Fallback to Referer header if Origin is not present
      const referer = req.get('Referer');
      if (!referer) {
        console.warn('CSRF: No Origin or Referer header found');
        return res.status(403).json({ message: 'Forbidden: No origin header' });
      }
      
      try {
        const refererUrl = new URL(referer);
        const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
        
        if (refererOrigin !== expectedOrigin) {
          console.warn(`CSRF: Invalid referer - expected: ${expectedOrigin}, received: ${refererOrigin}`);
          return res.status(403).json({ message: 'Forbidden: Invalid referer' });
        }
      } catch (error) {
        console.warn('CSRF: Invalid referer header format');
        return res.status(403).json({ message: 'Forbidden: Invalid referer format' });
      }
    }
    
    next();
  };

  // Combined middleware for admin write operations (CSRF + auth)
  const adminWriteProtection = [isAdmin, csrfProtection];

  // Function to log authentication process
  const logAuthProcess = (method: string, user: any, session: any) => {
    console.log(`==== Auth process for ${method} ====`);
    console.log('User:', user);
    console.log('Session ID:', session?.id);
    console.log('Session cookie:', session?.cookie);
    console.log('==== End auth process ====');
  }

  // Auth routes
  app.post('/api/auth/admin/login', (req, res, next) => {
    console.log('Admin login attempt:', req.body.username);
    
    passport.authenticate('admin', (err, user, info) => {
      if (err) {
        console.error('Auth error:', err);
        return next(err);
      }
      if (!user) {
        console.log('Auth failed:', info.message);
        return res.status(401).json({ message: info.message });
      }
      
      req.logIn(user, (err) => {
        if (err) {
          console.error('Login error:', err);
          return next(err);
        }
        
        logAuthProcess('admin', user, req.session);
        return res.json({ user });
      });
    })(req, res, next);
  });

  app.post('/api/auth/reseller/login', (req, res, next) => {
    console.log('Reseller login attempt:', req.body.username);
    
    passport.authenticate('reseller', (err, user, info) => {
      if (err) {
        console.error('Auth error:', err);
        return next(err);
      }
      if (!user) {
        console.log('Auth failed:', info.message);
        return res.status(401).json({ message: info.message });
      }
      
      req.logIn(user, (err) => {
        if (err) {
          console.error('Login error:', err);
          return next(err);
        }
        
        logAuthProcess('reseller', user, req.session);
        return res.json({ user });
      });
    })(req, res, next);
  });

  app.post('/api/auth/logout', (req, res) => {
    req.logout(() => {
      res.json({ success: true });
    });
  });

  app.get('/api/auth/session', (req, res) => {
    // Security: Session check without logging sensitive cookie data
    console.log("Session check:", {
      isAuthenticated: req.isAuthenticated(),
      user: req.user || null,
      sessionID: req.sessionID
    });
    
    if (req.isAuthenticated()) {
      res.json({ isAuthenticated: true, user: req.user });
    } else {
      res.json({ isAuthenticated: false });
    }
  });
  
  // Debug endpoint for checking session state (production-safe)
  app.get('/api/auth/debug', (req, res) => {
    res.json({
      isAuthenticated: req.isAuthenticated(),
      sessionID: req.sessionID,
      user: req.user || null,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    });
  });
  
  // Simple test endpoint that doesn't require authentication
  app.get('/api/test', (req, res) => {
    res.json({
      message: "API is working",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      sessionID: req.sessionID,
      hasCookies: !!req.headers.cookie
    });
  });

  // Registration route
  app.post('/api/auth/reseller/register', async (req, res) => {
    try {
      const resellerData = insertResellerSchema.parse(req.body);
      
      // Check if username exists
      const existingReseller = await storage.getResellerByUsername(resellerData.username);
      if (existingReseller) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      
      // Check if token exists and is not used
      const token = await storage.getToken(resellerData.referralToken);
      if (!token || token.isUsed) {
        return res.status(400).json({ message: 'Invalid or already used referral token' });
      }
      
      // Create reseller with additional credits from token
      const resellerWithCredits = {
        ...resellerData,
        credits: (token.credits || 0) // Add credits from token
      };
      const reseller = await storage.createReseller(resellerWithCredits);
      
      // Mark token as used
      await storage.useToken(resellerData.referralToken, resellerData.username);
      
      // Reseller creation successful - MongoDB storage handles all persistence
      
      res.status(201).json({ 
        success: true, 
        message: 'Registration successful',
        reseller: {
          id: reseller.id,
          username: reseller.username,
          credits: reseller.credits,
          registrationDate: reseller.registrationDate
        }
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  // Admin routes
  app.get('/api/admin/stats', isAdmin, async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/resellers', isAdmin, async (req, res) => {
    try {
      const resellers = await storage.getAllResellers();
      const resellersWithStats = await Promise.all(
        resellers.map(async (reseller) => {
          const keys = await storage.getKeysByResellerId(reseller.id);
          const now = new Date();
          const activeKeys = keys.filter(key => !key.isRevoked && new Date(key.expiryDate) > now).length;
          return {
            ...reseller,
            totalKeys: keys.length,
            activeKeys
          };
        })
      );
      res.json(resellersWithStats);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get all keys for a specific reseller (admin view)
  app.get('/api/admin/resellers/:id/keys', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const resellerId = parseInt(req.params.id);
      if (isNaN(resellerId)) {
        return res.status(400).json({ message: 'Invalid reseller ID' });
      }
      
      const keys = await storage.getKeysByResellerId(resellerId);
      
      // Get device counts for each key
      const keysWithDevices = await Promise.all(keys.map(async key => {
        const devices = await storage.getDevicesByKeyId(key.id);
        const now = new Date();
        let status = key.isRevoked ? "REVOKED" : 
                    (new Date(key.expiryDate) <= now ? "EXPIRED" : "ACTIVE");
        
        return {
          ...key,
          deviceCount: devices.length,
          status,
          devices: devices
        };
      }));
      
      res.json(keysWithDevices);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Admin route to revoke/delete a key
  app.delete('/api/admin/keys/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const keyId = parseInt(req.params.id);
      if (isNaN(keyId)) {
        return res.status(400).json({ message: 'Invalid key ID' });
      }
      
      const revokedKey = await storage.revokeKey(keyId);
      if (!revokedKey) {
        return res.status(404).json({ message: 'Key not found' });
      }
      
      res.json({ success: true, message: 'Key revoked successfully', key: revokedKey });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/resellers/credits', isAdmin, async (req, res) => {
    try {
      const { resellerId, amount } = addCreditsSchema.parse(req.body);
      
      const reseller = await storage.getReseller(resellerId);
      if (!reseller) {
        return res.status(404).json({ message: 'Reseller not found' });
      }
      
      const updatedReseller = await storage.updateResellerCredits(resellerId, amount);
      res.json({
        success: true,
        reseller: updatedReseller
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post('/api/admin/resellers/:id/toggle-status', isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isActive } = req.body;
      
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: 'isActive must be a boolean' });
      }
      
      const reseller = await storage.getReseller(id);
      if (!reseller) {
        return res.status(404).json({ message: 'Reseller not found' });
      }
      
      const updatedReseller = await storage.updateResellerStatus(id, isActive);
      
      // Notify the reseller in real-time about the status change
      notifyResellerStatusChange(id, isActive);
      
      res.json({
        success: true,
        reseller: updatedReseller
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/tokens/generate', isAdmin, async (req, res) => {
    try {
      const { credits } = req.body;
      
      // Validate credits
      if (credits !== undefined && (typeof credits !== 'number' || credits < 0 || !Number.isInteger(credits))) {
        return res.status(400).json({ message: 'Credits must be a non-negative integer' });
      }
      
      const token = await storage.createToken(credits || 0);
      res.status(201).json({
        success: true,
        token
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/tokens', isAdmin, async (req, res) => {
    try {
      const tokens = await storage.getAllTokens();
      res.json(tokens);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin key generation
  app.post('/api/admin/keys/generate', isAdmin, async (req, res) => {
    try {
      const { game, deviceLimit, expiryDate, count = 1, keyString } = req.body;
      
      console.log('🔥 ADMIN KEY GENERATION DEBUG:');
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      console.log('Extracted values:', { game, deviceLimit, expiryDate, count, keyString });
      
      // Validate input
      if (!game || !deviceLimit || !expiryDate) {
        return res.status(400).json({ message: 'Missing required fields: game, deviceLimit, expiryDate' });
      }
      
      // Validate game selection
      const validGames = ['PUBG MOBILE', 'LAST ISLAND OF SURVIVAL', 'FREE FIRE'];
      if (!validGames.includes(game)) {
        return res.status(400).json({ message: 'Invalid game selection' });
      }
      
      // Check if custom key already exists (if provided)
      if (keyString) {
        console.log('Checking if custom key exists:', keyString);
        const existingKey = await storage.getKey(keyString);
        if (existingKey) {
          console.log('Custom key already exists!');
          return res.status(400).json({ message: 'This key already exists' });
        }
        console.log('Custom key is available');
      }
      
      const createdKeys = [];
      console.log(`Starting to create ${count} keys...`);
      
      for (let i = 0; i < count; i++) {
        // Use custom key for first iteration if provided, otherwise generate random key
        const finalKeyString = i === 0 && keyString ? keyString : generateKeyString(game);
        console.log(`Key ${i + 1}/${count}: Using keyString "${finalKeyString}"`);
        
        const keyData = {
          keyString: finalKeyString,
          game,
          resellerId: 0, // Admin keys use resellerId = 0
          deviceLimit: parseInt(deviceLimit),
          expiryDate: new Date(expiryDate)
        };
        
        console.log(`Creating key ${i + 1} with data:`, keyData);
        const newKey = await storage.createKey(keyData);
        console.log(`Created key ${i + 1}:`, newKey);
        createdKeys.push(newKey);
      }
      
      console.log(`✅ Successfully created ${createdKeys.length} keys`);
      console.log('All created keys:', createdKeys.map(k => k.keyString));
      
      const response = { 
        success: true,
        message: `Generated ${createdKeys.length} admin key(s) for ${game}`,
        keys: createdKeys
      };
      
      console.log('Sending response:', JSON.stringify(response, null, 2));
      res.status(201).json(response);
    } catch (error) {
      console.error('Admin key generation error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get admin keys
  app.get('/api/admin/keys', isAdmin, async (req, res) => {
    try {
      const adminKeys = await storage.getAdminKeys();
      
      // Add device information for each key
      const keysWithDevices = await Promise.all(
        adminKeys.map(async (key) => {
          const devices = await storage.getDevicesByKeyId(key.id);
          return {
            ...key,
            deviceCount: devices.length,
            devices
          };
        })
      );
      
      res.json(keysWithDevices);
    } catch (error) {
      console.error('Error getting admin keys:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get admin keys with enhanced filtering
  app.get('/api/admin/keys/manage', isAdmin, async (req, res) => {
    try {
      const { search, game, status, page = 1, limit = 20 } = req.query;
      
      let adminKeys = await storage.getAdminKeys();
      
      // Add device information and status for each key
      const keysWithDevices = await Promise.all(
        adminKeys.map(async (key) => {
          const devices = await storage.getDevicesByKeyId(key.id);
          const now = new Date();
          let keyStatus = key.isRevoked ? "REVOKED" : 
                        (new Date(key.expiryDate) <= now ? "EXPIRED" : "ACTIVE");
          
          return {
            ...key,
            deviceCount: devices.length,
            devices,
            status: keyStatus,
            daysRemaining: keyStatus === "ACTIVE" ? 
              Math.max(0, Math.ceil((new Date(key.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0
          };
        })
      );
      
      // Apply filters
      let filteredKeys = keysWithDevices;
      
      if (search) {
        const searchLower = search.toString().toLowerCase();
        filteredKeys = filteredKeys.filter(key => 
          key.keyString.toLowerCase().includes(searchLower) ||
          key.game.toLowerCase().includes(searchLower)
        );
      }
      
      if (game && game !== 'all') {
        filteredKeys = filteredKeys.filter(key => key.game === game);
      }
      
      if (status && status !== 'all') {
        filteredKeys = filteredKeys.filter(key => key.status === status);
      }
      
      // Pagination
      const pageNum = parseInt(page.toString());
      const limitNum = parseInt(limit.toString());
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      
      const paginatedKeys = filteredKeys.slice(startIndex, endIndex);
      
      res.json({
        keys: paginatedKeys,
        totalCount: filteredKeys.length,
        currentPage: pageNum,
        totalPages: Math.ceil(filteredKeys.length / limitNum),
        hasNextPage: endIndex < filteredKeys.length,
        hasPrevPage: pageNum > 1
      });
    } catch (error) {
      console.error('Error getting admin keys for management:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get key details by ID
  app.get('/api/admin/keys/:id/details', isAdmin, async (req, res) => {
    try {
      const keyId = parseInt(req.params.id);
      if (isNaN(keyId)) {
        return res.status(400).json({ message: 'Invalid key ID' });
      }
      
      const key = await storage.getKeyById(keyId);
      if (!key) {
        return res.status(404).json({ message: 'Key not found' });
      }
      
      const devices = await storage.getDevicesByKeyId(key.id);
      const now = new Date();
      let keyStatus = key.isRevoked ? "REVOKED" : 
                    (new Date(key.expiryDate) <= now ? "EXPIRED" : "ACTIVE");
      
      const keyDetails = {
        ...key,
        deviceCount: devices.length,
        devices,
        status: keyStatus,
        daysRemaining: keyStatus === "ACTIVE" ? 
          Math.max(0, Math.ceil((new Date(key.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0,
        usagePercentage: Math.min(100, (devices.length / key.deviceLimit) * 100)
      };
      
      res.json(keyDetails);
    } catch (error) {
      console.error('Error getting key details:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Reset all devices for all keys
  app.post('/api/admin/keys/reset-devices', isAdmin, async (req, res) => {
    try {
      const result = await storage.resetAllDevices();
      
      res.json({
        success: true,
        message: `Successfully reset ${result.resetCount} device associations`,
        resetCount: result.resetCount
      });
    } catch (error) {
      console.error('Error resetting all devices:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Database backup routes - MongoDB Collections
  app.get('/api/admin/backup/collections', isAdmin, async (req, res) => {
    try {
      // Import MongoDB models
      const { Admin } = await import('./models/Admin');
      const { Reseller } = await import('./models/Reseller');
      const { Key } = await import('./models/Key');
      const { Token } = await import('./models/Token');
      const { Device } = await import('./models/Device');
      const { OnlineUpdate } = await import('./models/OnlineUpdate');

      // Get document counts for each collection
      const [adminsCount, resellersCount, keysCount, tokensCount, devicesCount, updatesCount] = await Promise.all([
        Admin.countDocuments(),
        Reseller.countDocuments(),
        Key.countDocuments(),
        Token.countDocuments(),
        Device.countDocuments(),
        OnlineUpdate.countDocuments()
      ]);

      // Get latest update timestamps
      const [latestAdmin, latestReseller, latestKey, latestToken, latestDevice, latestUpdate] = await Promise.all([
        Admin.findOne().sort({ createdAt: -1 }),
        Reseller.findOne().sort({ createdAt: -1 }),
        Key.findOne().sort({ createdAt: -1 }),
        Token.findOne().sort({ createdAt: -1 }),
        Device.findOne().sort({ createdAt: -1 }),
        OnlineUpdate.findOne().sort({ createdAt: -1 })
      ]);

      const collections = [
        {
          name: 'admins.json',
          collectionName: 'admins',
          size: adminsCount * 150, // Approximate size
          count: adminsCount,
          modified: latestAdmin ? latestAdmin.createdAt : new Date(),
          downloadUrl: '/api/admin/backup/download/admins.json'
        },
        {
          name: 'resellers.json',
          collectionName: 'resellers',
          size: resellersCount * 200, // Approximate size
          count: resellersCount,
          modified: latestReseller ? latestReseller.createdAt : new Date(),
          downloadUrl: '/api/admin/backup/download/resellers.json'
        },
        {
          name: 'keys.json',
          collectionName: 'keys',
          size: keysCount * 180, // Approximate size
          count: keysCount,
          modified: latestKey ? latestKey.createdAt : new Date(),
          downloadUrl: '/api/admin/backup/download/keys.json'
        },
        {
          name: 'tokens.json',
          collectionName: 'tokens',
          size: tokensCount * 120, // Approximate size
          count: tokensCount,
          modified: latestToken ? latestToken.createdAt : new Date(),
          downloadUrl: '/api/admin/backup/download/tokens.json'
        },
        {
          name: 'devices.json',
          collectionName: 'devices',
          size: devicesCount * 100, // Approximate size
          count: devicesCount,
          modified: latestDevice ? latestDevice.createdAt : new Date(),
          downloadUrl: '/api/admin/backup/download/devices.json'
        },
        {
          name: 'online_updates.json',
          collectionName: 'online_updates',
          size: updatesCount * 250, // Approximate size
          count: updatesCount,
          modified: latestUpdate ? latestUpdate.createdAt : new Date(),
          downloadUrl: '/api/admin/backup/download/online_updates.json'
        }
      ];
      
      res.json(collections);
    } catch (error) {
      console.error('Error fetching collections:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/backup/download/:filename', isAdmin, async (req, res) => {
    try {
      const filename = req.params.filename;
      
      // Define allowed collections
      const allowedCollections = [
        'admins.json',
        'resellers.json',
        'keys.json',
        'tokens.json',
        'devices.json',
        'online_updates.json'
      ];
      
      // Security check
      if (!allowedCollections.includes(filename)) {
        return res.status(404).json({ message: 'Collection not found' });
      }
      
      // Import MongoDB models
      const { Admin } = await import('./models/Admin');
      const { Reseller } = await import('./models/Reseller');
      const { Key } = await import('./models/Key');
      const { Token } = await import('./models/Token');
      const { Device } = await import('./models/Device');
      const { OnlineUpdate } = await import('./models/OnlineUpdate');
      
      let data;
      let collectionName;
      
      switch (filename) {
        case 'admins.json':
          data = await Admin.find({}).select('-__v -password').lean();
          collectionName = 'admins';
          break;
        case 'resellers.json':
          data = await Reseller.find({}).select('-__v -password').lean();
          collectionName = 'resellers';
          break;
        case 'keys.json':
          data = await Key.find({}).select('-__v').lean();
          collectionName = 'keys';
          break;
        case 'tokens.json':
          data = await Token.find({}).select('-__v').lean();
          collectionName = 'tokens';
          break;
        case 'devices.json':
          data = await Device.find({}).select('-__v').lean();
          collectionName = 'devices';
          break;
        case 'online_updates.json':
          data = await OnlineUpdate.find({}).select('-__v').lean();
          collectionName = 'online_updates';
          break;
        default:
          return res.status(404).json({ message: 'Collection not found' });
      }
      
      // Format the response with metadata
      const exportData = {
        collection: collectionName,
        exportDate: new Date().toISOString(),
        totalRecords: data.length,
        data: data
      };
      
      // Set headers for file download
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFilename}"`);
      
      // Send the data as JSON
      res.json(exportData);
      
    } catch (error: any) {
      console.error('Download error:', error);
      res.status(500).json({ message: error.message || 'Failed to download collection' });
    }
  });

  app.get('/api/admin/backup/download-all', isAdmin, async (req, res) => {
    try {
      // Import MongoDB models
      const { Admin } = await import('./models/Admin');
      const { Reseller } = await import('./models/Reseller');
      const { Key } = await import('./models/Key');
      const { Token } = await import('./models/Token');
      const { Device } = await import('./models/Device');
      const { OnlineUpdate } = await import('./models/OnlineUpdate');
      
      // Fetch all data from MongoDB collections (excluding sensitive fields)
      const [admins, resellers, keys, tokens, devices, onlineUpdates] = await Promise.all([
        Admin.find({}).select('-__v -password').lean(),
        Reseller.find({}).select('-__v -password').lean(),
        Key.find({}).select('-__v').lean(),
        Token.find({}).select('-__v').lean(),
        Device.find({}).select('-__v').lean(),
        OnlineUpdate.find({}).select('-__v').lean()
      ]);
      
      // Create combined backup object
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archiveName = `dexter-complete-backup-${timestamp}.json`;
      
      const backup = {
        exportDate: new Date().toISOString(),
        databaseType: 'MongoDB',
        collections: {
          admins: {
            totalRecords: admins.length,
            data: admins
          },
          resellers: {
            totalRecords: resellers.length,
            data: resellers
          },
          keys: {
            totalRecords: keys.length,
            data: keys
          },
          tokens: {
            totalRecords: tokens.length,
            data: tokens
          },
          devices: {
            totalRecords: devices.length,
            data: devices
          },
          online_updates: {
            totalRecords: onlineUpdates.length,
            data: onlineUpdates
          }
        },
        summary: {
          totalCollections: 6,
          totalRecords: admins.length + resellers.length + keys.length + tokens.length + devices.length + onlineUpdates.length
        }
      };
      
      res.setHeader('Content-Disposition', `attachment; filename="${archiveName}"`);
      res.setHeader('Content-Type', 'application/json');
      res.json(backup);
    } catch (error: any) {
      console.error('Download all error:', error);
      res.status(500).json({ message: error.message || 'Failed to download all collections' });
    }
  });

  // Online Update routes
  app.get('/api/admin/online-updates', isAdmin, async (req, res) => {
    try {
      const updates = await storage.getAllOnlineUpdates();
      res.json(updates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/online-updates', adminWriteProtection, async (req, res) => {
    try {
      const updateData = insertOnlineUpdateSchema.parse(req.body);
      const update = await storage.createOnlineUpdate(updateData);
      res.status(201).json({
        success: true,
        update
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get('/api/admin/online-updates/:id', isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid update ID' });
      }
      
      const update = await storage.getOnlineUpdate(id);
      if (!update) {
        return res.status(404).json({ message: 'Update not found' });
      }
      
      res.json(update);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/admin/online-updates/:id', adminWriteProtection, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid update ID' });
      }
      
      const updateData = updateOnlineUpdateSchema.parse({ id, ...req.body });
      const update = await storage.updateOnlineUpdate(id, updateData);
      
      if (!update) {
        return res.status(404).json({ message: 'Update not found' });
      }
      
      res.json({
        success: true,
        update
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete('/api/admin/online-updates/:id', adminWriteProtection, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid update ID' });
      }
      
      const deleted = await storage.deleteOnlineUpdate(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Update not found' });
      }
      
      res.json({
        success: true,
        message: 'Update deleted successfully'
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public API for apps to fetch active updates
  app.get('/api/updates', async (req, res) => {
    try {
      const updates = await storage.getActiveOnlineUpdates();
      res.json(updates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reseller routes
  app.get('/api/reseller/profile', isReseller, async (req, res) => {
    try {
      const user = req.user as any;
      const reseller = await storage.getReseller(user.id);
      if (!reseller) {
        return res.status(404).json({ message: 'Reseller not found' });
      }
      
      const keys = await storage.getKeysByResellerId(reseller.id);
      const now = new Date();
      const activeKeys = keys.filter(key => !key.isRevoked && new Date(key.expiryDate) > now).length;
      const expiredKeys = keys.filter(key => !key.isRevoked && new Date(key.expiryDate) <= now).length;
      
      res.json({
        id: reseller.id,
        username: reseller.username,
        credits: reseller.credits,
        registrationDate: reseller.registrationDate,
        activeKeys,
        expiredKeys,
        totalKeys: keys.length
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/reseller/keys', isReseller, async (req, res) => {
    try {
      const user = req.user as any;
      const keys = await storage.getKeysByResellerId(user.id);
      
      // Get device count for each key
      const keysWithDevices = await Promise.all(
        keys.map(async (key) => {
          const devices = await storage.getDevicesByKeyId(key.id);
          const now = new Date();
          let status = key.isRevoked ? "REVOKED" : 
                      (new Date(key.expiryDate) <= now ? "EXPIRED" : "ACTIVE");
          
          return {
            ...key,
            devices: devices.length,
            status
          };
        })
      );
      
      res.json(keysWithDevices);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/reseller/keys/generate', isReseller, async (req, res) => {
    try {
      const user = req.user as any;
      
      // Log request data for debugging
      console.log("Incoming key generation request:", req.body);
      
      // Define server-side pricing tiers FIRST (security: validate before any processing)
      const TIER_PRICING = [
        { days: 5, credits: 0.5 },
        { days: 10, credits: 1 },
        { days: 20, credits: 2 },
        { days: 30, credits: 3 },
        { days: 60, credits: 6 },
      ];
      
      // Extract and validate tier from request (security: only accept tier identifier, not dates)
      const requestedDays = parseInt(req.body.days) || parseInt(req.body.dayTier);
      if (!requestedDays) {
        return res.status(400).json({ message: 'Day tier is required' });
      }
      
      // Find the matching tier (security: strict validation, no tolerance)
      const tier = TIER_PRICING.find(t => t.days === requestedDays);
      if (!tier) {
        return res.status(400).json({ 
          message: `Invalid license duration. Allowed durations are: ${TIER_PRICING.map(t => t.days + ' days').join(', ')}` 
        });
      }
      
      // Calculate expiryDate SERVER-SIDE only (security: never trust client-supplied dates)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + tier.days);
      
      console.log(`Server-calculated expiry: ${tier.days} days from now = ${expiryDate}`);
      
      // Build formData with server-calculated values
      let formData = { 
        ...req.body,
        expiryDate: expiryDate 
      };
      
      // Validate data with schema
      const keyData = insertKeySchema.parse(formData);
      
      // Log parsed data
      console.log("Parsed key data:", keyData);
      
      // Validate game enum
      try {
        gameEnum.parse(keyData.game);
      } catch (error) {
        return res.status(400).json({ message: 'Invalid game selection' });
      }
      
      // Check if custom key already exists
      if (keyData.keyString) {
        const existingKey = await storage.getKey(keyData.keyString);
        if (existingKey) {
          return res.status(400).json({ message: 'This key already exists' });
        }
      }
      
      // Check reseller credits
      const reseller = await storage.getReseller(user.id);
      if (!reseller) {
        return res.status(404).json({ message: 'Reseller not found' });
      }
      
      const count = req.body.count || 1;
      
      // tier was already found and validated above
      const creditCostPerKey = tier.credits;
      const totalCreditsNeeded = count * creditCostPerKey;
      
      console.log(`Credit calculation: ${count} keys × ${creditCostPerKey} credits/key (${tier.days} day tier) = ${totalCreditsNeeded} total credits needed`);
      console.log(`Reseller has ${reseller.credits} credits available`);
      
      if (reseller.credits < totalCreditsNeeded) {
        return res.status(400).json({ 
          message: `Insufficient credits. You need ${totalCreditsNeeded} credits but only have ${reseller.credits} credits available.` 
        });
      }
      
      // Generate keys
      const generatedKeys = [];
      for (let i = 0; i < count; i++) {
        const keyString = keyData.keyString || generateKeyString(keyData.game);
        const key = await storage.createKey({
          ...keyData,
          keyString: i === 0 ? keyString : generateKeyString(keyData.game),
          resellerId: user.id
        });
        generatedKeys.push(key);
      }
      
      // Deduct credits based on tier pricing
      await storage.updateResellerCredits(user.id, -totalCreditsNeeded);
      
      console.log(`Deducted ${totalCreditsNeeded} credits from reseller. New balance: ${reseller.credits - totalCreditsNeeded}`);
      
      // Keys successfully stored in MongoDB
      
      res.status(201).json({
        success: true,
        keys: generatedKeys,
        remainingCredits: reseller.credits - totalCreditsNeeded,
        creditsDeducted: totalCreditsNeeded
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post('/api/reseller/keys/:id/revoke', isReseller, async (req, res) => {
    try {
      const keyId = parseInt(req.params.id);
      const user = req.user as any;
      
      // Find the key
      const keys = await storage.getKeysByResellerId(user.id);
      const key = keys.find(k => k.id === keyId);
      
      if (!key) {
        return res.status(404).json({ message: 'Key not found or does not belong to you' });
      }
      
      // Revoke the key
      const revokedKey = await storage.revokeKey(keyId);
      
      res.json({
        success: true,
        key: revokedKey
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/reseller/keys/:id', isReseller, async (req, res) => {
    try {
      const keyId = parseInt(req.params.id);
      const user = req.user as any;
      
      // Find the key
      const keys = await storage.getKeysByResellerId(user.id);
      const key = keys.find(k => k.id === keyId);
      
      if (!key) {
        return res.status(404).json({ message: 'Key not found or does not belong to you' });
      }
      
      // Get devices associated with the key
      const devices = await storage.getDevicesByKeyId(keyId);
      
      // Calculate status
      const now = new Date();
      let status = key.isRevoked ? "REVOKED" : 
                  (new Date(key.expiryDate) <= now ? "EXPIRED" : "ACTIVE");
      
      res.json({
        ...key,
        devices,
        status
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/reseller/keys/:id/devices/:deviceId/remove', isReseller, async (req, res) => {
    try {
      const keyId = parseInt(req.params.id);
      const deviceId = req.params.deviceId;
      const user = req.user as any;
      
      // Find the key
      const keys = await storage.getKeysByResellerId(user.id);
      const key = keys.find(k => k.id === keyId);
      
      if (!key) {
        return res.status(404).json({ message: 'Key not found or does not belong to you' });
      }
      
      // Remove the device
      const success = await storage.removeDevice(deviceId, keyId);
      
      if (!success) {
        return res.status(404).json({ message: 'Device not found' });
      }
      
      res.json({
        success: true,
        message: 'Device removed successfully'
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public API for key verification
  app.post('/api/verify', async (req, res) => {
    try {
      const { key: keyString, deviceId, game } = keyVerificationSchema.parse(req.body);
      
      // Find the key
      const key = await storage.getKey(keyString);
      
      // Key not found
      if (!key) {
        return res.json({
          valid: false,
          message: "Invalid license key"
        });
      }
      
      // Check if key is for the right game
      if (key.game !== game) {
        return res.json({
          valid: false,
          message: "License key is not valid for this game"
        });
      }
      
      // Check if key is revoked
      if (key.isRevoked) {
        return res.json({
          valid: false,
          message: "License key has been revoked"
        });
      }
      
      // Check if key is expired
      const now = new Date();
      if (new Date(key.expiryDate) <= now) {
        return res.json({
          valid: false,
          message: "License key has expired",
          expiry: key.expiryDate
        });
      }
      
      // Get devices for this key
      const devices = await storage.getDevicesByKeyId(key.id);
      
      // Check if device is already registered
      const deviceExists = devices.some(d => d.deviceId === deviceId);
      
      // If device exists, return success
      if (deviceExists) {
        return res.json({
          valid: true,
          expiry: key.expiryDate,
          deviceLimit: key.deviceLimit,
          currentDevices: devices.length,
          message: "License valid"
        });
      }
      
      // Check device limit
      if (devices.length >= key.deviceLimit) {
        return res.json({
          valid: false,
          expiry: key.expiryDate,
          deviceLimit: key.deviceLimit,
          currentDevices: devices.length,
          message: "Device limit reached for this license key"
        });
      }
      
      // Register new device
      await storage.addDevice({
        keyId: key.id,
        deviceId
      });
      
      // Return success
      return res.json({
        valid: true,
        expiry: key.expiryDate,
        deviceLimit: key.deviceLimit,
        currentDevices: devices.length + 1,
        message: "License valid"
      });
    } catch (error) {
      res.status(400).json({ 
        valid: false,
        message: error.message 
      });
    }
  });

  // GET API for key verification
  app.get('/api/verify/:key/:game/:deviceId', async (req, res) => {
    try {
      const keyString = req.params.key;
      const game = req.params.game;
      const deviceId = req.params.deviceId;
      
      // Validate params
      if (!keyString || !game || !deviceId) {
        return res.status(400).json({ 
          valid: false,
          message: "Missing required parameters. Need key, game, and deviceId." 
        });
      }

      // Validate game
      if (!["PUBG MOBILE", "LAST ISLAND OF SURVIVAL", "FREE FIRE"].includes(game)) {
        return res.status(400).json({ 
          valid: false,
          message: "Invalid game. Must be one of: PUBG MOBILE, LAST ISLAND OF SURVIVAL, FREE FIRE" 
        });
      }
      
      // Find the key
      const key = await storage.getKey(keyString);
      
      // Key not found
      if (!key) {
        return res.json({
          valid: false,
          message: "Invalid license key"
        });
      }
      
      // Check if key is for the right game
      if (key.game !== game) {
        return res.json({
          valid: false,
          message: "License key is not valid for this game"
        });
      }
      
      // Check if key is revoked
      if (key.isRevoked) {
        return res.json({
          valid: false,
          message: "License key has been revoked"
        });
      }
      
      // Check if key is expired
      const now = new Date();
      if (new Date(key.expiryDate) <= now) {
        return res.json({
          valid: false,
          message: "License key has expired",
          expiry: key.expiryDate
        });
      }
      
      // Get devices for this key
      const devices = await storage.getDevicesByKeyId(key.id);
      
      // Check if device is already registered
      const deviceExists = devices.some(d => d.deviceId === deviceId);
      
      // If device exists, return success
      if (deviceExists) {
        return res.json({
          valid: true,
          expiry: key.expiryDate,
          deviceLimit: key.deviceLimit,
          currentDevices: devices.length,
          message: "License valid"
        });
      }
      
      // Check device limit
      if (devices.length >= key.deviceLimit) {
        return res.json({
          valid: false,
          expiry: key.expiryDate,
          deviceLimit: key.deviceLimit,
          currentDevices: devices.length,
          message: "Device limit reached for this license key"
        });
      }
      
      // Return success but do not register device (GET request is for checking only)
      return res.json({
        valid: true,
        expiry: key.expiryDate,
        deviceLimit: key.deviceLimit,
        currentDevices: devices.length,
        canRegister: true,
        message: "License valid, device can be registered"
      });
    } catch (error) {
      res.status(400).json({ 
        valid: false,
        message: "Error verifying license key" 
      });
    }
  });

  // Helper functions
  function generateKeyString(game: string): string {
    let prefix = "";
    
    if (game === "PUBG MOBILE") {
      prefix = "PBGM";
    } else if (game === "LAST ISLAND OF SURVIVAL") {
      prefix = "LIOS";
    } else if (game === "FREE FIRE") {
      prefix = "FIRE";
    }
    
    const segments = [
      nanoid(5).toUpperCase(),
      nanoid(5).toUpperCase(),
      nanoid(5).toUpperCase()
    ];
    
    return `${prefix}-${segments.join('-')}`;
  }

  const httpServer = createServer(app);
  
  // Setup WebSocket server for real-time notifications
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws'
  });

  wss.on('connection', (ws, req) => {
    console.log('WebSocket connection established');
    
    // Handle incoming messages from clients
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'auth' && data.resellerId) {
          // Associate this WebSocket connection with a reseller ID
          const resellerId = parseInt(data.resellerId);
          
          // Verify the reseller exists and is active before associating the connection
          try {
            const reseller = await storage.getReseller(resellerId);
            if (!reseller) {
              ws.send(JSON.stringify({
                type: 'auth_error',
                message: 'Invalid reseller ID'
              }));
              ws.close(1008, 'Invalid reseller ID');
              return;
            }
            
            if (!reseller.isActive) {
              ws.send(JSON.stringify({
                type: 'auth_error', 
                message: 'Account is suspended'
              }));
              ws.close(1008, 'Account suspended');
              return;
            }
            
            if (!resellerConnections.has(resellerId)) {
              resellerConnections.set(resellerId, new Set());
            }
            resellerConnections.get(resellerId)?.add(ws);
            
            // Store reseller ID on the WebSocket for cleanup
            (ws as any).resellerId = resellerId;
            
            console.log(`Reseller ${resellerId} connected via WebSocket`);
            
            // Send confirmation
            ws.send(JSON.stringify({
              type: 'auth_success',
              message: 'WebSocket authenticated'
            }));
          } catch (error) {
            console.error('Error authenticating WebSocket connection:', error);
            ws.send(JSON.stringify({
              type: 'auth_error',
              message: 'Authentication failed'
            }));
            ws.close(1011, 'Authentication failed');
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      const resellerId = (ws as any).resellerId;
      if (resellerId && resellerConnections.has(resellerId)) {
        resellerConnections.get(resellerId)?.delete(ws);
        
        // Clean up empty sets
        if (resellerConnections.get(resellerId)?.size === 0) {
          resellerConnections.delete(resellerId);
        }
        
        console.log(`Reseller ${resellerId} disconnected from WebSocket`);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Function to notify reseller of suspension status change
  function notifyResellerStatusChange(resellerId: number, isActive: boolean) {
    const connections = resellerConnections.get(resellerId);
    if (connections && connections.size > 0) {
      const message = JSON.stringify({
        type: 'status_change',
        isActive,
        message: isActive 
          ? 'Your account has been reactivated by the admin.'
          : 'YOUR ACCOUNT HAS BEEN SUSPENDED BY ADMIN, CONTACT ADMIN FOR MORE DETAILS.'
      });
      
      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
      
      console.log(`Notified reseller ${resellerId} of status change: ${isActive ? 'activated' : 'suspended'}`);
    }
  }
  
  return httpServer;
}
