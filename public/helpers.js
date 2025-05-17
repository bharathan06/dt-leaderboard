// Ensures that the username is valid and exists.
export async function isValid(username) {
  const res = await fetch(`https://leetcode-api-faisalshohag.vercel.app/${username}`);
  const data = await res.json();
  if (data.errors && Array.isArray(data.errors) && data.errors[0]?.message === "That user does not exist.") {
    return 0;
  }
  return 1;
}

// Show or hide the loading icon by toggling Bootstrap's own .d-none class
export function showLoadingIcon(show) {
  const loadingIcon = document.getElementById('loading-icon');
  if (!loadingIcon) {
    console.error('Loading icon element not found in the DOM.');
    return;
  }
  if (show) {
    loadingIcon.classList.remove('d-none'); // Ensure the loading icon is visible
  } else {
    loadingIcon.classList.add('d-none'); // Ensure the loading icon is hidden
  }
}

// Fetches the LeetCode data using username.
export async function fetchLeetData(username) {
  const res = await fetch(`https://leetcode-api-faisalshohag.vercel.app/${username}`);
  const data = await res.json();
  return data;
}

// Calculates the solves this week.
export function calcSolvesThisWeek(submissionCalendar) {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const istOffsetMs = 5.5 * 3600 * 1000;
  const istNow = new Date(utcMs + istOffsetMs);

  const dow = istNow.getDay();
  const daySinceMon = (dow + 6) % 7;

  const monIst = new Date(
    istNow.getFullYear(),
    istNow.getMonth(),
    istNow.getDate() - daySinceMon,
    0, 0, 0
  );

  const monUtcMs = monIst.getTime() - istOffsetMs;
  const monSec = Math.floor(monUtcMs / 1000);

  let total = 0;
  for (const [tsStr, count] of Object.entries(submissionCalendar)) {
    const ts = Number(tsStr);
    if (ts >= monSec) total += count;
  }
  return total;
}

// Function to update the leaderboard and render HTML.
export async function loadLeaderboard() {
  showLoadingIcon(true); // Show loading icon at the start
  try {
    console.log('Loading leaderboard...');
    const res = await fetch('/solvesThisWeek');
    if (!res.ok) throw new Error(res.statusText);
    const users = await res.json();

    const tbody = document.getElementById('leaderboard-body');
    tbody.innerHTML = users.length
      ? users.map(u => `
          <tr>
            <td>${u.position}</td>
            <td>
            <a href="https://leetcode.com/u/${u.username}"
            target="_blank"
            rel="noopener norferrer"
            class="link-primary text-decoration-none"
              >${u.username}</a>
            </td>
            <td>${u.solvesThisWeek}</td>
          </tr>`).join('')
      : `<tr><td colspan="3" class="text-center">No data</td></tr>`;

    const res2 = await fetch('/weeklyWinners');
    if (!res2.ok) throw new Error(`Failed /weeklyWinners: ${res2.status}`);
    const winners = await res2.json();

    const winnersBody = document.getElementById('last-week-winners-body');
    winnersBody.innerHTML = winners.length
      ? winners.map(w => `
          <tr>
            <td>${w.rank}</td>
            <td>${w.username}</td>
          </tr>`).join('')
      : `<tr><td colspan="2" class="text-center">No winners recorded yet</td></tr>`;
  } catch (err) {
    console.error('Error loading leaderboard:', err);
  } finally {
    console.log('Leaderboard data rendered. Hiding loading icon.');
    showLoadingIcon(false); // Hide loading icon after rendering
  }
}

// Function to refresh page every 5 minutes.
export function scheduleWeeklyRefresh() {
  const FIVE_MIN = 5 * 60 * 1000;
  setTimeout(async () => {
    await loadLeaderboard();
    scheduleWeeklyRefresh();
  }, FIVE_MIN);
}

// Compute Monday 00:00 IST as 'YYYY-MM-DD'.
export function computeWeekStartDateIST(offsetWeeks = 0) {
  const now = new Date();

  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const istMs = utcMs + 5.5 * 3600 * 1000;
  const istDate = new Date(istMs);

  const dow = istDate.getDay();
  const daysSinceMon = (dow + 6) % 7;
  istDate.setDate(istDate.getDate() - daysSinceMon + offsetWeeks * 7);
  istDate.setHours(0, 0, 0, 0);

  const yyyy = istDate.getFullYear();
  const mm = String(istDate.getMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}