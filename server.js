// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { airHockeyRouter, airHockeyIo } = require('./hockey.js'); // Your existing hockey game
//const { chessRouter, chessIo } = require('./chess.js'); // The new server-interactive game

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

// Attach the routers to the main app
app.use('/air-hockey', airHockeyRouter);
//app.use('/chess', chessRouter);

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});