const socket = io();

// UI Elements
const mainMenu = document.getElementById('main-menu');
const joinLobbyMenu = document.getElementById('join-lobby-menu');
const gameScreen = document.getElementById('game-screen');
const settingsModal = document.getElementById('settingsModal');

const playerNameInput = document.getElementById('playerName'); // Hidden input for initial name
const modalPlayerNameInput = document.getElementById('modalPlayerName'); // Input inside settings modal

const randomBtn = document.getElementById('randomBtn');
const createLobbyBtn = document.getElementById('createLobbyBtn');
const joinCustomBtn = document.getElementById('joinCustomBtn');
const joinLobbyBtn = document.getElementById('joinLobbyBtn');
const backToMainBtn = document.getElementById('backToMainBtn');
const settingsBtn = document.getElementById('settingsBtn');
const closeSettingsBtn = settingsModal.querySelector('.close-button');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const returnToMenuBtn = document.getElementById('returnToMenuBtn');
const rematchBtn = document.getElementById('rematchBtn');

const lobbyInput = document.getElementById('lobbyInput');
const lobbyError = document.getElementById('lobbyError');
const gameStatusEl = document.getElementById('gameStatus');
const lobbyIDDisplay = document.getElementById('lobbyIDDisplay');
const countdownEl = document.getElementById('countdown');
const playerReadyContainer = document.getElementById('playerReadyContainer');
const playerReadyBtn = document.getElementById('playerReadyBtn');

const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');

// Game State
let puck = {
  x: gameCanvas.width / 2,
  y: gameCanvas.height / 2,
  vx: 0,
  vy: 0,
  radius: 15,
  friction: 0.99 // Simulates air hockey friction
};
let paddle = { x: gameCanvas.width / 2, y: gameCanvas.height - 70, radius: 30, vx: 0, vy: 0 };
let opponent = { x: gameCanvas.width / 2, y: 70, radius: 30 };
let scores = { top: 0, bottom: 0 };
let playerLabels = ['Opponent', 'You'];

let puckLocked = true; // Puck is locked until hit
let isHost = false;
let roomID = null; // This will now be set earlier
let matchmakingStartTime = 0;
let matchmakingInterval = null;
let playerIsReady = false;

// --- UI Navigation and Event Listeners ---

// Load player name from local storage or set default
window.onload = () => {
  const savedName = localStorage.getItem('playerName');
  if (savedName) {
    playerNameInput.value = savedName;
    modalPlayerNameInput.value = savedName;
  } else {
    playerNameInput.value = `Player${Math.floor(Math.random() * 1000)}`;
    modalPlayerNameInput.value = playerNameInput.value;
  }
};

randomBtn.onclick = () => {
  showGameScreen();
  gameStatusEl.textContent = 'Matchmaking...';
  lobbyIDDisplay.classList.add('hidden');
  matchmakingStartTime = Date.now();
  matchmakingInterval = setInterval(updateMatchmakingTime, 1000);
  socket.emit('joinRandom', { name: playerNameInput.value.trim() });
};

createLobbyBtn.onclick = () => {
  showGameScreen();
  gameStatusEl.textContent = 'Waiting for opponent...';
  lobbyIDDisplay.classList.remove('hidden'); // Show lobby ID display
  matchmakingStartTime = Date.now();
  matchmakingInterval = setInterval(updateMatchmakingTime, 1000);
  socket.emit('createLobby', { name: playerNameInput.value.trim() });
};

joinCustomBtn.onclick = () => {
  showJoinLobbyMenu();
};

joinLobbyBtn.onclick = () => {
  const id = lobbyInput.value.trim();
  if (id) {
    lobbyError.classList.add('hidden');
    socket.emit('joinLobby', { lobbyID: id, name: playerNameInput.value.trim() });
  } else {
    lobbyError.textContent = 'Please enter a Lobby ID.';
    lobbyError.classList.remove('hidden');
  }
};

backToMainBtn.onclick = () => {
  socket.emit('leaveGame', { roomID }); // Emit leave game when going back to main menu
  showMainMenu();
  resetGameUI();
};

settingsBtn.onclick = () => {
  settingsModal.classList.remove('hidden');
  modalPlayerNameInput.value = playerNameInput.value; // Sync current name to modal
};

closeSettingsBtn.onclick = () => {
  settingsModal.classList.add('hidden');
};

saveSettingsBtn.onclick = () => {
  const newName = modalPlayerNameInput.value.trim();
  if (newName) {
    playerNameInput.value = newName;
    localStorage.setItem('playerName', newName);
  }
  settingsModal.classList.add('hidden');
};

returnToMenuBtn.onclick = () => {
  socket.emit('leaveGame', { roomID });
  showMainMenu();
  resetGameUI();
};

rematchBtn.onclick = () => {
  // Reset scores and UI, then request rematch from server
  scores = { top: 0, bottom: 0 };
  resetGameUI(); // Resets UI elements like ready button, countdown
  showGameScreen(); // Ensures game screen is visible
  gameStatusEl.textContent = 'Waiting for opponent to accept rematch...';
  playerReadyContainer.classList.add('hidden'); // Hide ready button initially
  rematchBtn.classList.add('hidden');
  returnToMenuBtn.classList.add('hidden'); // Hide during rematch wait
  socket.emit('requestRematch', { roomID, name: playerNameInput.value.trim() });
};

playerReadyBtn.onclick = () => {
  if (!playerIsReady) {
    playerIsReady = true;
    playerReadyBtn.classList.add('clicked');
    socket.emit('playerReady', { roomID }); // roomID should now be correctly set
  }
};

// Prevent right-click context menu on canvas
gameCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Mouse movement for paddle
gameCanvas.addEventListener('mousemove', (e) => {
  const rect = gameCanvas.getBoundingClientRect();
  const scaleX = gameCanvas.width / rect.width;
  const scaleY = gameCanvas.height / rect.height;

  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  // Restrict paddle to player's half
  if (y > gameCanvas.height / 2 + paddle.radius) {
    paddle.x = Math.max(paddle.radius, Math.min(x, gameCanvas.width - paddle.radius));
    paddle.y = Math.max(gameCanvas.height / 2 + paddle.radius, Math.min(y, gameCanvas.height - paddle.radius));
    socket.emit('paddleMove', {
      roomID,
      position: { x: paddle.x, y: paddle.y }
    });
  }
});

// --- UI Display Functions ---

function showMainMenu() {
  mainMenu.classList.remove('hidden');
  joinLobbyMenu.classList.add('hidden');
  gameScreen.classList.add('hidden');
  settingsModal.classList.add('hidden');
  clearInterval(matchmakingInterval);
  matchmakingInterval = null;
  roomID = null; // Clear roomID when returning to main menu
}

function showJoinLobbyMenu() {
  mainMenu.classList.add('hidden');
  joinLobbyMenu.classList.remove('hidden');
  gameScreen.classList.add('hidden');
  settingsModal.classList.add('hidden');
  lobbyError.classList.add('hidden'); // Clear previous errors
  lobbyInput.value = ''; // Clear input
  roomID = null; // Clear roomID
}

function showGameScreen() {
  mainMenu.classList.add('hidden');
  joinLobbyMenu.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  settingsModal.classList.add('hidden');
  rematchBtn.classList.add('hidden');
  returnToMenuBtn.classList.remove('hidden'); // Always show return to menu in game
  playerReadyContainer.classList.add('hidden');
  countdownEl.classList.add('hidden');
  gameStatusEl.textContent = ''; // Clear any previous game status
  lobbyIDDisplay.classList.add('hidden'); // Hide lobby ID by default
}

function updateMatchmakingTime() {
  const elapsed = Math.floor((Date.now() - matchmakingStartTime) / 1000);
  gameStatusEl.textContent = `Matchmaking... time elapsed: ${elapsed}s`;
}

function resetGameUI() {
  puckLocked = true;
  playerIsReady = false;
  playerReadyBtn.classList.remove('clicked');
  playerReadyContainer.classList.add('hidden');
  countdownEl.classList.add('hidden');
  gameStatusEl.textContent = '';
  lobbyIDDisplay.classList.add('hidden');
  rematchBtn.classList.add('hidden');
  returnToMenuBtn.classList.add('hidden'); // Hide when not in active game
  scores = { top: 0, bottom: 0 }; // Reset scores
  puck.x = gameCanvas.width / 2;
  puck.y = gameCanvas.height / 2;
  puck.vx = 0;
  puck.vy = 0;
  paddle.x = gameCanvas.width / 2;
  paddle.y = gameCanvas.height - 70;
  opponent.x = gameCanvas.width / 2;
  opponent.y = 70;
}

// --- Socket Event Handlers ---

socket.on('lobbyCreated', ({ lobbyID: id }) => {
  roomID = id; // Set roomID immediately upon lobby creation
  lobbyIDDisplay.textContent = `Lobby ID: ${roomID}`;
  lobbyIDDisplay.classList.remove('hidden'); // Show lobby ID
  clearInterval(matchmakingInterval);
  matchmakingInterval = null;
});

socket.on('lobbyError', (msg) => {
  lobbyError.textContent = `Error: ${msg}`;
  lobbyError.classList.remove('hidden');
  // Remain on the join lobby menu to allow user to retry
});

socket.on('matchFound', ({ roomID: id, hostID, names }) => {
  roomID = id; // Crucial: Set roomID here for both players
  isHost = socket.id === hostID; // Set host status
  
  // Determine player labels based on host status
  const playerIds = Object.keys(names);
  const opponentId = playerIds.find(key => key !== socket.id);
  playerLabels = [names[opponentId], names[socket.id]];

  showGameScreen(); // Transition to game screen for both players
  clearInterval(matchmakingInterval);
  matchmakingInterval = null;
  gameStatusEl.textContent = 'Match found!';
  lobbyIDDisplay.classList.add('hidden'); // Hide lobby ID once match is found

  // Changed from 3000ms to 1000ms as requested
  setTimeout(() => {
    gameStatusEl.textContent = '';
    playerReadyContainer.classList.remove('hidden');
    playerReadyBtn.classList.remove('clicked'); // Ensure ready button is not "clicked"
    playerIsReady = false; // Reset ready state
  }, 1000); // Changed to 1 second
});

socket.on('opponentReady', () => {
  // Visual feedback that opponent is ready
  console.log('Opponent is ready!');
});

socket.on('countdownStart', () => {
  playerReadyContainer.classList.add('hidden');
  countdownEl.classList.remove('hidden');
  let count = 3;
  countdownEl.textContent = count;
  const interval = setInterval(() => {
    count--;
    countdownEl.textContent = count > 0 ? count : 'GO!';
    if (count < 0) {
      clearInterval(interval);
      countdownEl.classList.add('hidden');
    }
  }, 1000);
});

socket.on('startGame', ({ roomID: id, hostID, names }) => {
  roomID = id; // Ensure roomID is set (redundant but safe)
  isHost = socket.id === hostID;
  puckLocked = true; // Puck starts locked, waiting for player hit
  playerIsReady = false; // Reset ready state for new game
  playerReadyBtn.classList.remove('clicked'); // Reset ready button visual
  
  // Determine player labels based on host status
  const playerIds = Object.keys(names);
  const opponentId = playerIds.find(key => key !== socket.id);
  
  playerLabels = [names[opponentId], names[socket.id]];

  // Reset paddle and puck positions for a new game
  puck.x = gameCanvas.width / 2;
  puck.y = gameCanvas.height / 2;
  puck.vx = 0;
  puck.vy = 0;
  paddle.x = gameCanvas.width / 2;
  paddle.y = gameCanvas.height - 70;
  opponent.x = gameCanvas.width / 2;
  opponent.y = 70;
  scores = { top: 0, bottom: 0 }; // Ensure scores are reset on game start

  requestAnimationFrame(gameLoop); // Start/continue game loop
});

socket.on('opponentPaddle', (pos) => {
  // Opponent's paddle position is relative to their screen (host's perspective),
  // so we need to invert X and Y for our display to make it appear correctly.
  opponent.x = gameCanvas.width - pos.x; // Invert X
  opponent.y = gameCanvas.height - pos.y; // Invert Y
});

socket.on('puckUpdate', (pos) => {
  // Update puck position from server. The server sends host's perspective.
  // If this client is NOT the host, invert X and Y to match opponent's view.
  if (!isHost) {
    puck.x = gameCanvas.width - pos.x; // Invert X for non-host
    puck.y = gameCanvas.height - pos.y; // Invert Y for non-host
    puck.vx = -pos.vx; // Invert Vx for non-host
    puck.vy = -pos.vy; // Invert Vy for non-host
  } else {
    // If this client IS the host, use position directly as it's already authoritative
    puck.x = pos.x;
    puck.y = pos.y;
    puck.vx = pos.vx;
    puck.vy = pos.vy;
  }
  puckLocked = pos.puckLocked; // Update local puckLocked state from host
});

socket.on('updateScore', ({ scores: newScores }) => {
  scores = newScores;
  puckLocked = true; // Lock puck after a goal
});

socket.on('resetPuck', () => {
  puck.x = gameCanvas.width / 2;
  puck.y = gameCanvas.height / 2;
  puck.vx = 0;
  puck.vy = 0;
  puckLocked = true; // Puck remains locked until hit by a player
  // Removed the setTimeout that previously auto-started the puck for the host.
});

socket.on('gameOver', ({ winner }) => {
  puckLocked = true;
  const didWin = (isHost && winner === 'bottom') || (!isHost && winner === 'top');
  ctx.fillStyle = 'black';
  ctx.font = '48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(didWin ? 'You Win!' : 'You Lose 😢', gameCanvas.width / 2, gameCanvas.height / 2);
  rematchBtn.classList.remove('hidden');
  returnToMenuBtn.classList.remove('hidden'); // Keep return to menu button
});

socket.on('playerLeft', () => {
  puckLocked = true;
  gameStatusEl.textContent = 'Opponent left the match. You win!';
  gameStatusEl.style.color = 'green';
  rematchBtn.classList.add('hidden'); // Hide rematch button
  returnToMenuBtn.classList.remove('hidden'); // Only show return to menu
});

socket.on('rematchAccepted', () => {
  // Both players are ready for rematch, server will send 'countdownStart'
  gameStatusEl.textContent = 'Rematch accepted! Starting soon...';
});

// NEW: Event listener for host to receive puck impulse from opponent
socket.on('applyPuckImpulse', ({ roomID, puckVx, puckVy }) => {
    // This event is ONLY received by the host when a non-host hits the puck
    if (isHost) {
        puck.vx = puckVx;
        puck.vy = puckVy;
        if (puckLocked) { // Ensure puck is unlocked if it was the first hit
            puckLocked = false;
        }
        console.log(`Host received impulse from opponent. New puck velocity: (${puck.vx}, ${puck.vy})`);
    }
});


// --- Game Loop and Drawing ---

function gameLoop() {
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  drawBoard();

  // Always check collision for the local player's paddle
  // This will either apply physics (if host) or emit puckHitByClient (if non-host)
  checkPaddleCollision(paddle);

  // Only the host handles puck physics and opponent paddle collisions
  if (isHost) {
    // Apply friction
    puck.vx *= puck.friction;
    puck.vy *= puck.friction;

    // Minimum speed to stop movement to prevent infinite sliding
    const minSpeedThreshold = 0.1;
    if (Math.abs(puck.vx) < minSpeedThreshold) puck.vx = 0;
    if (Math.abs(puck.vy) < minSpeedThreshold) puck.vy = 0;

    puck.x += puck.vx;
    puck.y += puck.vy;

    // Clamp puck position to prevent it from going out of bounds
    puck.x = Math.max(puck.radius, Math.min(puck.x, gameCanvas.width - puck.radius));
    puck.y = Math.max(puck.radius, Math.min(puck.y, gameCanvas.height - puck.radius));

    // Wall collision (now only for velocity reflection, position is already clamped)
    if (puck.x === puck.radius || puck.x === gameCanvas.width - puck.radius) {
        puck.vx *= -1;
    }
    if (puck.y === puck.radius || puck.y === gameCanvas.height - puck.radius) {
        puck.vy *= -1;
    }

    // Goal detection
    const goalWidth = 100;
    const goalStart = (gameCanvas.width - goalWidth) / 2;
    const goalEnd = (gameCanvas.width + goalWidth) / 2;

    // Top goal
    if (puck.y <= puck.radius && puck.x >= goalStart && puck.x <= goalEnd) {
      socket.emit('goalScored', { roomID, scorer: 'bottom' }); // 'bottom' scores if puck enters top goal
    }

    // Bottom goal
    if (puck.y >= gameCanvas.height - puck.radius && puck.x >= goalStart && puck.x <= goalEnd) {
      socket.emit('goalScored', { roomID, scorer: 'top' }); // 'top' scores if puck enters bottom goal
    }

    // Host also checks collision for the opponent's paddle to maintain authoritative state
    checkPaddleCollision(opponent); // This will be the opponent's paddle, not the local one

    // Send puck position and velocity to opponent
    socket.emit('puckMove', { roomID, position: { x: puck.x, y: puck.y, vx: puck.vx, vy: puck.vy, puckLocked: puckLocked } });
  }

  drawPlayer(opponent, 'blue', playerLabels[0], true);
  drawPlayer(paddle, 'red', playerLabels[1], false);
  drawPuck();
  drawScore();

  requestAnimationFrame(gameLoop);
}

function drawBoard() {
  const width = gameCanvas.width;
  const height = gameCanvas.height;
  const goalWidth = 100;
  const goalLineThickness = 8;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  // Center line
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  // Center circle
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 50, 0, Math.PI * 2);
  ctx.stroke();

  // Goals
  ctx.lineWidth = goalLineThickness;
  ctx.beginPath();
  ctx.moveTo((width - goalWidth) / 2, 0);
  ctx.lineTo((width + goalWidth) / 2, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo((width - goalWidth) / 2, height);
  ctx.lineTo((width + goalWidth) / 2, height);
  ctx.stroke();

  ctx.lineWidth = 1; // Reset line width
}

function drawPlayer(p, color, label, isOpponent) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'black';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  const offset = isOpponent ? 45 : -40;
  ctx.fillText(label, p.x, p.y + offset);
}

function drawPuck() {
  ctx.fillStyle = 'black';
  ctx.beginPath();
  ctx.arc(puck.x, puck.y, puck.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawScore() {
  ctx.fillStyle = 'black';
  ctx.font = '18px sans-serif';
  ctx.fillText(`You: ${isHost ? scores.bottom : scores.top}`, 20, gameCanvas.height - 20);
  ctx.fillText(`Opponent: ${isHost ? scores.top : scores.bottom}`, 20, 30);
}

function checkPaddleCollision(p) {
  const dx = puck.x - p.x;
  const dy = puck.y - p.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = puck.radius + p.radius; // Puck radius + paddle radius

  if (dist < minDist) {
    // Collision detected
    const angle = Math.atan2(dy, dx);
    const overlap = minDist - dist;

    // Move puck out of collision (local visual correction)
    puck.x += Math.cos(angle) * overlap;
    puck.y += Math.sin(angle) * overlap;

    // Calculate potential new velocity based on collision
    const paddleSpeed = Math.sqrt(p.vx ** 2 + p.vy ** 2);
    const puckCurrentSpeed = Math.sqrt(puck.vx ** 2 + puck.vy ** 2);

    let newPuckVx = Math.cos(angle) * puckCurrentSpeed;
    let newPuckVy = Math.sin(angle) * puckCurrentSpeed;

    const hitStrength = 0.5; // Controls how much paddle speed influences puck speed
    newPuckVx += p.vx * hitStrength;
    newPuckVy += p.vy * hitStrength;

    const maxPuckSpeed = 15; // Max speed limit for the puck
    const currentSpeed = Math.sqrt(newPuckVx * newPuckVx + newPuckVy * newPuckVy);
    if (currentSpeed > maxPuckSpeed) {
      const ratio = maxPuckSpeed / currentSpeed;
      newPuckVx *= ratio;
      newPuckVy *= ratio;
    }

    // Only the host applies physics directly.
    // Non-hosts send the calculated impulse to the host.
    if (isHost) {
      puck.vx = newPuckVx;
      puck.vy = newPuckVy;
      if (puckLocked) {
        puckLocked = false;
      }
    } else {
      // Non-host: Only if this collision is with the local player's paddle (p === paddle)
      // Emit an event to the server with the calculated impulse
      if (p === paddle) { // Ensure it's the local player's paddle hitting the puck
          socket.emit('puckHitByClient', { roomID, vx: newPuckVx, vy: newPuckVy });
          // CLIENT-SIDE PREDICTION: Non-host immediately updates its local puck's velocity for responsiveness.
          // This makes the puck move in the expected direction instantly on the non-host's screen.
          puck.vx = newPuckVx;
          puck.vy = newPuckVy;
          if (puckLocked) {
            puckLocked = false;
          }
      }
    }
  }
}

// Store previous paddle position to calculate its velocity
let prevPaddleX = paddle.x;
let prevPaddleY = paddle.y;

// Update paddle velocity periodically
setInterval(() => {
  paddle.vx = paddle.x - prevPaddleX;
  paddle.vy = paddle.y - prevPaddleY;
  prevPaddleX = paddle.x;
  prevPaddleY = paddle.y;
}, 50); // Increased frequency for more accurate velocity calculation
