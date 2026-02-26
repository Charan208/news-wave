/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║   WhatsApp News Agent — Server v4.0                                 ║
 * ║   4 Live Sources + NVIDIA NIM + Twilio WhatsApp Auto-Send           ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Source 1: TheNewsAPI.com        (key in .env)                      ║
 * ║  Source 2: NewsAPI.org           (key in .env)                      ║
 * ║  Source 3: WorldNewsAPI.com      (key in .env)                      ║
 * ║  Source 4: Hacker News (YC)      ✅ FREE — no key needed            ║
 * ║  AI:       NVIDIA NIM Llama 3.3  (key in .env)                      ║
 * ║  Sender:   Twilio WhatsApp API   (SID + Token in .env)              ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * SETUP:
 *   1.  npm install express cors dotenv node-fetch node-cron twilio
 *   2.  cp .env.template .env  →  fill in your FRESH keys
 *   3.  node server.js
 *
 * TWILIO WHATSAPP SANDBOX SETUP (free for testing):
 *   1. Go to console.twilio.com → Messaging → Try it out → WhatsApp
 *   2. Send "join <your-sandbox-word>" to +1 415 523 8886 from your phone
 *   3. Your number is now registered — messages will arrive automatically
 *   For production: activate a Twilio WhatsApp-approved sender number
 *
 * ENDPOINTS:
 *   GET  /                    → health check
 *   POST /api/news            → fetch + analyze + optional auto-send
 *   POST /api/send            → send existing digest to WhatsApp
 *   POST /api/schedule        → set/stop cron auto-fetch + auto-send
 *   POST /api/recipients      → add/remove WhatsApp recipients
 *   GET  /api/recipients      → list recipients
 *   GET  /api/history         → past 50 digests
 *   GET  /api/status          → full server status
 *   POST /api/test-whatsapp   → send a test ping to a number
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const util = require("util");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const { User, History, Recipient } = require("./models");

// ── Database Selection (Local vs Mongo) ──────────────────────────
const MONGODB_URI = process.env.MONGODB_URI;
const IS_MONGO = !!MONGODB_URI;

if (IS_MONGO) {
  console.log("🔗 Connecting to MongoDB Atlas...");
  mongoose.connect(MONGODB_URI)
    .then(() => console.log("✅ Connected to MongoDB Atlas"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err.message));
} else {
  // ── Persistent Storage (lowdb v1) ──────────────────────────────────
  const low = require("lowdb");
  const FileSync = require("lowdb/adapters/FileSync");
  const adapter = new FileSync("db.json");
  const db = low(adapter);
  db.defaults({ users: [], history: [], settings: {} }).write();
  global.db = db; // Make global for backward compatibility for now
}
// ── Database Helpers (Dual Mode) ──────────────────────────────────
const dbHelpers = {
  findUser: async (query) => {
    if (IS_MONGO) {
      // Query usually has 'username' or 'id' (which is _id in mongo or id in local)
      if (query.id) {
        return await User.findById(query.id).lean();
      }
      return await User.findOne(query).lean();
    }
    return global.db.get("users").find(query).value();
  },
  createUser: async (userData) => {
    if (IS_MONGO) return await User.create(userData);
    global.db.get("users").push(userData).write();
    return userData;
  },
  updateUser: async (id, update) => {
    if (IS_MONGO) return await User.findByIdAndUpdate(id, update, { new: true }).lean();
    const user = global.db.get("users").find({ id }).value();
    if (user) global.db.get("users").find({ id }).assign(update).write();
    return user;
  },
  addHistory: async (userId, data) => {
    if (IS_MONGO) return await History.create({ userId, ...data });
    const entry = { userId, ...data, id: Math.random().toString(36).substring(2, 11) };
    global.db.get("history").unshift(entry).write();
    const history = global.db.get("history").value();
    if (history.length > 500) global.db.set("history", history.slice(0, 500)).write();
    return entry;
  },
  getHistory: async (userId, limit = 50) => {
    if (IS_MONGO) return await History.find({ userId }).sort({ timestamp: -1 }).limit(limit).lean();
    return global.db.get("history").filter({ userId }).value().slice(0, limit);
  },
  getAllUsers: async () => {
    if (IS_MONGO) return await User.find({}).lean();
    return global.db.get("users").value();
  },
  // Recipient Helpers
  getRecipients: async (userId) => {
    if (IS_MONGO) return await Recipient.find({ userId }).lean();
    return global.recipients ? [...global.recipients.values()] : [];
  },
  updateRecipient: async (userId, phone, update, action = "add") => {
    if (IS_MONGO) {
      if (action === "remove") return await Recipient.deleteOne({ userId, phone });
      return await Recipient.findOneAndUpdate({ userId, phone }, { ...update, userId }, { upsert: true, new: true }).lean();
    }
  }
};

// Function to generate a new key
const generateKey = () => Math.random().toString(36).substring(2, 10).toUpperCase();

const JWT_SECRET = process.env.JWT_SECRET || "news-wave-super-secret-key-123";
const app = express();
const PORT = process.env.PORT || 3001;

// ── Credentials ────────────────────────────────────────────────────
const KEYS = {
  nvidia: process.env.NVIDIA_API_KEY,
  thenewsapi: process.env.THENEWSAPI_KEY,
  newsapi: process.env.NEWSAPI_KEY,
  worldnewsapi: process.env.WORLDNEWSAPI_KEY,
  twilioSid: process.env.TWILIO_ACCOUNT_SID,
  twilioToken: process.env.TWILIO_AUTH_TOKEN,
  // Your Twilio WhatsApp number (sandbox: whatsapp:+14155238886)
  twilioFrom: process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886",
};

// Validate required credentials
const missingNews = ["thenewsapi", "newsapi", "worldnewsapi", "nvidia"]
  .filter(k => !KEYS[k]);
if (missingNews.length) console.warn(`⚠️  Missing news/AI keys: ${missingNews.join(", ")}`);

// Twilio client — only init if credentials exist
let twilioClient = null;

// ── Twilio removed — WhatsApp auto-send disabled

// Allow any origin so mobile apps / remote frontends can connect
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global request logger for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// ── Web Session Auth ─────────────────────────────────────────────
const requireWebAuth = (req, res, next) => {
  const token = req.cookies.web_session;
  if (!token) return res.redirect('/login');

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return res.redirect('/login');
    const user = await dbHelpers.findUser({ id: decoded.id });
    if (!user) return res.redirect('/login');
    req.user = user;
    next();
  });
};

// ── Mobile API Auth (Checks Pairing Key Compatibility) ───────────
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ error: "Invalid or expired token." });

    // Auto-Logout Logic
    const user = await dbHelpers.findUser({ id: decoded.id });
    if (!user || user.pairingKey !== decoded.pairingKey) {
      return res.status(403).json({ error: "Session revoked. Key has been changed." });
    }

    req.user = decoded;
    next();
  });
};

// ── Web Portal & User Identity ──────────────────────────────────

// Serve a premium Login Page
app.get("/login", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>News Wave | Login</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { margin: 0; padding: 0; background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; }
            .card { background: #111; padding: 3rem; border-radius: 2rem; box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid #222; max-width: 400px; width: 100%; text-align: center; }
            h1 { font-weight: 900; letter-spacing: -2px; margin-bottom: 0.5rem; color: #00ffcc; }
            p { color: #888; margin-bottom: 2rem; font-size: 0.9rem; }
            input { width: 100%; padding: 1rem; margin-bottom: 1rem; border-radius: 0.8rem; border: 1px solid #333; background: #000; color: #fff; box-sizing: border-box; font-family: inherit; }
            button { width: 100%; padding: 1rem; border-radius: 0.8rem; border: none; background: #00ffcc; color: #000; font-weight: 900; cursor: pointer; transition: 0.2s; }
            button:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,255,204,0.3); }
            .error { color: #ff4444; font-size: 0.8rem; margin-bottom: 1rem; }
            .link { margin-top: 1.5rem; font-size: 0.8rem; color: #666; }
            .link a { color: #00ffcc; text-decoration: none; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>NEWS WAVE</h1>
            <p>Sign in to access your intelligence hub.</p>
            <form action="/login" method="POST">
                <input type="text" name="username" placeholder="Username" required>
                <input type="password" name="password" placeholder="Password" required>
                <button type="submit">SECURE SIGN IN</button>
            </form>
            ${req.query.error ? `<div class="error">${req.query.error}</div>` : ''}
            ${req.query.message ? `<div style="color: #00ffcc; font-size: 0.8rem; margin-bottom: 1rem;">${req.query.message}</div>` : ''}
            <div class="link">Don't have an account? <a href="/register">Register</a></div>
        </div>
    </body>
    </html>
  `);
});

// Serve a premium Registration Page
app.get("/register", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>News Wave | Register</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { margin: 0; padding: 0; background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; }
            .card { background: #111; padding: 3rem; border-radius: 2rem; box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid #222; max-width: 400px; width: 100%; text-align: center; }
            h1 { font-weight: 900; letter-spacing: -2px; margin-bottom: 0.5rem; color: #00ffcc; }
            p { color: #888; margin-bottom: 2rem; font-size: 0.9rem; }
            input { width: 100%; padding: 1rem; margin-bottom: 1rem; border-radius: 0.8rem; border: 1px solid #333; background: #000; color: #fff; box-sizing: border-box; font-family: inherit; }
            button { width: 100%; padding: 1rem; border-radius: 0.8rem; border: none; background: #00ffcc; color: #000; font-weight: 900; cursor: pointer; transition: 0.2s; }
            button:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,255,204,0.3); }
            .error { color: #ff4444; font-size: 0.8rem; margin-bottom: 1rem; }
            .link { margin-top: 1.5rem; font-size: 0.8rem; color: #666; }
            .link a { color: #00ffcc; text-decoration: none; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>NEWS WAVE</h1>
            <p>Create your account to begin your intelligence experience.</p>
            <form action="/register" method="POST">
                <input type="text" name="username" placeholder="Choose Username" required>
                <input type="password" name="password" placeholder="Choose Password" required>
                <button type="submit">CREATE ACCOUNT</button>
            </form>
            ${req.query.error ? `<div class="error">${req.query.error}</div>` : ''}
            <div class="link">Already have an account? <a href="/login">Login</a></div>
        </div>
    </body>
    </html>
  `);
});

app.post("/register", express.urlencoded({ extended: true }), async (req, res) => {
  const { username, password } = req.body;

  // Check if user already exists
  const existingUser = await dbHelpers.findUser({ username });
  if (existingUser) {
    return res.redirect('/register?error=Username already taken');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: Math.random().toString(36).substring(2, 11),
    username,
    password: hashedPassword,
    pairingKey: generateKey(),
    keys: {}
  };

  await dbHelpers.createUser(newUser);
  console.log(`[AUTH] New user registered: ${username}`);
  res.redirect('/login?message=Registration successful! Please login.');
});

app.post("/login", express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await dbHelpers.findUser({ username });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.redirect('/login?error=Invalid credentials');
    }

    const token = jwt.sign({ id: user.id || user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('web_session', token, { httpOnly: true, secure: false });
    res.redirect('/');
  } catch (e) {
    console.error("[AUTH] Login Error:", e.message);
    res.status(500).send("Internal Server Error: " + e.message);
  }
});

// Admin Dashboard (Protected)
app.get("/", requireWebAuth, async (req, res) => {
  const user = req.user;

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>News Wave | Hub Dashboard</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { margin: 0; padding: 0; background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; }
            .card { background: #111; padding: 3rem; border-radius: 2rem; box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid #222; max-width: 450px; width: 100%; text-align: center; }
            h1 { font-weight: 900; letter-spacing: -2px; margin-bottom: 0.5rem; color: #00ffcc; }
            .user-info { color: #888; margin-bottom: 2rem; font-size: 0.9rem; }
            .key-container { background: #000; padding: 2rem; border-radius: 1.5rem; border: 1px dashed #00ffcc; margin-bottom: 2rem; position: relative; }
            .key-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 2px; color: #00ffcc; opacity: 0.7; margin-bottom: 1rem; }
            .key-value { font-family: monospace; font-size: 2.5rem; font-weight: bold; color: #00ffcc; letter-spacing: 0.3rem; }
            .regen-btn { background: transparent; border: 1px solid #333; color: #555; padding: 0.5rem 1rem; border-radius: 0.5rem; font-size: 0.7rem; cursor: pointer; margin-top: 1rem; transition: 0.2s; }
            .regen-btn:hover { color: #ff4444; border-color: #ff4444; }
            p.hint { font-size: 0.8rem; color: #666; line-height: 1.5; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>NEWS WAVE</h1>
            <div class="user-info">Logged in as <strong>${user.username}</strong> | <a href="/logout" style="color: #00ffcc; text-decoration: none; font-size: 0.7rem;">LOGOUT</a></div>
            
            <div class="key-container">
                <div class="key-label">Mobile Connection Key</div>
                <div class="key-value">${user.pairingKey}</div>
                <form action="/auth/regenerate-key" method="POST">
                    <button type="submit" class="regen-btn">REGENERATE KEY</button>
                </form>
            </div>

            <div style="text-align: left; background: #1a1a1a; padding: 2rem; border-radius: 1.5rem; border: 1px solid #333; margin-bottom: 2rem;">
                <div class="key-label" style="margin-bottom: 1.5rem;">Personal API Keys (Optional)</div>
                <form action="/api/user/settings" method="POST" id="settings-form">
                    <div style="margin-bottom: 1rem;">
                        <label style="font-size: 0.7rem; color: #666; display: block; margin-bottom: 0.5rem;">NVIDIA NIM API KEY</label>
                        <input type="password" name="keys[nvidia]" value="${user.keys?.nvidia || ''}" style="width: 100%; background: #000; border: 1px solid #333; color: #00ffcc; padding: 0.8rem; border-radius: 0.5rem; font-family: monospace;">
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label style="font-size: 0.7rem; color: #666; display: block; margin-bottom: 0.5rem;">THENEWSAPI KEY</label>
                        <input type="password" name="keys[thenewsapi]" value="${user.keys?.thenewsapi || ''}" style="width: 100%; background: #000; border: 1px solid #333; color: #00ffcc; padding: 0.8rem; border-radius: 0.5rem; font-family: monospace;">
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label style="font-size: 0.7rem; color: #666; display: block; margin-bottom: 0.5rem;">NEWSAPI.ORG KEY</label>
                        <input type="password" name="keys[newsapi]" value="${user.keys?.newsapi || ''}" style="width: 100%; background: #000; border: 1px solid #333; color: #00ffcc; padding: 0.8rem; border-radius: 0.5rem; font-family: monospace;">
                    </div>
                    <div style="margin-bottom: 1.5rem;">
                        <label style="font-size: 0.7rem; color: #666; display: block; margin-bottom: 0.5rem;">WORLDNEWSAPI KEY</label>
                        <input type="password" name="keys[worldnewsapi]" value="${user.keys?.worldnewsapi || ''}" style="width: 100%; background: #000; border: 1px solid #333; color: #00ffcc; padding: 0.8rem; border-radius: 0.5rem; font-family: monospace;">
                    </div>
                    <button type="submit" style="background: #00ffcc; color: #000; font-weight: 900; border: none; padding: 1rem; border-radius: 0.8rem; width: 100%; cursor: pointer;">SAVE CONFIGURATION</button>
                </form>
            </div>
            
            <p class="hint">
                Enter your Server URL and this Connection Key in the mobile app to sync your data. 
                <br><br>
                <strong>Security:</strong> Regenerating the key will automatically log out all connected mobile devices.
            </p>
        </div>
    </body>
    </html>
  `);
});

app.get("/logout", (req, res) => {
  res.clearCookie('web_session');
  res.redirect('/login');
});

app.post("/auth/regenerate-key", requireWebAuth, async (req, res) => {
  const newKey = generateKey();
  await dbHelpers.updateUser(req.user.id || req.user._id, { pairingKey: newKey });
  console.log(`[AUTH] Key regenerated for user: ${req.user.username}`);
  res.json({ success: true, pairingKey: newKey });
});

// Mobile App Linking Endpoint
app.post("/auth/link-app", express.json(), async (req, res) => {
  const { pairingKey } = req.body;
  console.log(`[LINK-APP] Attempt with key: "${pairingKey}"`);

  // Find user by their specific pairing key
  const user = await dbHelpers.findUser({ pairingKey });

  if (user) {
    console.log(`[LINK-APP] ✅ Success for user: ${user.username}`);
    // Token strictly includes the pairingKey used to link
    const token = jwt.sign({
      id: user.id,
      username: user.username,
      pairingKey: user.pairingKey
    }, JWT_SECRET, { expiresIn: "30d" });

    res.json({ success: true, token, user: { id: user.id, username: user.username, keys: user.keys } });
  } else {
    console.log(`[LINK-APP] ❌ Failed - invalid key`);
    res.status(403).json({ error: "Invalid Connection Key" });
  }
});

// Protect all /api routes
app.use("/api", authenticateToken);

// ── In-memory store (volatile logs only) ──────────────────────────
const userJobs = new Map();      // userId -> cronJob
let sendLog = [];                // last 100 send events
let systemLogs = [];             // last 200 system events (INFO, WARN, ERROR)

// ── Logging Helper ──────────────────────────────────────────────────
function log(level, message, detail = null) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      detail,
      origin: "server"
    };
    systemLogs.unshift(entry);
    if (systemLogs.length > 200) systemLogs.pop();

    // Also print to console
    const color = level === 'error' ? '\x1b[31m' : level === 'warn' ? '\x1b[33m' : '\x1b[32m';

    // Don't prepend [LEVEL] if the message is a box character (UI box)
    if (message.startsWith('║') || message.startsWith('╔') || message.startsWith('╠') || message.startsWith('╚')) {
      originalLog(message);
    } else {
      originalLog(`${color}[${entry.level}]\x1b[0m ${message}`, detail || '');
    }
  } catch (e) {
    if (originalError) originalError("Failed to log entry:", e.message);
  }
}

// Override console methods to capture logs
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = (...args) => {
  if (args.length === 0) return;
  const msg = typeof args[0] === "string" ? args[0] : util.inspect(args[0], { depth: 2 });
  log("info", msg, args.length > 1 ? args.slice(1).map(x => util.inspect(x, { depth: 1 })) : null);
};
console.warn = (...args) => {
  if (args.length === 0) return;
  const msg = typeof args[0] === "string" ? args[0] : util.inspect(args[0], { depth: 2 });
  log("warn", msg, args.length > 1 ? args.slice(1).map(x => util.inspect(x, { depth: 1 })) : null);
};
console.error = (...args) => {
  if (args.length === 0) return;
  const msg = typeof args[0] === "string" ? args[0] : util.inspect(args[0], { depth: 2 });
  log("error", msg, args.length > 1 ? args.slice(1).map(x => util.inspect(x, { depth: 1 })) : null);
};

// ── Persistence helpers ─────────────────────────────────────────────
const RECIPIENTS_FILE = path.join(__dirname, "recipients.json");
const SETTINGS_FILE = path.join(__dirname, "settings.json");

function saveRecipients() {
  try {
    fs.writeFileSync(RECIPIENTS_FILE, JSON.stringify([...recipients.values()], null, 2));
  } catch (e) { console.warn("⚠️  Could not save recipients.json:", e.message); }
}

function saveSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(schedulerConf || {}, null, 2));
  } catch (e) { console.warn("⚠️  Could not save settings.json:", e.message); }
}

// ── Load persisted state on startup ─────────────────────────────────
async function loadPersisted() {
  try {
    const users = await dbHelpers.getAllUsers();
    users.forEach(user => {
      const conf = user.settings?.scheduler;
      if (conf && conf.enabled && conf.cronExpr && cron.validate(conf.cronExpr)) {
        const job = cron.schedule(conf.cronExpr, async () => {
          console.log(`⏰ [CRON] User:${user.username} | cats:${conf.categories.join(",")}`);
          await fetchAndAnalyze(conf.categories, conf.count, conf.autoSend, user.id || user._id);
        });
        userJobs.set(user.id || user._id, job);
        console.log(`⏰ Restored scheduler for ${user.username}: ${conf.cronExpr}`);
      }
    });
  } catch (e) { console.error("⚠️  Failed to restore schedulers:", e.message); }
}
setTimeout(loadPersisted, 1000);

// ─────────────────────────────────────────────────────────────────
// KEYWORD MAP
// ─────────────────────────────────────────────────────────────────
const KEYWORD_MAP = {
  "technology": ["technology", "ai", "machine learning", "software", "chip", "llm", "gpu", "open source"],
  "cybersecurity": ["cybersecurity", "security", "cve", "vulnerability", "breach", "patch", "cisa", "zero-day", "exploit"],
  "hacking & exploits": ["hack", "exploit", "ransomware", "malware", "apt", "zero-day", "phishing", "botnet", "dark web", "threat actor"],
  "ai agents": ["ai agent", "autonomous agent", "agentic", "multi-agent", "llm agent", "openai agents", "anthropic agents", "claude", "gpt agent", "crewai", "autogpt", "langchain", "langgraph", "smolagents", "agent framework", "tool use", "function calling", "mcp", "model context protocol", "agentic ai"],
  "ai tools & releases": ["ai tool", "ai release", "model release", "new model", "gpt-5", "gpt-4", "claude 3", "claude 4", "gemini 2", "llama 3", "mistral", "open source model", "hugging face", "ai api", "ai launch", "ai product", "foundation model", "benchmark", "fine-tune", "lora", "gguf", "ollama", "lm studio", "deepseek", "qwen", "phi-4"],
  "science": ["science", "nasa", "space", "physics", "biology", "research", "discovery", "climate", "quantum"],
  "business": ["business", "startup", "funding", "ipo", "acquisition", "economy", "market", "revenue", "venture"],
  "politics": ["politics", "government", "policy", "election", "senate", "congress", "law", "regulation"],
  "health": ["health", "medicine", "fda", "drug", "clinical", "hospital", "pandemic", "disease"],
  "sports": ["sports", "football", "basketball", "soccer", "cricket", "tennis", "nba", "nfl"],
  "entertainment": ["movie", "music", "gaming", "netflix", "streaming", "celebrity", "film", "game"],
  "world news": ["war", "conflict", "geopolitics", "international", "global", "ukraine", "middle east", "un"],
};

function getKeywordsForCategories(categories) {
  const words = new Set();
  categories.forEach(cat => {
    const key = cat.toLowerCase().replace(/[^a-z &]/g, "").trim();
    const kws = KEYWORD_MAP[key] || [cat.toLowerCase()];
    kws.forEach(w => words.add(w));
  });
  return [...words];
}

function articleMatchesCategories(text, keywords) {
  const t = text.toLowerCase();
  return keywords.some(kw => t.includes(kw.toLowerCase()));
}

// ─────────────────────────────────────────────────────────────────

// ── WhatsApp sending logic removed


// ── Broadcast logic removed

// ─────────────────────────────────────────────────────────────────
// NEWS SOURCES (same as v3)
// ─────────────────────────────────────────────────────────────────

async function fromTheNewsAPI(keywords, count, customKeys = null) {
  const currentKey = customKeys?.thenewsapi || KEYS.thenewsapi;
  if (!currentKey) return [];
  try {
    const q = keywords.slice(0, 5).join(" ");
    const url = `https://api.thenewsapi.com/v1/news/all?api_token=${currentKey}&search=${encodeURIComponent(q)}&language=en&limit=${Math.min(count + 8, 15)}&sort=published_at`;
    const res = await fetch(url);
    const data = await res.json();
    return (data.data || []).map(a => ({
      headline: a.title, summary: a.description || a.snippet || "",
      url: a.url, source: a.source || "TheNewsAPI",
      publishedAt: a.published_at, imageUrl: a.image_url || null,
      origin: "thenewsapi", score: null,
    }));
  } catch (e) { log("error", "[TheNewsAPI]", e.message); return []; }
}

async function fromNewsAPI(keywords, count, customKeys = null) {
  const currentKey = customKeys?.newsapi || KEYS.newsapi;
  if (!currentKey) return [];
  try {
    const q = keywords.slice(0, 5).join(" OR ");
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&pageSize=${Math.min(count + 8, 15)}&apiKey=${currentKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "ok") return [];
    return (data.articles || []).filter(a => a.title && a.title !== "[Removed]").map(a => ({
      headline: a.title, summary: a.description || "",
      url: a.url, source: a.source?.name || "NewsAPI",
      publishedAt: a.publishedAt, imageUrl: a.urlToImage || null,
      origin: "newsapi", score: null,
    }));
  } catch (e) { log("error", "[NewsAPI.org]", e.message); return []; }
}

async function fromWorldNewsAPI(keywords, count, customKeys = null) {
  const currentKey = customKeys?.worldnewsapi || KEYS.worldnewsapi;
  if (!currentKey) return [];
  try {
    const q = keywords.slice(0, 5).join(" ");
    const url = `https://api.worldnewsapi.com/search-news?text=${encodeURIComponent(q)}&language=en&number=${Math.min(count + 8, 15)}&api-key=${currentKey}&sort=publish-time&sort-direction=DESC`;
    const res = await fetch(url);
    const data = await res.json();
    return (data.news || []).map(a => ({
      headline: a.title, summary: (a.text || "").slice(0, 400),
      url: a.url, source: a.source_country || "WorldNewsAPI",
      publishedAt: a.publish_date, imageUrl: a.image || null,
      origin: "worldnewsapi", score: null,
    }));
  } catch (e) { log("error", "[WorldNewsAPI]", e.message); return []; }
}

const HN_BASE = "https://hacker-news.firebaseio.com/v0";

async function fetchHNItem(id) {
  try { const r = await fetch(`${HN_BASE}/item/${id}.json`); return await r.json(); }
  catch { return null; }
}

async function fromHackerNews(keywords, count, feed = "top") {
  try {
    const feedUrl = feed === "new" ? `${HN_BASE}/newstories.json`
      : feed === "best" ? `${HN_BASE}/beststories.json`
        : `${HN_BASE}/topstories.json`;
    const res = await fetch(feedUrl);
    const allIds = await res.json();
    if (!Array.isArray(allIds)) return [];

    const sliced = allIds.slice(0, 120);
    const stories = [];
    for (let i = 0; i < sliced.length; i += 20) {
      const results = await Promise.all(sliced.slice(i, i + 20).map(fetchHNItem));
      results.forEach(item => {
        if (item && item.type === "story" && item.title && !item.dead && !item.deleted) stories.push(item);
      });
      const matched = stories.filter(s => articleMatchesCategories(s.title + " " + (s.url || ""), keywords));
      if (matched.length >= count * 2) break;
    }

    const relevant = stories
      .filter(s => articleMatchesCategories(s.title + " " + (s.url || ""), keywords))
      .sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, count + 5);
    const pool = relevant.length > 0 ? relevant : stories.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, count + 5);

    return pool.map(s => ({
      headline: s.title,
      summary: s.text ? s.text.replace(/<[^>]+>/g, "").slice(0, 400)
        : `Posted by ${s.by || "unknown"} — ${s.score || 0} upvotes, ${s.descendants || 0} comments.`,
      url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
      source: "Hacker News", publishedAt: s.time ? new Date(s.time * 1000).toISOString() : null,
      imageUrl: null, origin: "hackernews",
      score: s.score || 0, hnId: s.id, author: s.by || "unknown", comments: s.descendants || 0,
    }));
  } catch (e) { console.error("[HackerNews]", e.message); return []; }
}

// ─────────────────────────────────────────────────────────────────
// DEDUPLICATION
// ─────────────────────────────────────────────────────────────────
function deduplicate(articles) {
  const seen = new Set();
  return articles.filter(a => {
    const key = (a.headline || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
}

// ─────────────────────────────────────────────────────────────────
// NVIDIA NIM ANALYSIS
// ─────────────────────────────────────────────────────────────────
async function nimAnalyze(articles, customKeys = null) {
  const currentKey = customKeys?.nvidia || KEYS.nvidia;
  if (!currentKey || !articles.length) {
    return articles.map(a => ({ ...a, severity: "info", tags: [], aiSummary: false }));
  }

  const input = articles.map((a, i) => [
    `[${i}] SOURCE: ${a.source} (${a.origin})`,
    a.score ? `HN SCORE: ${a.score} upvotes` : "",
    `HEADLINE: ${a.headline}`,
    `RAW SUMMARY: ${a.summary}`,
  ].filter(Boolean).join("\n")).join("\n\n");

  const prompt = `You are a senior news analyst and cybersecurity threat intelligence expert.
For each article: 1) Write a sharper 2-sentence summary. 2) Assign severity:
"critical"=active zero-day/live ransomware/major breach/nation-state attack
"high"=serious CVE/large breach/active campaign  "medium"=patched CVE/moderate breach
"low"=advisory/policy  "info"=general non-security news
3) 2-4 short tags (e.g. "CVE-2024-1234","APT29","Ransomware","AI","LLM","Zero-Day")

Articles:
${input}

Respond ONLY with JSON array:
[{"idx":0,"summary":"...","severity":"info","tags":["..."]}]`;

  try {
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEYS.nvidia}` },
      body: JSON.stringify({
        model: "meta/llama-3.3-70b-instruct", max_tokens: 4096, temperature: 0.2,
        messages: [{ role: "user", content: prompt }]
      }),
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON in NIM response");
    const analysis = JSON.parse(match[0]);
    return articles.map((a, i) => {
      const ai = analysis.find(x => x.idx === i) || {};
      return { ...a, summary: ai.summary || a.summary, severity: ai.severity || "info", tags: ai.tags || [], aiSummary: true };
    });
  } catch (e) {
    log("error", "[NVIDIA NIM]", e.message);
    return articles.map(a => ({ ...a, severity: "info", tags: [], aiSummary: false }));
  }
}

// ─────────────────────────────────────────────────────────────────
// MAIN PIPELINE
// ─────────────────────────────────────────────────────────────────
const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

async function fetchAndAnalyze(categories, count, autoSend = false, userId = null) {
  const t0 = Date.now();
  const keywords = getKeywordsForCategories(categories);

  // Get user keys if available
  const user = userId ? db.get("users").find({ id: userId }).value() : null;
  const customKeys = user?.keys || null;

  console.log(`\n📡 Pipeline | user: ${user?.username || 'system'} | cats: ${categories.join(",")} | count: ${count}`);

  const [r1, r2, r3, r4] = await Promise.allSettled([
    fromTheNewsAPI(keywords, count, customKeys),
    fromNewsAPI(keywords, count, customKeys),
    fromWorldNewsAPI(keywords, count, customKeys),
    fromHackerNews(keywords, count, "top"),
  ]);

  const pool = [
    ...(r1.status === "fulfilled" ? r1.value : []),
    ...(r2.status === "fulfilled" ? r2.value : []),
    ...(r3.status === "fulfilled" ? r3.value : []),
    ...(r4.status === "fulfilled" ? r4.value : []),
  ];

  const breakdown = {
    thenewsapi: (r1.status === "fulfilled" ? r1.value : []).length,
    newsapi: (r2.status === "fulfilled" ? r2.value : []).length,
    worldnewsapi: (r3.status === "fulfilled" ? r3.value : []).length,
    hackernews: (r4.status === "fulfilled" ? r4.value : []).length,
  };

  const deduped = deduplicate(pool);
  const analyzed = await nimAnalyze(deduped.slice(0, Math.min(count * 2, 25)), customKeys);

  analyzed.sort((a, b) => {
    const sd = (SEV_ORDER[a.severity] ?? 5) - (SEV_ORDER[b.severity] ?? 5);
    return sd !== 0 ? sd : (b.score || 0) - (a.score || 0);
  });

  const final = analyzed.slice(0, count);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const digest = {
    id: Date.now(),
    userId, // Link to user
    timestamp: new Date().toISOString(),
    categories, count: final.length,
    articles: final,
    sources: Object.entries(breakdown).filter(([, v]) => v > 0).map(([k]) => k),
    breakdown, elapsed,
    critical: final.filter(a => a.severity === "critical").length,
    high: final.filter(a => a.severity === "high").length,
    sent: false,
    sendResult: null,
  };

  // Save to persistent history
  await dbHelpers.addHistory(userId, { articles: final, summary: analyzed[0]?.summary || "" });

  console.log(`  ✅ ${elapsed}s | ${final.length} articles | User:${user?.username || 'sys'}`);
  return { articles: final, sources: Object.keys(breakdown), breakdown, elapsed, digest };
}

// ── History
app.get("/api/history", (req, res) => {
  const userId = req.user.id;
  const history = db.get("history").filter({ userId }).value();
  res.json({ digests: history, total: history.length });
});

// ── Fetch + analyze + optional send
app.post("/api/news", async (req, res) => {
  const { categories, count = 5, autoSend = false } = req.body;
  const userId = req.user.id; // From JWT

  if (!categories?.length) return res.status(400).json({ error: "No categories provided." });

  try {
    const result = await fetchAndAnalyze(categories, Math.min(count, 20), autoSend, userId);
    if (!result.articles.length) return res.status(503).json({ error: "No articles found." });
    res.json({
      articles: result.articles,
      fetchedAt: new Date().toISOString(),
      sources: result.sources,
      breakdown: result.breakdown,
      elapsed: result.elapsed,
      critical: result.articles.filter(a => a.severity === "critical").length,
      high: result.articles.filter(a => a.severity === "high").length,
    });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// ── User Settings & Keys
app.post("/api/user/settings", express.urlencoded({ extended: true }), async (req, res) => {
  const { keys, settings } = req.body;
  const userId = req.user.id;

  const user = await dbHelpers.findUser({ id: userId });
  if (!user) return res.status(404).json({ error: "User not found" });

  const update = {};
  if (keys) update.keys = { ...user.keys, ...keys };
  if (settings) update.settings = { ...user.settings, ...settings };

  const updated = await dbHelpers.updateUser(userId, update);

  // If form submission from web, redirect
  if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
    return res.redirect('/?message=Settings updated successfully');
  }

  res.json({ success: true, user: { username: req.user.username, keys: updated.keys, settings: updated.settings } });
});

app.get("/api/user/me", async (req, res) => {
  const user = await dbHelpers.findUser({ id: req.user.id });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ id: user.id || user._id, username: user.username, keys: user.keys, settings: user.settings || {} });
});

// ── Send a message to a specific number (or all recipients)
app.post("/api/send", async (req, res) => {
  const { to, articles, categories, digestId } = req.body;

  if (!twilioClient) {
    return res.status(503).json({ error: "Twilio not configured. Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to .env" });
  }

  // Get articles — either from request body or from history by digestId
  let toSend = articles;
  let cats = categories || ["News"];

  if (!toSend && digestId) {
    const digest = historyStore.find(d => d.id === digestId);
    if (!digest) return res.status(404).json({ error: "Digest not found in history." });
    toSend = digest.articles;
    cats = digest.categories;
  }

  if (!toSend?.length) return res.status(400).json({ error: "No articles to send." });

  const message = formatWhatsAppMessage(toSend, cats);

  try {
    if (to) {
      // Send to specific number
      const result = await sendWhatsApp(to, message);
      res.json(result);
    } else {
      // Broadcast to all active recipients
      const result = await broadcastDigest(toSend, cats);
      res.json(result);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Test WhatsApp connection — send a ping to a number
app.post("/api/test-whatsapp", async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: "Phone number required." });
  if (!twilioClient) return res.status(503).json({ error: "Twilio not configured." });

  const result = await sendWhatsApp(to,
    `✅ *WhatsApp News Agent — Test Ping*\n\nYour connection is working! 🎉\n_Server v4.0 is online and ready to send news digests._\n\n📡 Powered by NVIDIA NIM + 4 news sources`
  );
  res.json(result);
});

// ── Recipients management
app.post("/api/recipients", async (req, res) => {
  const { action, phone, name } = req.body;
  if (!phone) return res.status(400).json({ error: "Phone number required" });

  const digits = phone.replace(/\D/g, "");
  const normalized = "+" + digits;
  const userId = req.user.id;

  if (action === "remove") {
    await dbHelpers.updateRecipient(userId, normalized, {}, "remove");
    return res.json({ success: true, message: `Removed ${normalized}`, recipients: await dbHelpers.getRecipients(userId) });
  }

  if (action === "toggle") {
    const list = await dbHelpers.getRecipients(userId);
    const r = list.find(x => x.phone === normalized);
    if (!r) return res.status(404).json({ error: "Recipient not found." });
    await dbHelpers.updateRecipient(userId, normalized, { active: !r.active });
    return res.json({ success: true, recipients: await dbHelpers.getRecipients(userId) });
  }

  // add
  const existingRecipients = await dbHelpers.getRecipients(userId);
  if (existingRecipients.some(x => x.phone === normalized)) {
    return res.status(409).json({ error: "Recipient already exists.", recipients: existingRecipients });
  }
  await dbHelpers.updateRecipient(userId, normalized, { name: name || normalized, active: true });
  res.json({ success: true, recipients: await dbHelpers.getRecipients(userId) });
});

// GET /api/recipients
app.get("/api/recipients", async (req, res) => {
  const list = await dbHelpers.getRecipients(req.user.id);
  res.json({ recipients: list, total: list.length });
});

// ── Schedule: auto-fetch + auto-send on cron
app.post("/api/schedule", async (req, res) => {
  const { cronExpr, categories, count, enabled, autoSend = false } = req.body;
  const userId = req.user.id;

  // Stop existing job
  if (userJobs.has(userId)) {
    userJobs.get(userId).stop();
    userJobs.delete(userId);
  }

  const user = await dbHelpers.findUser({ id: userId });
  const settings = user.settings || {};

  if (!enabled) {
    await dbHelpers.updateUser(userId, { settings: { ...settings, scheduler: { enabled: false } } });
    return res.json({ scheduled: false, message: "Scheduler stopped." });
  }

  if (!cron.validate(cronExpr)) return res.status(400).json({ error: "Invalid cron" });

  const conf = { cronExpr, categories, count, autoSend, enabled: true };
  await dbHelpers.updateUser(userId, { settings: { ...settings, scheduler: conf } });

  const job = cron.schedule(cronExpr, async () => {
    console.log(`⏰ [CRON] User:${req.user.username} | cats:${categories.join(",")}`);
    await fetchAndAnalyze(categories, count, autoSend, userId);
  });
  userJobs.set(userId, job);

  res.json({ scheduled: true, message: "🚀 Autonomous engine active" });
});

app.get("/api/schedule", async (req, res) => {
  const user = await dbHelpers.findUser({ id: req.user.id });
  res.json(user?.settings?.scheduler || { enabled: false });
});
// ── History
app.get("/api/history", (req, res) => {
  const userId = req.user.id;
  const history = db.get("history").filter({ userId }).value();
  res.json({ digests: history, total: history.length });
});

// ── Logs
app.get("/api/logs", (_req, res) => {
  res.json({ logs: systemLogs, total: systemLogs.length });
});

app.post("/api/logs/remote", (req, res) => {
  const { level, message, detail } = req.body;
  const entry = {
    timestamp: new Date().toISOString(),
    level: (level || "INFO").toUpperCase(),
    message: message || "Remote Log",
    detail,
    origin: "mobile"
  };
  systemLogs.unshift(entry);
  if (systemLogs.length > 200) systemLogs.pop();
  res.json({ success: true });
});

// ── Send log
app.get("/api/send-log", (_req, res) => {
  res.json({ log: sendLog, total: sendLog.length });
});

// ── Full status
app.get("/api/status", async (req, res) => {
  const user = await dbHelpers.findUser({ id: req.user.id });
  const userHistory = await dbHelpers.getHistory(req.user.id);

  res.json({
    scheduled: userJobs.has(req.user.id),
    config: user?.settings?.scheduler,
    historyCount: userHistory.length,
    uptime: Math.round(process.uptime()),
    sources: {
      thenewsapi: !!(user?.keys?.thenewsapi || KEYS.thenewsapi),
      newsapi: !!(user?.keys?.newsapi || KEYS.newsapi),
      worldnewsapi: !!(user?.keys?.worldnewsapi || KEYS.worldnewsapi),
      hackernews: true,
      nvidia_nim: !!(user?.keys?.nvidia || KEYS.nvidia),
    },
  });
});

// ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║   🚀  News Agent Server v4.0  —  port ${PORT}               ║`);
  console.log(`╠══════════════════════════════════════════════════════════╣`);
  console.log(`║  📡 News Sources:                                        ║`);
  console.log(`║   ${KEYS.thenewsapi ? "✅" : "❌"}  TheNewsAPI.com                              ║`);
  console.log(`║   ${KEYS.newsapi ? "✅" : "❌"}  NewsAPI.org                                 ║`);
  console.log(`║   ${KEYS.worldnewsapi ? "✅" : "❌"}  WorldNewsAPI.com                            ║`);
  console.log(`║   ✅  Hacker News  (FREE)                                ║`);
  console.log(`╠══════════════════════════════════════════════════════════╣`);
  console.log(`║  🧠 AI:  ${KEYS.nvidia ? "✅  NVIDIA NIM Llama 3.3 70B             " : "❌  disabled (add NVIDIA_API_KEY)          "}║`);
  console.log(`╠══════════════════════════════════════════════════════════╣`);
  console.log(`║  📱 Twilio WhatsApp: ${twilioClient ? "✅  READY                          " : "❌  Check TWILIO_* in .env            "}║`);
  console.log(`║   From: ${KEYS.twilioFrom.padEnd(46)}║`);
  console.log(`╠══════════════════════════════════════════════════════════╣`);
  console.log(`║  🔌 Endpoints:                                           ║`);
  console.log(`║   POST /api/news            fetch+analyze+optional send  ║`);
  console.log(`║   POST /api/send            send digest to WhatsApp      ║`);
  console.log(`║   POST /api/test-whatsapp   test ping to a number        ║`);
  console.log(`║   POST /api/recipients      add/remove recipients        ║`);
  console.log(`║   GET  /api/recipients      list recipients              ║`);
  console.log(`║   POST /api/schedule        set cron auto-send           ║`);
  console.log(`║   GET  /api/history         past digests                 ║`);
  console.log(`║   GET  /api/send-log        send history                 ║`);
  console.log(`║   GET  /api/status          full server status           ║`);
  console.log(`╠══════════════════════════════════════════════════════════╣`);
  console.log(`║  💻 WEB LOGIN:  http://localhost:${PORT}/login             ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);
});
