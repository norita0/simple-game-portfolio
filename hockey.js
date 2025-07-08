const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let waitingPlayer = null;
const games = {}; // roomID → { players, hostID, scores, names }

io.on('connection', (socket) => {
  console.log(`🟢 Connected: ${socket.id}`);

  // RANDOM MATCH
  socket.on('joinRandom', () => {
    if (waitingPlayer?.id === socket.id) return; // Already waiting

    if (waitingPlayer) {
      const roomID = `room-${waitingPlayer.id}-${socket.id}`;
      socket.join(roomID);
      waitingPlayer.join(roomID);

      games[roomID] = {
        players: new Set([waitingPlayer.id, socket.id]),
        hostID: waitingPlayer.id,
        scores: { top: 0, bottom: 0 },
        names: {
          [waitingPlayer.id]: waitingPlayer.data?.name || 'Player 1',
          [socket.id]: socket.data?.name || 'Player 2'
        }
      };

      io.to(roomID).emit('countdownStart');
      setTimeout(() => {
        const names = [...games[roomID].players].map(id => games[roomID].names[id]);
        io.to(roomID).emit('startGame', {
          roomID,
          hostID: games[roomID].hostID,
          names
        });
        io.to(roomID).emit('resetPuck');
      }, 3000);

      waitingPlayer = null;
    } else {
      waitingPlayer = socket;
    }
  });

  // CREATE CUSTOM LOBBY
  socket.on('createLobby', ({ name }) => {
    socket.data.name = name;
    const lobbyID = uuidv4().slice(0, 6);
    socket.join(lobbyID);
    games[lobbyID] = {
      players: new Set([socket.id]),
      hostID: socket.id,
      scores: { top: 0, bottom: 0 },
      names: { [socket.id]: name }
    };
    socket.emit('lobbyCreated', { lobbyID });
  });

  // JOIN CUSTOM LOBBY
  socket.on('joinLobby', ({ lobbyID, name }) => {
    const game = games[lobbyID];
    const room = io.sockets.adapter.rooms.get(lobbyID);
    if (!game || !room || room.size !== 1) {
      socket.emit('lobbyError', 'Invalid or full lobby.');
      return;
    }

    socket.data.name = name;
    socket.join(lobbyID);
    game.players.add(socket.id);
    game.names[socket.id] = name;
    game.scores = { top: 0, bottom: 0 }; // Reset scores on rematch

    io.to(lobbyID).emit('countdownStart');
    setTimeout(() => {
      const names = [...game.players].map(id => game.names[id]);
      io.to(lobbyID).emit('startGame', {
        roomID: lobbyID,
        hostID: game.hostID,
        names
      });
      io.to(lobbyID).emit('resetPuck');
    }, 3000);
  });

  // PADDLE POSITION SYNC
  socket.on('paddleMove', ({ roomID, position }) => {
    socket.to(roomID).emit('opponentPaddle', position);
  });

  // PUCK POSITION SYNC
  socket.on('puckMove', ({ roomID, position }) => {
    socket.to(roomID).emit('puckUpdate', position);
  });

  // GOAL DETECTION + WIN STATE
  socket.on('goalScored', ({ roomID, scorer }) => {
    const game = games[roomID];
    if (!game) return;

    game.scores[scorer]++;
    io.to(roomID).emit('updateScore', { scores: game.scores, scorer });

    const { top, bottom } = game.scores;
    if (top === 7 || bottom === 7) {
      const winner = top === 7 ? 'top' : 'bottom';
      io.to(roomID).emit('gameOver', { winner });
      return;
    }

    setTimeout(() => {
      io.to(roomID).emit('resetPuck');
    }, 1500);
  });

  // DISCONNECT HANDLING
  socket.on('disconnect', () => {
    if (waitingPlayer?.id === socket.id) {
      waitingPlayer = null;
    }

    for (const [roomID, game] of Object.entries(games)) {
      if (game.players.has(socket.id)) {
        game.players.delete(socket.id);
        io.to(roomID).emit('playerLeft');
        console.log(`🔴 Disconnected from ${roomID}: ${socket.id}`);
      }
    }
  });
});

server.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});