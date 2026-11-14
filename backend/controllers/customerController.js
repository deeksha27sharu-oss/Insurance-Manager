/* import mongoose from "mongoose"; */
import Customer from "../models/Customer.js";
import { UserPolicy, Claim } from "../models/UserPolicy.js";

const getIO = (req) => req.app.get("io");
async function notifyCustomerChange(io, affectedAgentIds = []) {
  if (!io) return;

  const directIds = new Set(
    affectedAgentIds.filter(Boolean).map((id) => String(id))
  );

  io.to("role_admin").emit("customers:update");

  for (const id of directIds) {
    io.to(`user_${id}`).emit("customers:update");
    io.to(`user_${id}`).emit("agents:update"); 
  }

  if (directIds.size > 0) {
    const agentDocs = await Customer.find({
      _id: { $in: [...directIds] },
      team_id: { $ne: null },
    }).select("team_id");

    const superIds = new Set(agentDocs.map((a) => String(a.team_id)));
    for (const sid of superIds) {
      io.to(`user_${sid}`).emit("customers:update");
      io.to(`user_${sid}`).emit("agents:update");
    }
  }
}

export const getAllCustomers = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 100));
    const skip = (page - 1) * limit;

    const filter = { role: "user" };
    const userRole= req.user.role;

    if (req.user.role === "super_agent") {
      const teamAgents = await Customer.find({ team_id: req.user.id }).select("_id");
      const teamAgentIds = teamAgents.map((a) => a._id);
      teamAgentIds.push(req.user.id);
      filter.assigned_agent_id = { $in: teamAgentIds };
    }
    else if (userRole === "captive_agent" || userRole === "independent_agent"){
      filter.assigned_agent_id = req.user.id;
    }
    else if ( userRole === "technical_agent" || userRole === "relationship_agent"){
      const agent = await Customer.findById(req.user.id);
      if (agent && agent.team_id) {
        const teamAgents = await Customer.find({ team_id: agent.team_id }).select("_id");
        const teamAgentIds = teamAgents.map((a) => a._id);
        filter.assigned_agent_id = { $in: teamAgentIds };
      } else {
        filter.assigned_agent_id = null;
      }
    }
    else if (req.user.role.includes("agent")) {
      filter.assigned_agent_id = req.user.id;
    }

    if (req.query.q) {
      filter.$or = [
        { name: { $regex: req.query.q, $options: "i" } },
        { email: { $regex: req.query.q, $options: "i" } },
        { city: { $regex: req.query.q, $options: "i" } },
      ];
    }
    if (req.query.city) {
      filter.city = { $regex: req.query.city, $options: "i" };
    }

    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .populate("assigned_agent_id", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Customer.countDocuments(filter),
    ]);

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      count: customers.length,
      customers,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role === "user" && String(req.user.id) !== String(id)) {
      return res.status(403).json({ error: "Not authorized to view this customer" });
    }

    const customer = await Customer.findById(id).populate(
      "assigned_agent_id",
      "name email role"
    );
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    res.json(customer);
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({ error: "Invalid customer id" });
    }
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role === "user" && String(req.user.id) !== String(id)) {
      return res.status(403).json({ error: "Not authorized to edit this customer" });
    }

    const { name, email, phone, city, age, assigned_agent_id } = req.body;

    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (email !== undefined) update.email = email.trim().toLowerCase();
    if (phone !== undefined) update.phone = String(phone).trim();
    if (city !== undefined) update.city = city.trim();
    if (age !== undefined) update.age = age;

    if (assigned_agent_id !== undefined) {
      update.assigned_agent_id =
        assigned_agent_id === "" ? null : assigned_agent_id;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const before = await Customer.findById(id).select("assigned_agent_id");
    if (!before) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const customer = await Customer.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    ).populate("assigned_agent_id", "name email role");

    const io = getIO(req);
    const newAssigneeId =
      customer.assigned_agent_id?._id || customer.assigned_agent_id;
    await notifyCustomerChange(io, [
      before.assigned_agent_id,
      newAssigneeId,
    ]);

    res.json({ message: "Customer updated", customer });
  } catch (err) {
    if (err.name === "ValidationError") {
      const firstError = Object.values(err.errors)[0]?.message;
      return res.status(400).json({ error: firstError });
    }
    if (err.name === "CastError") {
      return res.status(400).json({ error: "Invalid customer ID" });
    }
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ error: "A customer with this email already exists" });
    }
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const deleteCustomer = async (req, res) => {
  try {
    const result = await Customer.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: "Customer not found" });

    const io = getIO(req);
    await notifyCustomerChange(io, [result.assigned_agent_id]);

    res.json({ message: "Customer deleted", deletedCount: 1 });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({ error: "Invalid customer ID" });
    }
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const deleteAllCustomers = async (req, res) => {
  try {
    const result = await Customer.deleteMany({});

    const io = getIO(req);
    if (io) io.emit("customers:update"); // everyone connected

    res.json({ message: "All customers deleted", deletedCount: result.deletedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const getCustomerStats = async (req, res) => {
  try {
    const [total, avg] = await Promise.all([
      Customer.countDocuments(),
      Customer.aggregate([
        { $match: { age: { $ne: null } } },
        { $group: { _id: null, avg: { $avg: "$age" } } },
      ]),
    ]);

    const byCity = await Customer.aggregate([
      { $group: { _id: "$city", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      total,
      averageAge: avg[0]?.avg ? Math.round(avg[0].avg) : null,
      byCity,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const createClient = async (req, res) => {
  try {
    const { name, email, password, phone, city, age, assigned_agent_id } =
      req.body;
    const creatorRole = req.user.role;
    const creatorId = req.user.id;

    if (!name || !email || !password || !phone) {
      return res
        .status(400)
        .json({ error: "Name, email, password, and phone are required." });
    }
    const existing = await Customer.findOne({
      email: email.trim().toLowerCase(),
    });
    if (existing) return res.status(409).json({ error: "Email already in use." });

    let finalAgentId = null;
    if (creatorRole === "admin" && assigned_agent_id) {
      const target = await Customer.findById(assigned_agent_id).select("role");
      if (!target || !target.role.includes("agent")) {
        return res.status(400).json({ error: "Invalid assigned agent." });
      }
      finalAgentId = assigned_agent_id;
    } else if (creatorRole.includes("agent")) {
      finalAgentId = creatorId;
    }

    const customer = await Customer.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      phone: phone.trim(),
      city: city?.trim(),
      age: age || null,
      role: "user",
      assigned_agent_id: finalAgentId,
    });

    const io = getIO(req);
    await notifyCustomerChange(io, [finalAgentId]);

    res.status(201).json({ message: "Client created successfully", customer });
  } catch (err) {
    console.error("Create Client error:", err);
    if (err.code === 11000)
      return res.status(409).json({ error: "Email already in use" });
    res.status(500).json({ error: err.message });
  }
};

export const getCustomerClaims = async (req, res) => {
  try {
    const { id } = req.params;
    const userPolicies = await UserPolicy.find({ user: id }).select("_id");
    const policyIds = userPolicies.map((p) => p._id);

    const claims = await Claim.find({ userPolicy: { $in: policyIds } })
      .populate("userPolicy", "policyName premium")
      .populate("reviewed_by", "name role")
      .sort({ filedAt: -1 });

    res.json({ claims });
  } catch (err) {
    console.error("Get customer claims error:", err);
    res.status(500).json({ error: err.message });
  }
};