import mongoose from "mongoose";
import { initializeTTLIndexes } from "./ttlIndexes.js";

const connectDB = async () => {
  try {
    // Validate MongoDB URI
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI environment variable is not defined");
    }
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Connection pool options for production
      maxPoolSize: 10, // Maintain up to 10 socket connections
      minPoolSize: 2, // Maintain at least 2 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      heartbeatFrequencyMS: 10000, // Heartbeat every 10 seconds
      maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
      // Retry configuration
      retryWrites: true,
      retryReads: true,
      // Buffer configuration (these are mongoose options, not MongoDB driver options)
      // bufferMaxEntries: 0, // Disable mongoose buffering (deprecated)
      // bufferCommands: false, // Disable mongoose buffering (deprecated)
    });

    console.log(`🗄️  MongoDB Connected: ${conn.connection.host}`);

    // Initialize TTL indexes for soft delete cleanup after connection is established
    try {
      await initializeTTLIndexes();
    } catch (error) {
      console.error("TTL index initialization failed:", error.message);
      // Don't exit the process, just log the error as TTL indexes are not critical for basic functionality
      // However, log the full error for debugging purposes
      if (process.env.NODE_ENV === "development") {
        console.error("Full TTL initialization error:", error);
      }
    }

    // Handle connection events
    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("MongoDB reconnected");
    });

    mongoose.connection.on("timeout", () => {
      console.warn("MongoDB connection timeout");
    });

    // Export graceful shutdown function for use by server
    global.gracefulDBShutdown = async () => {
      try {
        await mongoose.connection.close();
        console.log("MongoDB connection closed through app termination");
      } catch (error) {
        console.error("Error closing MongoDB connection:", error);
      }
    };
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  }
};

export default connectDB;
