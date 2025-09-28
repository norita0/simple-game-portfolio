const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { airHockeyRouter, setup: setupAirHockey } = require('./hockey.js');
const { totemRouter, setup: setupTotem } = require('./totem.js'); // Import the new module

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

// --- Socket.IO Namespace Setup ---
// Pass the io instance to the hockey game module to create its namespace
setupAirHockey(io); 
// Pass the io instance to the totem game module to create its namespace
setupTotem(io); 

// Serve static files from the root of the site (e.g., a landing page)
app.use(express.static('public')); 

// --- Express Routing ---
// Use the air hockey router for the /air-hockey path
app.use('/air-hockey', airHockeyRouter);

// Use the totem router for the /prophecy-of-the-totem path
// The totem router will now handle serving its own index.html from its static folder.
app.use('/prophecy-of-the-totem', totemRouter);


server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
