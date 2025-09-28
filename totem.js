const express = require('express');
const { v4: uuidv4 } = require('uuid');

const totemRouter = express.Router();
let totemIo;

// Serve the static files for the 'Prophecy of the Totem' game
// All requests to /prophecy-of-the-totem will look for files in the 'public-totem' directory.
totemRouter.use(express.static('public-totem'));

// Handle the root path, which should load the client file (index.html)
totemRouter.get('/', (req, res) => {
    // This assumes 'public-totem/index.html' exists.
    res.sendFile('index.html', { root: './public-totem' }); 
});

// This function is called from server.js to set up the Socket.IO namespace
const setup = (io) => {
  // Create a namespace specific to this game
  totemIo = io.of('/prophecy-of-the-totem');
  
  // Game state (only tracking lobbies and players for now)
  const games = {}; // roomID → { players: Set, hostID, names: {id: name}, readyPlayers: Set }

  totemIo.on('connection', (socket) => {
    console.log(`[TOTEM] 🟢 Connected: ${socket.id}`);

    // --- CUSTOM LOBBY: CREATE ---
    socket.on('createLobby', ({ name }) => {
      socket.data.name = name;
      const lobbyID = uuidv4().slice(0, 6).toUpperCase(); // 6-character code
      socket.join(lobbyID);
      
      games[lobbyID] = {
        players: new Set([socket.id]),
        hostID: socket.id,
        names: { [socket.id]: name },
        readyPlayers: new Set(),
        // Add more game state properties here later
      };
      
      socket.emit('lobbyCreated', { lobbyID });
      console.log(`[TOTEM] Lobby created: ${lobbyID} by ${socket.id} (${name})`);
    });

    // --- CUSTOM LOBBY: JOIN ---
    socket.on('joinLobby', ({ lobbyID, name }) => {
      const game = games[lobbyID];
      
      if (!game) {
        socket.emit('lobbyError', 'Lobby code is invalid or the lobby has expired.');
        return;
      }
      
      if (game.players.size >= 2) {
        socket.emit('lobbyError', 'Lobby is full (2/2 players).');
        return;
      }

      socket.data.name = name;
      socket.join(lobbyID);
      game.players.add(socket.id);
      game.names[socket.id] = name;
      game.readyPlayers.clear(); // Reset ready state on new join
      
      // Notify all players in the room that a match has been found
      totemIo.to(lobbyID).emit('matchFound', {
        roomID: lobbyID,
        hostID: game.hostID,
        names: game.names
      });
      console.log(`[TOTEM] Player ${socket.id} (${name}) joined lobby: ${lobbyID}.`);
    });

    // --- GAME START LOGIC ---
    socket.on('playerReady', ({ roomID }) => {
      const game = games[roomID];
      if (!game || !game.players.has(socket.id) || game.players.size < 2) return;

      game.readyPlayers.add(socket.id);
      socket.to(roomID).emit('opponentReady');
      console.log(`[TOTEM] Player ${socket.id} in room ${roomID} is ready. Ready: ${game.readyPlayers.size}/${game.players.size}`);

      if (game.players.size === 2 && game.readyPlayers.size === 2) {
        totemIo.to(roomID).emit('countdownStart');
        console.log(`[TOTEM] Both players in room ${roomID} are ready. Starting countdown.`);
        
        setTimeout(() => {
          // You will add the actual game initialization logic here later
          totemIo.to(roomID).emit('startGame', {
            roomID,
            hostID: game.hostID,
            names: game.names
          });
          console.log(`[TOTEM] Game started in room ${roomID}.`);
        }, 3000); // 3-second countdown
      }
    });

    // --- LEAVE GAME ---
    socket.on('leaveGame', ({ roomID }) => {
      const game = games[roomID];
      if (!game) return;

      game.players.delete(socket.id);
      delete game.names[socket.id];
      socket.leave(roomID);

      if (game.players.size === 1) {
        const remainingPlayerId = [...game.players][0];
        // Notify the remaining player
        totemIo.to(remainingPlayerId).emit('playerLeft');
        delete games[roomID]; // Clean up game
      } else if (game.players.size === 0) {
        delete games[roomID];
      }
      console.log(`[TOTEM] Player ${socket.id} left room ${roomID}. Game state updated.`);
    });
    

    // --- DISCONNECT HANDLING ---
    socket.on('disconnect', () => {
      console.log(`[TOTEM] 🔴 Disconnected: ${socket.id}`);

      // Iterate over all games to see if this socket was a player
      for (const [roomID, game] of Object.entries(games)) {
        if (game?.players?.has(socket.id)) {
          game.players.delete(socket.id);
          delete game.names[socket.id];
          
          if (game.players.size === 1) {
            const remainingPlayerId = [...game.players][0];
            totemIo.to(remainingPlayerId).emit('playerLeft');
            delete games[roomID];
          } else if (game.players.size === 0) {
            delete games[roomID];
          }
        }
      }
    });
  });
};

module.exports = { totemRouter, setup };
