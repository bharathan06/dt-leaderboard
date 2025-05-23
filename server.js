import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, insertWeeklyWinners, getWeeklyWinners } from './src/db.js';
import {
  isValid,
  fetchLeetData,
  calcSolvesThisWeek,
  computeWeekStartDateIST
} from './public/helpers.js';  

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Debug Logger
app.use((req, res, next) => {
  console.log(`[DEBUG] ${req.method} ${req.url}`);
  next();
});

// Serve the src directory for helper files
app.use('/src', express.static(path.join(__dirname, 'src')));

// Add User Endpoint
app.post('/addUser', async (req, res) => {
  console.log("POST /addUser", new Date().toISOString());
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    if (!(await isValid(username))) {
      return res.status(400).json({ error: 'Enter a valid username' });
    }
    db.prepare("INSERT INTO users (username) VALUES (?)").run(username);
    res.status(200).json({ message: 'User added successfully' });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('UNIQUE constraint failed: users.username')) {
      return res.status(409).json({ error: 'User already exists' });
    }
    console.error(err.message);
    res.status(500).json({ error: `Database Error: ${err.message}` });
  }
});

// Fetch All Users for Table Display
app.get('/fetchUsers', async (req, res) => {
  try {
    const select = db.prepare(`
      SELECT 
        id, 
        username, 
        solved_count, 
        RANK() OVER (ORDER BY solved_count DESC) AS position 
      FROM users 
      ORDER BY solved_count DESC
    `);
    const rows = select.all();
    res.json(rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Fetch Solves This Week
app.get('/solvesThisWeek', async (req, res) => {
  try {
    const users = db.prepare('SELECT username FROM users').all();
    const results = [];

    for (const { username } of users) {
      try {
        const data = await fetchLeetData(username);
        const count = calcSolvesThisWeek(data.submissionCalendar);
        results.push({ username, count });
      } catch (err) {
        console.error(`Error fetching data for user ${username}:`, err.message);
        continue;
      }
    }

    results.sort((a, b) =>
      b.count - a.count ||
      a.username.localeCompare(b.username)
    );
    results.forEach((u, i) => {
      u.position = i + 1;
      u.solvesThisWeek = u.count;
      delete u.count;
    });

    res.json(results);
  } catch (err) {
    console.error('Error in /solvesThisWeek:', err);
    res.status(500).json({ error: 'Failed to fetch solves this week.' });
  } finally {
    console.log('Completed /solvesThisWeek request'); 
  }
});

// Get Weekly Winners
app.get('/weeklyWinners', (req, res) => {
  try {
    const weekStart = req.query.weekStart || computeWeekStartDateIST(-1);
    const winners = getWeeklyWinners(weekStart);
    res.json(winners);
  } catch (err) {
    console.error('Error in /weeklyWinners:', err);
    res.status(500).json({ error: 'Failed to fetch weekly winners.' });
  }
});

// Cron Job for Weekly Snapshot
cron.schedule('0 0 * * 1', async () => {
  try {
    console.log('Weekly snapshot running at', new Date().toISOString());
    const users = db.prepare('SELECT username FROM users').all();
    const results = [];

    for (const { username } of users) {
      try {
        const data = await fetchLeetData(username);
        const solves = calcSolvesThisWeek(data.submissionCalendar);

        // Update solved_count in the users table
        db.prepare('UPDATE users SET solved_count = solved_count + ? WHERE username = ?')
          .run(solves, username);

        results.push({ username, solves });
      } catch (err) {
        console.error(`[${new Date().toISOString()}] Error fetching data for user ${username}:`, err.message);
        continue;
      }
    }

    results.sort((a, b) =>
      b.solves - a.solves ||
      a.username.localeCompare(b.username)
    );

    const top3 = results.slice(0, 3);
    const weekStartDate = computeWeekStartDateIST(0);

    insertWeeklyWinners(weekStartDate, top3);
    console.log(`Snapshot for week ${weekStartDate}:`, top3);
  } catch (err) {
    console.error('Error in weekly snapshot cron:', err);
  }
}, {
  timezone: 'Asia/Kolkata'
});

// Serve Static Files
app.use(express.static(path.join(__dirname, 'public')));
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
