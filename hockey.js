const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let waitingPlayer = null;
const games = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Paddle movements
  socket.on('paddleMove', (data) => {
    socket.to(data.roomID).emit('opponentPaddle', data.position);
  });
  // Puck movements
  socket.on('puckMove', (data) => {
    socket.to(data.roomID).emit('puckUpdate', data.position);
  });

  // RANDOM MATCHMAKING
  socket.on('joinRandom', () => {
    if (waitingPlayer) {
      const roomID = `room-${socket.id}-${waitingPlayer.id}`;
      socket.join(roomID);
      waitingPlayer.join(roomID);

      games[roomID] = { players: new Set([socket.id, waitingPlayer.id]), gameStarted: false };
      io.to(roomID).emit('countdownStart');

      setTimeout(() => {
        games[roomID].gameStarted = true;
        io.to(roomID).emit('startGame', { roomID });
      }, 3000);

      waitingPlayer = null;
    } else {
      waitingPlayer = socket;
    }
  });

  // CUSTOM LOBBY
  socket.on('createLobby', () => {
    const lobbyID = uuidv4().slice(0, 6);
    socket.join(lobbyID);
    socket.data.lobby = lobbyID;
    socket.emit('lobbyCreated', { lobbyID });
    games[lobbyID] = { players: new Set([socket.id]), gameStarted: false };
  });

  socket.on('joinLobby', (lobbyID) => {
    const room = io.sockets.adapter.rooms.get(lobbyID);
    const game = games[lobbyID];

    if (room && room.size === 1) {
      socket.join(lobbyID);
      game.players.add(socket.id);

      io.to(lobbyID).emit('countdownStart');
      setTimeout(() => {
        game.gameStarted = true;
        io.to(lobbyID).emit('startGame', { lobbyID });
      }, 3000);
    } else {
      socket.emit('lobbyError', 'Lobby not found or full');
    }
  });

  socket.on('disconnect', () => {
    for (const [lobbyID, game] of Object.entries(games)) {
      if (game.players.has(socket.id)) {
        game.players.delete(socket.id);
        io.to(lobbyID).emit('playerLeft');
      }
    }
    if (waitingPlayer === socket) waitingPlayer = null;
    console.log(`User disconnected: ${socket.id}`);
  });
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});