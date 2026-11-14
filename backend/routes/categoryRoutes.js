import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getAllCategories, createCategory, toggleCategoryStatus, deleteCategory } from "../controllers/categoryController.js";

export const categoryRouter = Router();

categoryRouter.get("/", requireAuth, getAllCategories);

categoryRouter.post("/", requireAuth, requireRole("admin"), createCategory);
categoryRouter.put("/:id/toggle", requireAuth, requireRole("admin"), toggleCategoryStatus);
categoryRouter.delete("/:id", requireAuth, requireRole("admin"), deleteCategory);