const express = require('express');
const { v4: uuidv4 } = require('uuid');

const airHockeyRouter = express.Router();
let airHockeyIo;

// Serve the static files for the air hockey game from the public-hockey directory
airHockeyRouter.use(express.static('public-hockey'));

// This function is called from server.js to set up the Socket.IO namespace
const setup = (io) => {
  airHockeyIo = io.of('/air-hockey');
  
  // Game state and logic moved to be specific to this router's namespace
  let waitingPlayer = null;
  const games = {}; // roomID → { players: Set, hostID, scores, names, readyPlayers: Set, puckLocked: boolean, puck: {x, y, vx, vy} }

  airHockeyIo.on('connection', (socket) => {
    console.log(`🟢 Connected: ${socket.id}`);

    // --- RANDOM MATCH ---
    socket.on('joinRandom', ({ name }) => {
      if (waitingPlayer?.id === socket.id) return; // Already waiting

      socket.data.name = name; // Store player name on socket

      if (waitingPlayer) {
        // Match found
        const roomID = `room-${waitingPlayer.id}-${socket.id}`;
        socket.join(roomID);
        waitingPlayer.join(roomID);

        games[roomID] = {
          players: new Set([waitingPlayer.id, socket.id]),
          hostID: waitingPlayer.id, // Host is the first player who joined the random queue
          scores: { top: 0, bottom: 0 },
          names: {
            [waitingPlayer.id]: waitingPlayer.data.name || 'Player 1',
            [socket.id]: socket.data.name || 'Player 2'
          },
          readyPlayers: new Set(), // Track ready state for both players
          puckLocked: true, // Initialize puck as locked
          puck: { x: 250, y: 350, vx: 0, vy: 0 } // Initialize puck state on server
        };

        // Emit matchFound to both players, including roomID, hostID, and names
        airHockeyIo.to(roomID).emit('matchFound', {
          roomID,
          hostID: games[roomID].hostID,
          names: games[roomID].names
        });
        console.log(`Match found: ${roomID} between ${waitingPlayer.id} and ${socket.id}`);

        waitingPlayer = null; // Clear waiting player
      } else {
        // No waiting player, this player waits
        waitingPlayer = socket;
        console.log(`Player ${socket.id} is waiting for a random match.`);
      }
    });

    // --- CUSTOM LOBBY ---
    socket.on('createLobby', ({ name }) => {
      socket.data.name = name;
      const lobbyID = uuidv4().slice(0, 6); // Generate a short, unique ID
      socket.join(lobbyID);
      games[lobbyID] = {
        players: new Set([socket.id]),
        hostID: socket.id, // Host is the creator of the lobby
        scores: { top: 0, bottom: 0 },
        names: { [socket.id]: name },
        readyPlayers: new Set(),
        puckLocked: true, // Initialize puck as locked
        puck: { x: 250, y: 350, vx: 0, vy: 0 } // Initialize puck state on server
      };
      socket.emit('lobbyCreated', { lobbyID });
      console.log(`Lobby created: ${lobbyID} by ${socket.id}`);
    });

    socket.on('joinLobby', ({ lobbyID, name }) => {
      const game = games[lobbyID];
      if (!game) {
        socket.emit('lobbyError', 'Lobby does not exist.');
        console.log(`Join attempt failed for ${socket.id}: Lobby ${lobbyID} does not exist.`);
        return;
      }
      if (game.players.size >= 2) {
        socket.emit('lobbyError', 'Lobby is full.');
        console.log(`Join attempt failed for ${socket.id}: Lobby ${lobbyID} is full.`);
        return;
      }
      if (game.players.has(socket.id)) {
        socket.emit('lobbyError', 'Already in this lobby.');
        console.log(`Join attempt failed for ${socket.id}: Already in lobby ${lobbyID}.`);
        return;
      }

      socket.data.name = name;
      socket.join(lobbyID);
      game.players.add(socket.id);
      game.names[socket.id] = name;
      game.scores = { top: 0, bottom: 0 };
      game.readyPlayers.clear();
      game.puckLocked = true;

      airHockeyIo.to(lobbyID).emit('matchFound', {
        roomID: lobbyID,
        hostID: game.hostID,
        names: game.names
      });
      console.log(`Player ${socket.id} joined lobby: ${lobbyID}. Current players: ${[...game.players]}`);
    });

    // --- GAME START LOGIC ---
    socket.on('playerReady', ({ roomID }) => {
      const game = games[roomID];
      if (!game) {
        console.log(`Error: playerReady called for non-existent roomID: ${roomID}`);
        return;
      }

      game.readyPlayers.add(socket.id);
      socket.to(roomID).emit('opponentReady');
      console.log(`Player ${socket.id} in room ${roomID} is ready. Ready players: ${game.readyPlayers.size}/${game.players.size}`);

      if (game.players.size === 2 && game.readyPlayers.size === 2) {
        airHockeyIo.to(roomID).emit('countdownStart');
        console.log(`Both players in room ${roomID} are ready. Starting countdown.`);
        setTimeout(() => {
          const names = {};
          for (const playerId of game.players) {
            names[playerId] = game.names[playerId];
          }
          airHockeyIo.to(roomID).emit('startGame', {
            roomID,
            hostID: game.hostID,
            names
          });
          airHockeyIo.to(roomID).emit('resetPuck');
          console.log(`Game started in room ${roomID}.`);
        }, 3000);
      }
    });

    // --- GAME MECHANICS ---
    socket.on('paddleMove', ({ roomID, position }) => {
      const game = games[roomID];
      if (!game) return;
      socket.to(roomID).emit('opponentPaddle', position);
    });

    socket.on('puckHitByClient', ({ roomID, vx, vy }) => {
      const game = games[roomID];
      if (!game) return;

      const hostSocketId = game.hostID;
      const hostSocket = airHockeyIo.sockets.sockets.get(hostSocketId);

      if (hostSocket && hostSocket.id !== socket.id) {
        game.puck.vx = -vx;
        game.puck.vy = -vy;
        game.puckLocked = false;
        airHockeyIo.to(roomID).emit('puckUpdate', {
            x: game.puck.x,
            y: game.puck.y,
            vx: game.puck.vx,
            vy: game.puck.vy,
            puckLocked: game.puckLocked
        });
      }
    });

    socket.on('puckMove', ({ roomID, position }) => {
      const game = games[roomID];
      if (!game) return;

      if (game.hostID === socket.id) {
        game.puck.x = position.x;
        game.puck.y = position.y;
        game.puck.vx = position.vx;
        game.puck.vy = position.vy;
        game.puckLocked = position.puckLocked;

        airHockeyIo.to(roomID).emit('puckUpdate', {
            x: game.puck.x,
            y: game.puck.y,
            vx: game.puck.vx,
            vy: game.puck.vy,
            puckLocked: game.puckLocked
        });
      }
    });

    socket.on('goalScored', ({ roomID, scorer }) => {
      const game = games[roomID];
      if (!game) return;

      game.scores[scorer]++;
      airHockeyIo.to(roomID).emit('updateScore', { scores: game.scores, scorer });

      const { top, bottom } = game.scores;
      if (top === 7 || bottom === 7) {
        const winner = top === 7 ? 'top' : 'bottom';
        airHockeyIo.to(roomID).emit('gameOver', { winner });
        return;
      }

      setTimeout(() => {
        airHockeyIo.to(roomID).emit('resetPuck');
        game.readyPlayers.clear();
        game.puckLocked = true;
      }, 1500);
    });

    // --- REMATCH & LEAVE GAME ---
    socket.on('requestRematch', ({ roomID, name }) => {
      const game = games[roomID];
      if (!game) return;

      game.readyPlayers.add(socket.id);
      game.names[socket.id] = name;

      if (game.players.size === 2 && game.readyPlayers.size === 2) {
        game.scores = { top: 0, bottom: 0 };
        game.puckLocked = true;
        airHockeyIo.to(roomID).emit('rematchAccepted');
        airHockeyIo.to(roomID).emit('countdownStart');
        setTimeout(() => {
          const names = {};
          for (const playerId of game.players) {
            names[playerId] = game.names[playerId];
          }
          airHockeyIo.to(roomID).emit('startGame', {
            roomID,
            hostID: game.hostID,
            names
          });
          airHockeyIo.to(roomID).emit('resetPuck');
        }, 3000);
      } else {
        socket.to(roomID).emit('opponentReady');
      }
    });

    socket.on('leaveGame', ({ roomID }) => {
      const game = games[roomID];
      if (!game) return;

      game.players.delete(socket.id);
      socket.leave(roomID);

      if (game.players.size === 1) {
        const remainingPlayerId = [...game.players][0];
        airHockeyIo.to(remainingPlayerId).emit('playerLeft');
        delete games[roomID];
      } else if (game.players.size === 0) {
        delete games[roomID];
      }
      
      if (waitingPlayer?.id === socket.id) {
        waitingPlayer = null;
      }
    });

    // --- DISCONNECT HANDLING ---
    socket.on('disconnect', () => {
      console.log(`🔴 Disconnected: ${socket.id}`);
      if (waitingPlayer?.id === socket.id) {
        waitingPlayer = null;
      }

      for (const [roomID, game] of Object.entries(games)) {
        if (game?.players?.has(socket.id)) {
          game.players.delete(socket.id);
          
          if (game.players.size === 1) {
            const remainingPlayerId = [...game.players][0];
            airHockeyIo.to(remainingPlayerId).emit('playerLeft');
            delete games[roomID];
          } else if (game.players.size === 0) {
            delete games[roomID];
          }
        }
      }
    });
  });
};

module.exports = { airHockeyRouter, setup };
