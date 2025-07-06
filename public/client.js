const socket = io();

const playerName = document.getElementById('playerName');
const randomBtn = document.getElementById('randomBtn');
const customBtn = document.getElementById('customBtn');
const createLobbyBtn = document.getElementById('createLobbyBtn');
const joinLobbyBtn = document.getElementById('joinLobbyBtn');
const restartBtn = document.getElementById('restartBtn');
const lobbyInput = document.getElementById('lobbyInput');

const mainMenu = document.getElementById('main-menu');
const customMenu = document.getElementById('custom-menu');
const lobbyStatus = document.getElementById('lobbyStatus');
const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');
const countdownEl = document.getElementById('countdown');

let puck = {
  x: gameCanvas.width / 2,
  y: gameCanvas.height / 2,
  vx: 0,
  vy: 0,
  radius: 15
};
let paddle = {
  x: gameCanvas.width / 2,
  y: gameCanvas.height - 70 // bottom side, just above goal line
};

let opponent = {
  x: gameCanvas.width / 2,
  y: 70 // top side, just below goal line
};
let scores = { top: 0, bottom: 0 };
let playerLabels = ['Opponent', 'You'];

let puckLocked = true;
let isHost = false;
let roomID = null;

randomBtn.onclick = () => socket.emit('joinRandom');
customBtn.onclick = () => {
  mainMenu.classList.add('hidden');
  customMenu.classList.remove('hidden');
};
createLobbyBtn.onclick = () => socket.emit('createLobby');
joinLobbyBtn.onclick = () => {
  const id = lobbyInput.value.trim();
  if (id) {
    socket.emit('joinLobby', { lobbyID: id, name: playerName.value });
  }
};
restartBtn.onclick = () => {
  socket.emit('joinLobby', { lobbyID: roomID, name: playerName.value });
  restartBtn.classList.add('hidden');
};

socket.on('lobbyCreated', ({ lobbyID }) => {
  lobbyStatus.textContent = `Lobby created: ${lobbyID}`;
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
socket.on('startGame', ({ roomID: id, hostID, names }) => {
  roomID = id;
  isHost = socket.id === hostID;
  puckLocked = false;
  playerLabels = isHost ? [names[1], names[0]] : [names[0], names[1]];
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
    puck.y = gameCanvas.height - pos.y;
  }
});
socket.on('updateScore', ({ scores: newScores }) => {
  scores = newScores;
  puckLocked = true;
});
socket.on('resetPuck', () => {
  puck.x = gameCanvas.width / 2;
  puck.y = gameCanvas.height / 2;
  puck.vx = 0;
  puck.vy = 0;
  setTimeout(() => {
    if (isHost) {
      puck.vx = 4;
      puck.vy = 3;
    }
    puckLocked = false;
  }, 800);
});
socket.on('playerLeft', () => {
  puckLocked = true;
  restartBtn.classList.remove('hidden');
});

socket.on('gameOver', ({ winner }) => {
  puckLocked = true;

  const isPlayerWinner = (isHost && winner === 'bottom') || (!isHost && winner === 'top');
  const message = isPlayerWinner ? 'You Win!' : 'You Lose';

  ctx.fillStyle = 'black';
  ctx.font = '48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(message, gameCanvas.width / 2, gameCanvas.height / 2);

  restartBtn.classList.remove('hidden');
});

function gameLoop() {
  const goalZoneStart = (gameCanvas.width - 100) / 2;
  const goalZoneEnd = (gameCanvas.width + 100) / 2;
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  drawBoard();

  if (!puckLocked && isHost) {
    puck.vx = Math.max(-6, Math.min(puck.vx, 6));
    puck.vy = Math.max(-6, Math.min(puck.vy, 6));
    puck.x += puck.vx;
    puck.y += puck.vy;

    if (puck.x <= puck.radius || puck.x >= gameCanvas.width - puck.radius)
      puck.vx *= -1;

    if (puck.y <= puck.radius || puck.y >= gameCanvas.height - puck.radius)
      puck.vy *= -1;

    // Only score if puck is between goal posts and crosses the line
    if (puck.y <= puck.radius && puck.x >= goalZoneStart && puck.x <= goalZoneEnd) {
      socket.emit('goalScored', { roomID, scorer: 'bottom' });
    }

    if (puck.y >= gameCanvas.height - puck.radius && puck.x >= goalZoneStart && puck.x <= goalZoneEnd) {
      socket.emit('goalScored', { roomID, scorer: 'top' });
    }

    checkPaddleCollision(paddle);
    checkPaddleCollision(opponent);

    socket.emit('puckMove', {
      roomID,
      position: { x: puck.x, y: puck.y }
    });
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

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Center line
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  // Center circle
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 50, 0, Math.PI * 2);
  ctx.stroke();

  // Top goal box line
  ctx.lineWidth = goalLineThickness;
  ctx.beginPath();
  ctx.moveTo((width - goalWidth) / 2, 0);
  ctx.lineTo((width + goalWidth) / 2, 0);
  ctx.stroke();

  // Bottom goal box line
  ctx.beginPath();
  ctx.moveTo((width - goalWidth) / 2, height);
  ctx.lineTo((width + goalWidth) / 2, height);
  ctx.stroke();

  // Restore default line width
  ctx.lineWidth = 1;
}

function drawPlayer(p, color, label, isOpponent = false) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'black';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';

  const labelOffset = isOpponent ? 45 : -40; // Place opponent label below, yours above
  ctx.fillText(label, p.x, p.y + labelOffset);
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
  const minDist = puck.radius + 30;
  if (dist < minDist) {
    const angle = Math.atan2(dy, dx);
    const overlap = minDist - dist;
    puck.x += Math.cos(angle) * overlap;
    puck.y += Math.sin(angle) * overlap;
    const speed = Math.sqrt(puck.vx ** 2 + puck.vy ** 2) || 5;
    puck.vx = Math.cos(angle) * speed;
    puck.vy = Math.sin(angle) * speed;
  }
}

gameCanvas.addEventListener('mousemove', (e) => {
  const rect = gameCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (y > gameCanvas.height / 2 + 30) {
    paddle.x = x;
    paddle.y = y;
    socket.emit('paddleMove', {
      roomID,
      position: { x: paddle.x, y: paddle.y }
    });
  }
});