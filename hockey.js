const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let waitingPlayer = null;
const games = {}; // roomID → { players: Set, hostID, scores, names, readyPlayers: Set, puckLocked: boolean, puck: {x, y, vx, vy} }

io.on('connection', (socket) => {
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
      io.to(roomID).emit('matchFound', {
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
    const room = io.sockets.adapter.rooms.get(lobbyID); // Get room BEFORE joining

    if (!game) {
      socket.emit('lobbyError', 'Lobby does not exist.');
      console.log(`Join attempt failed for ${socket.id}: Lobby ${lobbyID} does not exist.`);
      return;
    }
    // Check if lobby is already full (has 2 players)
    if (room && room.size >= 2) { // If room already has 2 players, it's full
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
    socket.join(lobbyID); // Now socket joins, room.size will update
    game.players.add(socket.id);
    game.names[socket.id] = name;
    game.scores = { top: 0, bottom: 0 }; // Reset scores in case of rematch joining
    game.readyPlayers.clear(); // Clear ready state for new joiners
    game.puckLocked = true; // Ensure puck is locked on join

    // After successful join, notify both players that a match is found
    io.to(lobbyID).emit('matchFound', {
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
    socket.to(roomID).emit('opponentReady'); // Notify opponent this player is ready
    console.log(`Player ${socket.id} in room ${roomID} is ready. Ready players: ${game.readyPlayers.size}/${game.players.size}`);

    // Check if both players are ready
    if (game.players.size === 2 && game.readyPlayers.size === 2) {
      io.to(roomID).emit('countdownStart');
      console.log(`Both players in room ${roomID} are ready. Starting countdown.`);
      setTimeout(() => {
        const names = {};
        for (const playerId of game.players) {
          names[playerId] = game.names[playerId];
        }
        io.to(roomID).emit('startGame', {
          roomID,
          hostID: game.hostID,
          names
        });
        io.to(roomID).emit('resetPuck'); // Reset puck at actual game start
        console.log(`Game started in room ${roomID}.`);
      }, 3000); // 3-second countdown
    }
  });

  // --- GAME MECHANICS ---
  socket.on('paddleMove', ({ roomID, position }) => {
    socket.to(roomID).emit('opponentPaddle', position);
  });

  // Event listener for puck hits from clients (non-host will send this)
  socket.on('puckHitByClient', ({ roomID, vx, vy }) => {
    const game = games[roomID];
    if (!game) {
      console.log(`Puck hit for non-existent roomID: ${roomID}`);
      return;
    }

    // Find the host socket in the room
    const hostSocketId = game.hostID;
    const hostSocket = io.sockets.sockets.get(hostSocketId);

    // Only relay if the sender is NOT the host
    if (hostSocket && hostSocket.id !== socket.id) {
      // Non-host sends velocities in its local (inverted) coordinate system.
      // Host needs to invert them back to its authoritative coordinate system.
      game.puck.vx = -vx;
      game.puck.vy = -vy;
      game.puckLocked = false; // Unlock puck when hit
      console.log(`Host received impulse from non-host ${socket.id}. Inverting and applying new puck velocity: (${game.puck.vx}, ${game.puck.vy})`);

      // Broadcast the new authoritative puck state to all clients in the room.
      io.to(roomID).emit('puckUpdate', {
        x: game.puck.x,
        y: game.puck.y,
        vx: game.puck.vx,
        vy: game.puck.vy,
        puckLocked: game.puckLocked
      });
    }
  });

  socket.on('puckMove', ({ roomID, position }) => {
    // Only the host sends authoritative puck updates
    const game = games[roomID];
    if (game && game.hostID === socket.id) {
      // Update server's authoritative puck state based on host's movement
      game.puck.x = position.x;
      game.puck.y = position.y;
      game.puck.vx = position.vx;
      game.puck.vy = position.vy;
      game.puckLocked = position.puckLocked; // Update puckLocked state from host

      // Include puckLocked status in the update
      io.to(roomID).emit('puckUpdate', {
          x: game.puck.x,
          y: game.puck.y,
          vx: game.puck.vx,
          vy: game.puck.vy,
          puckLocked: game.puckLocked // Send the authoritative puckLocked state from server's game object
      });
    }
  });

  socket.on('goalScored', ({ roomID, scorer }) => {
    const game = games[roomID];
    if (!game) return;

    game.scores[scorer]++;
    io.to(roomID).emit('updateScore', { scores: game.scores, scorer });
    console.log(`Goal scored in ${roomID}. Scores: Top ${game.scores.top}, Bottom ${game.scores.bottom}`);

    const { top, bottom } = game.scores;
    if (top === 7 || bottom === 7) {
      const winner = top === 7 ? 'top' : 'bottom';
      io.to(roomID).emit('gameOver', { winner });
      console.log(`Game over in ${roomID}. Winner: ${winner}`);
      return;
    }

    // Reset puck after a goal
    setTimeout(() => {
      io.to(roomID).emit('resetPuck');
      game.readyPlayers.clear(); // Reset ready state after a goal for next round
      game.puckLocked = true; // Lock puck on server after goal
      console.log(`Puck reset in ${roomID}.`);
    }, 1500);
  });

  // --- REMATCH & LEAVE GAME ---
  socket.on('requestRematch', ({ roomID, name }) => {
    const game = games[roomID];
    if (!game) return;

    // A player requests rematch, clear their ready state and add them to ready
    game.readyPlayers.add(socket.id);
    game.names[socket.id] = name; // Update name in case it changed

    console.log(`Player ${socket.id} requested rematch in room ${roomID}. Ready players: ${game.readyPlayers.size}/${game.players.size}`);

    // Check if both players are ready for rematch
    if (game.players.size === 2 && game.readyPlayers.size === 2) {
      // Both are ready, reset scores and start new game sequence
      game.scores = { top: 0, bottom: 0 };
      game.puckLocked = true; // Lock puck on server for rematch start
      io.to(roomID).emit('rematchAccepted');
      io.to(roomID).emit('countdownStart');
      console.log(`Rematch accepted in room ${roomID}. Starting new game.`);
      setTimeout(() => {
        const names = {};
        for (const playerId of game.players) {
          names[playerId] = game.names[playerId];
        }
        io.to(roomID).emit('startGame', {
          roomID,
          hostID: game.hostID,
          names
        });
        io.to(roomID).emit('resetPuck');
      }, 3000);
    } else {
      // One player is ready, waiting for opponent
      socket.to(roomID).emit('opponentReady'); // Notify opponent that this player wants rematch
    }
  });


  socket.on('leaveGame', ({ roomID }) => {
    const game = games[roomID];
    if (game) {
      game.players.delete(socket.id);
      socket.leave(roomID);
      console.log(`Player ${socket.id} explicitly left room ${roomID}.`);

      if (game.players.size === 1) {
        // If one player leaves, the other player automatically wins
        const remainingPlayerId = [...game.players][0];
        io.to(remainingPlayerId).emit('playerLeft');
        delete games[roomID]; // Clean up game
        console.log(`Player ${socket.id} left room ${roomID}. Game ended for remaining player.`);
      } else if (game.players.size === 0) {
        // Both players left, clean up
        delete games[roomID];
        console.log(`Room ${roomID} is empty. Game deleted.`);
      }
    }
    if (waitingPlayer?.id === socket.id) {
      waitingPlayer = null; // If leaving while waiting for random match
      console.log(`Waiting player ${socket.id} removed due to leaveGame.`);
    }
  });


  // --- DISCONNECT HANDLING ---
  socket.on('disconnect', () => {
    console.log(`🔴 Disconnected: ${socket.id}`);

    if (waitingPlayer?.id === socket.id) {
      waitingPlayer = null;
      console.log(`Waiting player ${socket.id} removed on disconnect.`);
    }

    for (const [roomID, game] of Object.entries(games)) {
      if (game.players.has(socket.id)) {
        game.players.delete(socket.id);
        // Do not call socket.leave(roomID) here, as the socket is already disconnecting
        console.log(`Player ${socket.id} disconnected from room ${roomID}.`);

        if (game.players.size === 1) {
          // If one player disconnects, the other player automatically wins
          const remainingPlayerId = [...game.players][0];
          io.to(remainingPlayerId).emit('playerLeft');
          delete games[roomID]; // Clean up game
          console.log(`Player ${socket.id} disconnected from room ${roomID}. Game ended for remaining player.`);
        } else if (game.players.size === 0) {
          // If both players disconnect (or last player disconnects), clean up
          delete games[roomID];
          console.log(`Room ${roomID} is empty due to disconnect. Game deleted.`);
        }
      }
    }
  });
});

server.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
