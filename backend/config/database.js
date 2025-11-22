import mongoose from "mongoose";
import { initializeTTLIndexes } from "./ttlIndexes.js";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Connection options for production
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });

    console.log(`🗄️  MongoDB Connected: ${conn.connection.host}`);

    // Initialize TTL indexes for soft delete cleanup after connection is established
    try {
      await initializeTTLIndexes();
    } catch (error) {
      console.error("TTL index initialization failed:", error.message);
      // Don't exit the process, just log the error as TTL indexes are not critical for basic functionality
    }

    // Handle connection events
    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("MongoDB disconnected");
    });

    // Graceful shutdown
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      console.log("MongoDB connection closed through app termination");
      process.exit(0);
    });
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  }
};

export default connectDB;
