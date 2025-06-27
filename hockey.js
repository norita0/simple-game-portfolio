const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid'); // For generating lobby IDs

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let waitingPlayer = null;

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // RANDOM MATCHMAKING
  socket.on('joinRandom', () => {
    if (waitingPlayer) {
      const roomID = `room-${socket.id}-${waitingPlayer.id}`;
      socket.join(roomID);
      waitingPlayer.join(roomID);

      io.to(roomID).emit('startGame', { roomID });
      waitingPlayer = null;
    } else {
      waitingPlayer = socket;
    }
  });

  // CREATE CUSTOM LOBBY
  socket.on('createLobby', () => {
    const lobbyID = uuidv4().slice(0, 6); // short unique ID
    socket.join(lobbyID);
    socket.emit('lobbyCreated', { lobbyID });
    console.log(`Lobby created: ${lobbyID}`);
  });

  // JOIN CUSTOM LOBBY
  socket.on('joinLobby', (lobbyID) => {
    const room = io.sockets.adapter.rooms.get(lobbyID);
    if (room && room.size === 1) {
      socket.join(lobbyID);
      io.to(lobbyID).emit('startGame', { lobbyID });
      console.log(`User joined lobby: ${lobbyID}`);
    } else {
      socket.emit('lobbyError', 'Lobby not found or already full');
    }
  });

  socket.on('paddleMove', (data) => {
    socket.broadcast.emit('paddleMove', data);
  });
  
  socket.on('disconnect', () => {
    if (waitingPlayer === socket) waitingPlayer = null;
    console.log(`User disconnected: ${socket.id}`);
  });
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});