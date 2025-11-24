// Eenvironment variables first - MUST be at the very top
import dotenv from "dotenv";
dotenv.config();

// Configure timezone to UTC for consistent date handling
process.env.TZ = "UTC";

import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

// Configure dayjs with UTC and timezone plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Import custom middleware and utilities
import { globalErrorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";
import { convertDatesForResponse } from "./middleware/dateConversion.js";
import { VALIDATION_LIMITS } from "./constants/index.js";

// Import routes (will be available when routes are implemented)
// import routes from "./routes/index.js";

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set("trust proxy", 1);

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
      "http://localhost:5173",
    ];

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));

// Rate limiting using constants
const limiter = rateLimit({
  windowMs: VALIDATION_LIMITS.RATE_LIMIT_WINDOW,
  max: VALIDATION_LIMITS.RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Stricter rate limiting for auth endpoints using constants
const authLimiter = rateLimit({
  windowMs: VALIDATION_LIMITS.RATE_LIMIT_WINDOW,
  max: VALIDATION_LIMITS.AUTH_RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: "Too many authentication attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Export auth limiter for use in auth routes
export { authLimiter };

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Cookie parser
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === "development") app.use(morgan("dev"));

// Date conversion middleware for API responses
app.use(convertDatesForResponse);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// API routes (will be enabled when routes are implemented)
// app.use("/api", routes);

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to the Task Manager SaaS API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Handle 404 errors
app.use(notFoundHandler);

// Global error handling middleware (must be last)
app.use(globalErrorHandler);

export default app;
