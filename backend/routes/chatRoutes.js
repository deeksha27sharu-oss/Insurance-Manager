import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getChatHistory, sendMessage, getChatContacts, markThreadRead } from "../controllers/chatController.js";

export const chatRouter = Router();

chatRouter.get("/contacts", requireAuth, getChatContacts);
chatRouter.put("/read/:targetId", requireAuth, markThreadRead);
chatRouter.get("/:policyId/:clientId", requireAuth, getChatHistory);
chatRouter.post("/", requireAuth, sendMessage);