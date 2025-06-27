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
let puck = { x: 300, y: 200 };
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

socket.on('startGame', (data) => {
  puckLocked = false;
  roomID = data.roomID;
  requestAnimationFrame(gameLoop);
});


socket.on('opponentPaddle', (pos) => {
  opponent.x = pos.x;
  opponent.y = pos.y;
});

socket.on('puckUpdate', (pos) => {
  if (!puckLocked) {
    puck.x = pos.x;
    puck.y = pos.y;
  }
});

function gameLoop() {
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

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
  paddle.x = e.clientX - rect.left;
  paddle.y = e.clientY - rect.top;

  socket.emit('paddleMove', {
    roomID, // track this when the game starts
    position: { x: paddle.x, y: paddle.y }
  });
  if (!puckLocked) {
  socket.emit('puckMove', {
    roomID,
    position: { x: puck.x, y: puck.y }
  });
}
});
