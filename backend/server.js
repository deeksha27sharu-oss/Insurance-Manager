import "./config/env.js";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { chatRouter } from "./routes/chatRoutes.js";

import { helloRouter } from "./routes/helloRoutes.js";
import { authRouter } from "./routes/authRoutes.js";
import { connectDB } from "./config/db.js";
import { policyRouter } from "./routes/policyRoutes.js";
import { categoryRouter } from "./routes/categoryRoutes.js";
import { startRenewalReminderJob } from "./jobs/renewalReminderJob.js";

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [process.env.FRONTEND_URL, "http://localhost:3000"].filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "1mb" }));

app.use("/api", helloRouter);
app.use("/api/auth", authRouter);
app.use("/api/policies", policyRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/chat", chatRouter);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3000", process.env.FRONTEND_URL].filter(Boolean),
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error("Authentication error: No token provided"));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error("Authentication error: Invalid token"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.user.sub;
  const userRole = socket.user.role;

  console.log(`User connected via websocket: ${userId} (${userRole})`);
  
  socket.join(`user_${userId}`);
  socket.join(`role_${userRole}`);

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${userId}`);
  });
});

app.set("io", io);

connectDB()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`HTTP and Websocket server running on http://localhost:${PORT}`);
      startRenewalReminderJob();
    });
  })
  .catch((error) => {
    console.log("Database connection failed:", error);
    process.exit(1);
  });