import { Category } from "../models/Category.js";

const getIO = (req) => req.app.get("io");

export const getAllCategories = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role !== "admin") {
      filter.isActive = true;
    }
    const categories = await Category.find(filter).sort({ name: 1 });
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "Category name is required" });

    const existing = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });
    if (existing) return res.status(400).json({ error: "Category already exists" });

    const category = await Category.create({ name, description });

    const io = getIO(req);
    if (io) {
      io.emit("policies:update");       
      io.emit("categories:update"); 
    }

    res.status(201).json({ category });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) return res.status(404).json({ error: "Category not found" });

    category.isActive = !category.isActive;
    await category.save();

    const io = getIO(req);
    if (io) {
      io.emit("policies:update"); 
      io.emit("categories:update");
    }

    res.json({
      message: `Category ${category.isActive ? "activated" : "deactivated"}`,
      category,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Category.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Category not found" });

    const io = getIO(req);
    if (io) {
      io.emit("policies:update");
      io.emit("categories:update");
    }

    res.json({ message: "Category deleted permanently" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};