import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';


import { db, insertWeeklyWinners, getWeeklyWinners } from '../src/db.js';
import {
  isValid,
  fetchLeetData,
  calcSolvesThisWeek,
  computeWeekStartDateIST
} from '../public/helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Debug Logger
app.use((req, res, next) => {
  console.log(`[DEBUG] ${req.method} ${req.url}`);
  next();
});

// Serve static assets from public/
app.use(express.static(path.join(__dirname, '../public')));


// api endpoints : 

// Add User
app.post('/api/addUser', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });

  try {
    if (!(await isValid(username))) {
      return res.status(400).json({ error: 'Enter a valid username' });
    }
    db.prepare("INSERT INTO users (username) VALUES (?)").run(username);
    res.json({ message: 'User added successfully' });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({ error: 'User already exists' });
    }
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Fetch All Users
app.get('/api/fetchUsers', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, username, solved_count,
             RANK() OVER (ORDER BY solved_count DESC) AS position
      FROM users
      ORDER BY solved_count DESC
    `).all();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Fetch Solves This Week
app.get('/api/solvesThisWeek', async (req, res) => {
  try {
    const users = db.prepare('SELECT username FROM users').all();
    const results = [];

    for (const { username } of users) {
      try {
        const data = await fetchLeetData(username);
        const count = calcSolvesThisWeek(data.submissionCalendar);
        results.push({ username, solvesThisWeek: count });
      } catch (e) {
        console.error(`Error for ${username}:`, e.message);
      }
    }

    // sort & add positions
    results.sort((a, b) =>
      b.solvesThisWeek - a.solvesThisWeek ||
      a.username.localeCompare(b.username)
    );
    results.forEach((u, i) => u.position = i + 1);

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch solves' });
  }
});

// Get Weekly Winners
app.get('/api/weeklyWinners', (req, res) => {
  try {
    const weekStart = req.query.weekStart || computeWeekStartDateIST(-1);
    const winners = getWeeklyWinners(weekStart);
    res.json(winners);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch weekly winners' });
  }
});

// Weekly cron job on Monday 
cron.schedule('0 0 * * 1', async () => {
  console.log('Weekly snapshot at', new Date().toISOString());
  try {
    const users = db.prepare('SELECT username FROM users').all();
    const stats = [];

    for (const { username } of users) {
      try {
        const data = await fetchLeetData(username);
        const solves = calcSolvesThisWeek(data.submissionCalendar);
        db.prepare('UPDATE users SET solved_count = solved_count + ? WHERE username = ?')
          .run(solves, username);
        stats.push({ username, solves });
      } catch (e) {
        console.error(`Error for ${username}:`, e.message);
      }
    }

    stats.sort((a, b) =>
      b.solves - a.solves ||
      a.username.localeCompare(b.username)
    );
    const top3 = stats.slice(0, 3);
    const weekStartDate = computeWeekStartDateIST(0);
    insertWeeklyWinners(weekStartDate, top3);
    console.log(`Snapshot for week ${weekStartDate}:`, top3);
  } catch (err) {
    console.error('Cron error:', err);
  }
}, { timezone: 'Asia/Kolkata' });


export default app;
