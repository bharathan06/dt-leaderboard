import Database from 'better-sqlite3';

export const db = new Database(process.env.DB_FILE);

// Create Users Table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    solved_count INTEGER NOT NULL DEFAULT 0
  );
`);

// Create Weekly Winners Table
db.exec(`
  CREATE TABLE IF NOT EXISTS weekly_winners (
    week_start TEXT NOT NULL,
    username TEXT NOT NULL,
    rank INTEGER NOT NULL,
    PRIMARY KEY (week_start, rank)
  );
`);

// Insert Weekly Winners
export function insertWeeklyWinners(weekStart, top3) {
  const insert = db.prepare(`
    INSERT INTO weekly_winners (week_start, username, rank) 
    VALUES (?, ?, ?)
  `);
  const del = db.prepare(`
    DELETE FROM weekly_winners WHERE week_start = ?
  `);

  const MAX_RETRIES = 3;
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      return db.transaction(() => {
        del.run(weekStart);
        top3.forEach(({ username }, idx) => {
          insert.run(weekStart, username, idx + 1);
        });
      })();
    } catch (err) {
      if (err.code === 'SQLITE_BUSY') {
        retries++;
        console.warn(`SQLITE_BUSY: Retrying transaction (${retries}/${MAX_RETRIES})...`);
        if (retries === MAX_RETRIES) throw new Error('Failed to insert weekly winners after multiple retries.');
      } else {
        throw err;
      }
    }
  }
}

// Get Weekly Winners
export function getWeeklyWinners(weekStart) {
  return db.prepare(`
    SELECT username, rank
    FROM weekly_winners
    WHERE week_start = ?
    ORDER BY rank ASC
  `).all(weekStart);
}