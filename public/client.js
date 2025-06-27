// Connect to the server
const socket = io();

// Game variables
let canvas, ctx;
let myPaddle = { x: 100, y: 250 };
let opponentPaddle = { x: 100, y: 250 };
let puck = { x: 300, y: 200 };

// Main Menu Objects
const randomBtn = document.getElementById('randomBtn');
const customBtn = document.getElementById('customBtn');
const createLobbyBtn = document.getElementById('createLobbyBtn');
const joinLobbyBtn = document.getElementById('joinLobbyBtn');
const lobbyInput = document.getElementById('lobbyInput');
const lobbyStatus = document.getElementById('lobbyStatus');

const mainMenu = document.getElementById('main-menu');
const customMenu = document.getElementById('custom-menu');

// Initialize game
window.onload = () => {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');

  // Start the game loop
  requestAnimationFrame(gameLoop);

  // Handle mouse movement
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    myPaddle.x = e.clientX - rect.left;
    socket.emit('paddleMove', { x: myPaddle.x });
  });
};

// Player clicks on button
randomBtn.onclick = () => {
  socket.emit('joinRandom');
};

customBtn.onclick = () => {
  mainMenu.classList.add('hidden');
  customMenu.classList.remove('hidden');
};

createLobbyBtn.onclick = () => {
  socket.emit('createLobby');
};

joinLobbyBtn.onclick = () => {
  const lobbyID = lobbyInput.value.trim();
  if (lobbyID) {
    socket.emit('joinLobby', lobbyID);
  }
};

// Socket responses
socket.on('lobbyCreated', ({ lobbyID }) => {
  lobbyStatus.textContent = `Lobby created! Share this ID: ${lobbyID}`;
});

socket.on('lobbyError', (msg) => {
  lobbyStatus.textContent = `Error: ${msg}`;
});

socket.on('startGame', ({ roomID }) => {
  // Replace this with your game initialization logic
  alert(`Game starting in room: ${roomID}`);
});

// Receive opponent paddle position
socket.on('paddleMove', (data) => {
  opponentPaddle.x = data.x;
});

// Optionally receive puck updates from the server
socket.on('puckUpdate', (data) => {
  puck.x = data.x;
  puck.y = data.y;
});

// Game rendering loop
function gameLoop() {
  drawGame();
  requestAnimationFrame(gameLoop);
}

function drawGame() {
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw paddles
  ctx.fillStyle = 'blue';
  ctx.fillRect(myPaddle.x - 40, myPaddle.y, 80, 10);

  ctx.fillStyle = 'red';
  ctx.fillRect(opponentPaddle.x - 40, opponentPaddle.y, 80, 10);

  // Draw puck
  ctx.beginPath();
  ctx.arc(puck.x, puck.y, 10, 0, Math.PI * 2);
  ctx.fillStyle = 'black';
  ctx.fill();
}