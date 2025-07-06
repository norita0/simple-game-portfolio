const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let waitingPlayer = null;
const games = {}; // roomID → { players: Set, hostID, scores, names }

io.on('connection', (socket) => {
  console.log(`🟢 Connected: ${socket.id}`);

  socket.on('joinRandom', () => {
    if (waitingPlayer) {
      const roomID = `room-${waitingPlayer.id}-${socket.id}`;
      waitingPlayer.data.name = waitingPlayer.data.name || 'Player 1';
      socket.data.name = socket.data.name || 'Player 2';
      socket.join(roomID);
      waitingPlayer.join(roomID);

      games[roomID] = {
        players: new Set([waitingPlayer.id, socket.id]),
        hostID: waitingPlayer.id,
        scores: { top: 0, bottom: 0 },
        names: {}
      };
      const p1 = waitingPlayer?.data?.name || 'Player 1';
      const p2 = socket?.data?.name || 'Player 2';
      names: [p2, p1] // note: socket joins second
      io.to(roomID).emit('countdownStart');

      setTimeout(() => {
        io.to(roomID).emit('startGame', {
          roomID,
          hostID: games[roomID].hostID,
          names: [p2, p1]
        });
      }, 3000);

      waitingPlayer = null;
    } else {
      waitingPlayer = socket;
    }
  });

  socket.on('createLobby', () => {
    const lobbyID = uuidv4().slice(0, 6);
    socket.join(lobbyID);
    games[lobbyID] = {
      players: new Set([socket.id]),
      hostID: socket.id,
      scores: { top: 0, bottom: 0 },
      names: {}
    };
    socket.emit('lobbyCreated', { lobbyID });
  });

  socket.on('joinLobby', ({ lobbyID, name }) => {
    const room = io.sockets.adapter.rooms.get(lobbyID);
    const game = games[lobbyID];
    socket.data.name = name;

    if (room && room.size === 1) {
      socket.join(lobbyID);
      game.players.add(socket.id);
      game.names[socket.id] = name;

      io.to(lobbyID).emit('countdownStart');

      setTimeout(() => {
        const names = [...game.players].map(id => {
          const s = io.sockets.sockets.get(id);
          return s?.data.name || 'Player';
        });
        const p1 = waitingPlayer.data.name;
        const p2 = socket.data.name;
        io.to(lobbyID).emit('startGame', {
          roomID: lobbyID,
          hostID: game.hostID,
          names : [p2, p1]
        });
      }, 3000);
    } else {
      socket.emit('lobbyError', 'Lobby not found or full');
    }
  });

  socket.on('paddleMove', ({ roomID, position }) => {
    socket.to(roomID).emit('opponentPaddle', position);
  });

  socket.on('puckMove', ({ roomID, position }) => {
    socket.to(roomID).emit('puckUpdate', position);
  });

  socket.on('goalScored', ({ roomID, scorer }) => {
  const game = games[roomID];
  if (!game) return;

  game.scores[scorer]++;
  io.to(roomID).emit('updateScore', {
    scores: game.scores,
    scorer
  });

  // End game if someone reaches 7
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

  socket.on('disconnect', () => {
    if (waitingPlayer?.id === socket.id) {
      waitingPlayer = null;
    }

    for (const [roomID, game] of Object.entries(games)) {
      if (game.players.has(socket.id)) {
        game.players.delete(socket.id);
        io.to(roomID).emit('playerLeft');
        console.log(`🔴 Disconnected: ${socket.id} from ${roomID}`);
      }
    }
  });
});

server.listen(3000, () => {
  console.log('🚀 Server listening on http://localhost:3000');
});