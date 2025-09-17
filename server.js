const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { airHockeyRouter } = require('./hockey.js');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// The main Socket.IO server instance
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Pass the io instance to the hockey game module to create its namespace
airHockeyRouter.setup(io);

// Serve static files from the root of the site (e.g., a landing page)
// You can add your main website files here later
app.use(express.static('public'));

// Use the air hockey router for the /air-hockey path
app.use('/air-hockey', airHockeyRouter);

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
