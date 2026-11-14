import express from "express";
import {signup,login,logout,getMe, createAgent, getAllAgents, refresh, updateAgent, deleteAgent, getPublicAgents} from "../controllers/authController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getTeamAgents } from "../controllers/authController.js";

export const authRouter = express.Router();

authRouter.post("/signup", signup);
authRouter.post("/login", login);
authRouter.post("/logout", logout);

authRouter.post("/refresh", refresh);

authRouter.get("/me", requireAuth, getMe);

authRouter.get("/team-agents", requireAuth, requireRole("super_agent"), getTeamAgents);
authRouter.post("/create-agent", requireAuth, requireRole("admin"), createAgent);
authRouter.get("/agents", requireAuth, requireRole("admin"), getAllAgents);
authRouter.put("/agents/:id", requireAuth, requireRole("admin"), updateAgent);
authRouter.delete("/agents/:id", requireAuth, requireRole("admin"), deleteAgent);
authRouter.get("/public-agents", requireAuth, getPublicAgents);