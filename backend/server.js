import app from "./app.js";
import connectDB from "./config/database.js";
import { createServer } from "http";
import { Server } from "socket.io";
import { initializeSocketHandlers } from "./socket/socketHandlers.js";

const PORT = process.env.PORT || 4000;

// Connect to MongoDB
connectDB();

// Create HTTP server
const server = createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
      "http://localhost:5173",
    ],
    credentials: true,
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
  allowEIO3: true,
});

// Initialize comprehensive Socket.IO event handlers
initializeSocketHandlers(io);

// Make io accessible to the app for broadcasting from controllers
app.set("io", io);

// Start server
server.listen(PORT, () => {
  console.log(
    `🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`
  );
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`${signal} received. Shutting down gracefully...`);

  // Close HTTP server
  server.close(async () => {
    console.log("HTTP server closed");

    // Close database connection if available
    if (global.gracefulDBShutdown) {
      await global.gracefulDBShutdown();
    }

    console.log("Process terminated");
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error(
      "Could not close connections in time, forcefully shutting down"
    );
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
