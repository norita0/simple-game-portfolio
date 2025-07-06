const socket = io();

const playerName = document.getElementById('playerName');
const randomBtn = document.getElementById('randomBtn');
const customBtn = document.getElementById('customBtn');
const createLobbyBtn = document.getElementById('createLobbyBtn');
const joinLobbyBtn = document.getElementById('joinLobbyBtn');
const lobbyInput = document.getElementById('lobbyInput');

const mainMenu = document.getElementById('main-menu');
const customMenu = document.getElementById('custom-menu');
const lobbyStatus = document.getElementById('lobbyStatus');
const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');
const statusEl = document.getElementById('status');
const countdownEl = document.getElementById('countdown');

let puckLocked = true;
let puck = {
  x: gameCanvas.width / 2,
  y: gameCanvas.height / 2,
  vx: 0,
  vy: 0,
  radius: 15
};
let paddle = { x: 300, y: 380 };
let opponent = { x: 300, y: 20 };

randomBtn.onclick = () => socket.emit('joinRandom');
customBtn.onclick = () => {
  mainMenu.classList.add('hidden');
  customMenu.classList.remove('hidden');
};

createLobbyBtn.onclick = () => socket.emit('createLobby');
joinLobbyBtn.onclick = () => {
  const id = lobbyInput.value.trim();
  if (id) socket.emit('joinLobby', id);
};

socket.on('lobbyCreated', ({ lobbyID }) => {
  lobbyStatus.textContent = `Lobby created! Share this ID: ${lobbyID}`;
});

socket.on('lobbyError', (msg) => {
  lobbyStatus.textContent = `Error: ${msg}`;
});

socket.on('countdownStart', () => {
  mainMenu.classList.add('hidden');
  customMenu.classList.add('hidden');
  gameCanvas.classList.remove('hidden');
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

let roomID = null;
let isHost = false;

socket.on('startGame', (data) => {
  puckLocked = false;
  roomID = data.roomID;
  isHost = socket.id === data.hostID;
  console.log('Am I the host?', isHost);
  if (isHost) {
    puck.vx = 4;
    puck.vy = 3;
  }

  requestAnimationFrame(gameLoop);
});


socket.on('opponentPaddle', (pos) => {
  opponent.x = pos.x;
opponent.y = gameCanvas.height - pos.y;
});

socket.on('puckUpdate', (pos) => {
  if (!puckLocked) {
    puck.x = pos.x;
    puck.y = gameCanvas.height - pos.y; // ← mirror here
  }
});

function drawBoard() {
  // Fill background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

  // Center line
  ctx.strokeStyle = '#000000';
  ctx.beginPath();
  ctx.moveTo(0, gameCanvas.height / 2);
  ctx.lineTo(gameCanvas.width, gameCanvas.height / 2);
  ctx.stroke();

  // Center circle (optional)
  ctx.beginPath();
  ctx.arc(gameCanvas.width / 2, gameCanvas.height / 2, 50, 0, Math.PI * 2);
  ctx.stroke();
}

function checkPaddleCollision(p) {
  const dx = puck.x - p.x;
  const dy = puck.y - p.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = puck.radius + 30;

  if (dist < minDist) {
    const angle = Math.atan2(dy, dx);
    const overlap = minDist - dist;

    // Push puck out of the paddle
    puck.x += Math.cos(angle) * overlap;
    puck.y += Math.sin(angle) * overlap;

    // Reflect with damping
    const speed = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy) || 5;
    puck.vx = Math.cos(angle) * speed;
    puck.vy = Math.sin(angle) * speed;
  }
}

function gameLoop() {
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  drawBoard();
  
  if (!puckLocked && isHost) {
  // Update puck position
  const maxSpeed = 6;
  puck.vx = Math.max(-maxSpeed, Math.min(puck.vx, maxSpeed));
  puck.vy = Math.max(-maxSpeed, Math.min(puck.vy, maxSpeed));
  puck.x += puck.vx;
  puck.y += puck.vy;

  // Keep puck inside bounds after movement
  puck.x = Math.max(puck.radius, Math.min(puck.x, gameCanvas.width - puck.radius));
  puck.y = Math.max(puck.radius, Math.min(puck.y, gameCanvas.height - puck.radius));

  // Horizontal bounce
  if (puck.x <= puck.radius || puck.x >= gameCanvas.width - puck.radius) {
    puck.vx *= -1;
    puck.x = Math.max(puck.radius, Math.min(puck.x, gameCanvas.width - puck.radius));
  }

  // Vertical bounce (if not using goals)
  if (puck.y <= puck.radius || puck.y >= gameCanvas.height - puck.radius) {
    puck.vy *= -1;
    puck.y = Math.max(puck.radius, Math.min(puck.y, gameCanvas.height - puck.radius));
  }

  // Check paddle collisions
  checkPaddleCollision(paddle);
  checkPaddleCollision(opponent);

  // Emit puck position
  socket.emit('puckMove', {
    roomID,
    position: { x: puck.x, y: puck.y }
  });
  }

  // Draw paddles
  ctx.fillStyle = 'red';
  ctx.beginPath();
  ctx.arc(paddle.x, paddle.y, 30, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'blue';
  ctx.beginPath();
  ctx.arc(opponent.x, opponent.y, 30, 0, Math.PI * 2);
  ctx.fill();

  // Draw puck
  ctx.fillStyle = 'black';
  ctx.beginPath();
  ctx.arc(puck.x, puck.y, 15, 0, Math.PI * 2);
  ctx.fill();

  requestAnimationFrame(gameLoop);
}

// Control local paddle
gameCanvas.addEventListener('mousemove', (e) => {
  const rect = gameCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Restrict player to lower half
  if (y > gameCanvas.height / 2 + 30) {
    paddle.x = x;
    paddle.y = y;

    // Sent player paddle position
    socket.emit('paddleMove', {
      roomID,
      position: { x: paddle.x, y: paddle.y }
    });
  }
});
