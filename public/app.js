import { 
  isValid, 
  loadLeaderboard, 
  scheduleWeeklyRefresh, 
  showLoadingIcon 
} from './helpers.js';

// Rendering for adding username.
document.getElementById('addUserForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const alertContainer = document.getElementById('alert-container');

  try {
    const flag = await isValid(username);

    if (!flag) {
      alertContainer.innerHTML = `
        <div class="alert alert-danger alert-dismissible fade show" role="alert">
          Wrong username, skill issue.
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
      `;
      console.log(`Invalid username`);
      return;
    }

    console.log(`Adding user: ${username}...`);
    const endpoint = '/api/addUser';
    const response = await fetch(endpoint, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      let errorMessage = errorData?.error || `Failed to add user: ${response.statusText}`;
      if (response.status === 404) {
        errorMessage = "The requested resource or endpoint was not found.";
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log(result.message);

    alertContainer.innerHTML = `
      <div class="alert alert-success alert-dismissible fade show" role="alert">
        Congrats you are legal 👍
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;

    document.getElementById('username').value = '';
    const modal = bootstrap.Modal.getInstance(document.getElementById('addUserModal'));
    modal.hide();

    // Delay the page reload to allow the success message to stay visible
    setTimeout(() => {
      window.location.reload();
    }, 3000);
  } catch (err) {
    alertContainer.innerHTML = `
      <div class="alert alert-danger alert-dismissible fade show" role="alert">
        ${err.message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
    console.error('Error during user addition:', err);
  }

  setTimeout(() => {
    alertContainer.innerHTML = '';
  }, 5000);
});

// Rendering for page refresh and load leaderboard.
document.addEventListener('DOMContentLoaded', async () => {
  showLoadingIcon(true); // Show loading icon when the page loads
  try {
    console.log('Fetching leaderboard data...');
    await loadLeaderboard(); // Fetch and render leaderboard data
    scheduleWeeklyRefresh(); // Schedule the 5-minute refresh
  } catch (err) {
    console.error('Error during initial leaderboard load:', err);
  }
  console.log('Hiding loading icon after content is rendered.');
  showLoadingIcon(false); // Hide loading icon after data is loaded
});

const addUserModal = document.getElementById('addUserModal');
addUserModal.addEventListener('show.bs.modal', () => {
  addUserModal.removeAttribute('aria-hidden');
});
addUserModal.addEventListener('hide.bs.modal', () => {
  addUserModal.setAttribute('aria-hidden', 'true');
});