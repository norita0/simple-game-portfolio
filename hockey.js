const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let waitingPlayer = null;
const games = {}; // roomID -> { players: Set, hostID: string }

io.on('connection', (socket) => {
  console.log(`🟢 Connected: ${socket.id}`);

  // Handle random matchmaking
  socket.on('joinRandom', () => {
    if (waitingPlayer) {
      const roomID = `room-${waitingPlayer.id}-${socket.id}`;
      socket.join(roomID);
      waitingPlayer.join(roomID);

      games[roomID] = {
        players: new Set([waitingPlayer.id, socket.id]),
        hostID: waitingPlayer.id // first player is host
      };

      io.to(roomID).emit('countdownStart');

      setTimeout(() => {
        io.to(roomID).emit('startGame', {
          roomID,
          hostID: games[roomID].hostID
        });
      }, 3000);

      waitingPlayer = null;
    } else {
      waitingPlayer = socket;
    }
  });

  // Create custom lobby
  socket.on('createLobby', () => {
    const lobbyID = uuidv4().slice(0, 6); // short unique code
    socket.join(lobbyID);
    games[lobbyID] = {
      players: new Set([socket.id]),
      hostID: socket.id
    };
    socket.emit('lobbyCreated', { lobbyID });
  });

  // Join existing custom lobby
  socket.on('joinLobby', (lobbyID) => {
    const room = io.sockets.adapter.rooms.get(lobbyID);
    const game = games[lobbyID];

    if (room && room.size === 1) {
      socket.join(lobbyID);
      game.players.add(socket.id);

      io.to(lobbyID).emit('countdownStart');

      setTimeout(() => {
        io.to(lobbyID).emit('startGame', {
          roomID: lobbyID,
          hostID: game.hostID
        });
      }, 3000);
    } else {
      socket.emit('lobbyError', 'Lobby not found or already full');
    }
  });

  // Relay paddle movements
  socket.on('paddleMove', ({ roomID, position }) => {
    socket.to(roomID).emit('opponentPaddle', position);
  });

  // Relay puck position (only from host)
  socket.on('puckMove', ({ roomID, position }) => {
    socket.to(roomID).emit('puckUpdate', position);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    if (waitingPlayer?.id === socket.id) {
      waitingPlayer = null;
    }

    for (const [roomID, game] of Object.entries(games)) {
      if (game.players.has(socket.id)) {
        game.players.delete(socket.id);
        io.to(roomID).emit('playerLeft');
        console.log(`🔴 ${socket.id} left ${roomID}`);
      }
    }
  });
});

server.listen(3000, () => {
  console.log('🚀 Server running at http://localhost:3000');
});