import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import Customer from "../models/Customer.js";
import { UserPolicy, CommissionPayout } from "../models/UserPolicy.js"; 
import { Commission } from "../models/Commission.js";
import { validateUserPayload } from "../utils/validators.js";
import { queueEmail } from "../services/emailService.js";
import { emailTemplates } from "../services/emailTemplates.js";

const ACCESS_TTL = process.env.ACCESS_TTL || "2h";
const REFRESH_GRACE = process.env.REFRESH_GRACE || "5m";
const GRACE_MS = (() => {
  const m = String(REFRESH_GRACE).match(/^(\d+)\s*([smhd])$/);
  if (!m) return 90_000;
  const [, n, unit] = m;
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return Number(n) * mult;
})();

console.log("auth config:", { ACCESS_TTL, REFRESH_GRACE, GRACE_MS });

const getIO = (req) => req.app.get("io");

function notifyAgentChange(io, superAgentIds = [], directAgentIds = []) {
  if (!io) return;
  io.to("role_admin").emit("agents:update");
  const superSet = new Set(superAgentIds.filter(Boolean).map(String));
  for (const sid of superSet) io.to(`user_${sid}`).emit("agents:update");
  const directSet = new Set(directAgentIds.filter(Boolean).map(String));
  for (const did of directSet) io.to(`user_${did}`).emit("agents:update");
}

function signAccess({ sub, role }) {
  return jwt.sign(
    { sub, role, type: "access" },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TTL, algorithm: "HS256" }
  );
}

function verifyAllowExpired(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      ignoreExpiration: true,
    });
  } catch {
    return null;
  }
}

export const signup = async (req, res) => {
  try {
    const { name, email, password, phone, city, age, nominees, assigned_agent_id } = req.body;
    const errors = validateUserPayload({ name, email, phone, password });
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: Object.values(errors)[0] });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await Customer.findOne({ email: normalizedEmail });
    if (existing) {
      return res
        .status(409)
        .json({ message: "An account with this email already exists" });
    }
    const customer = await Customer.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      phone: phone.trim(),
      city,
      age,
      nominees,
      role: "user",
      assigned_agent_id: assigned_agent_id || null,
    });
    const token = signAccess({
      sub: customer._id.toString(),
      role: "user",
    });
    queueEmail(customer.email, emailTemplates.welcome({ name: customer.name }));
    return res.status(201).json({
      message: "Account created successfully",
      token,
      customer: customer.toJSON(),
    });
  } catch (error) {
    if (error.code === 11000)
      return res
        .status(409)
        .json({ message: "An account with this email already exists" });
    if (error.name === "ValidationError")
      return res.status(400).json({ message: error.message });
    console.error("Signup error:", error);
    return res.status(500).json({ message: "Unable to create account" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    const customer = await Customer.findOne({
      email: email.trim().toLowerCase(),
    }).select("+password");

    if (!customer)
      return res.status(401).json({ message: "No account found with this email address." });
    const isMatch = await customer.comparePassword(password);

    if (!isMatch)
      return res.status(401).json({ message: "Incorrect password. Please try again." });
    const token = signAccess({
      sub: customer._id.toString(),
      role: customer.role,
    });
    return res.status(200).json({
      message: "Login successful",
      token,
      customer: customer.toJSON(),
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Unable to log in" });
  }
};

export const getMe = async (req, res) => {
  try {
    const customer = await Customer.findById(req.user.id).populate(
      "assigned_agent_id",
      "name email role"
    );

    if (!customer) {
      return res.status(401).json({ message: "Customer account not found" });
    }
    return res.status(200).json({
      customer: {
        _id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        city: customer.city,
        age: customer.age,
        role: customer.role,
        nominees: customer.nominees,
        createdAt: customer.createdAt,
        assigned_agent_id: customer.assigned_agent_id,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);
    return res
      .status(500)
      .json({ message: "Unable to retrieve customer" });
  }
};

export const logout = (req, res) => {
  return res.status(200).json({ message: "Logged out successfully" });
};

export const refresh = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Missing token" });
    }
    const token = authHeader.slice(7);
    const decoded = verifyAllowExpired(token);
    if (!decoded || decoded.type !== "access") {
      return res.status(401).json({ message: "Invalid token" });
    }

    if (decoded.exp && decoded.exp * 1000 < Date.now() - GRACE_MS) {
      return res.status(401).json({ message: "Refresh window closed" });
    }

    const customer = await Customer.findById(decoded.sub);
    if (!customer) {
      return res.status(401).json({ message: "Account no longer exists" });
    }

    const newToken = signAccess({
      sub: customer._id.toString(),
      role: customer.role,
    });
    return res.status(200).json({
      message: "Token refreshed",
      token: newToken,
      customer: customer.toJSON(),
    });
  } catch (error) {
    console.error("Refresh error:", error);
    return res.status(500).json({ message: "Unable to refresh" });
  }
};

export const createAgent = async (req, res) => {
  try {
    const { name, email, password, phone, role, team_id } = req.body;
    const allowedAgentRoles = [
      "super_agent",
      "independent_agent",
      "captive_agent",
      "technical_agent",
      "relationship_agent",
    ];
    if (!allowedAgentRoles.includes(role)) {
      return res
        .status(400)
        .json({ message: "Invalid agent role specified" });
    }

    const errors = validateUserPayload({ name, email, phone, password });
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: Object.values(errors)[0] });
    }

    const existing = await Customer.findOne({
      email: email.trim().toLowerCase(),
    });
    if (existing)
      return res.status(409).json({ message: "Email already in use" });

    const teamObjectId = team_id
      ? new mongoose.Types.ObjectId(team_id)
      : null;

    const newAgent = await Customer.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      phone: phone.trim(),
      role,
      team_id: teamObjectId,
    });

    queueEmail(newAgent.email, emailTemplates.agentWelcome({ name: newAgent.name, role: newAgent.role }));

    const io = getIO(req);
    notifyAgentChange(io, [teamObjectId]);

    return res.status(201).json({
      message: `${role.replace("_", " ")} created successfully`,
      agent: {
        _id: newAgent._id,
        name: newAgent.name,
        email: newAgent.email,
        role: newAgent.role,
        team_id: newAgent.team_id,
      },
    });
  } catch (error) {
    console.error("Create Agent error: ", error);
    if (error.code === 11000) {
      return res.status(409).json({ message: "Email already in use" });
    }
    return res.status(500).json({ message: "Unable to create agent" });
  }
};

export const getAllAgents = async (req, res) => {
  try {
    const agents = await Customer.find({
      role: {
        $in: [
          "super_agent",
          "captive_agent",
          "independent_agent",
          "technical_agent",
          "relationship_agent",
        ],
      },
    }).sort({ createdAt: -1 });
    res.json({ agents });
  } catch (error) {
    console.error("get agents error: ", error);
    res.status(500).json({ message: "Unable to fetch agents" });
  }
};

export const updateAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, password, role, team_id } = req.body;

    const allowedAgentRoles = [
      "super_agent",
      "independent_agent",
      "captive_agent",
      "technical_agent",
      "relationship_agent",
    ];
    if (role && !allowedAgentRoles.includes(role)) {
      return res
        .status(400)
        .json({ message: "Invalid agent role specified" });
    }

    const errors = validateUserPayload({ name, email, phone, password });
    if (!password) delete errors.password;

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: Object.values(errors)[0] });
    }

    const teamObjectId = team_id
      ? new mongoose.Types.ObjectId(team_id)
      : null;

    const updateData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      role,
      team_id: teamObjectId,
    };
    if (password) updateData.password = password;

    const before = await Customer.findById(id).select("team_id");
    if (!before) return res.status(404).json({ message: "Agent not found" });

    const agent = await Customer.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    const io = getIO(req);
    notifyAgentChange(
      io,
      [before.team_id, agent.team_id], 
      [agent._id]               
    );

    return res.status(200).json({
      message: "Agent updated successfully",
      agent: {
        _id: agent._id,
        name: agent.name,
        email: agent.email,
        phone: agent.phone,
        role: agent.role,
        team_id: agent.team_id,
      },
    });
  } catch (error) {
    console.error("Update Agent error: ", error);
    if (error.code === 11000)
      return res.status(409).json({ message: "Email already in use" });
    return res.status(500).json({ message: "Unable to update agent" });
  }
};

export const deleteAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const agent = await Customer.findByIdAndDelete(id);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    const io = getIO(req);
    notifyAgentChange(io, [agent.team_id]);

    return res.status(200).json({ message: "Agent deleted successfully" });
  } catch (error) {
    console.error("Delete Agent error: ", error);
    return res.status(500).json({ message: "Unable to delete agent" });
  }
};

export const getTeamAgents = async (req, res) => {
  try {
    const superAgentObjectId = new mongoose.Types.ObjectId(req.user.id);

    const teamMembers = await Customer.find({
      team_id: superAgentObjectId,
      role: {
        $in: [
          "super_agent",
          "captive_agent",
          "independent_agent",
          "technical_agent",
          "relationship_agent",
        ],
      },
    })
      .select("-password")
      .sort({ createdAt: -1 });

    const agentsWithStats = await Promise.all(
      teamMembers.map(async (agent) => {
        const [clientCount, policyCount, paidPayouts, pendingCommissions] =
          await Promise.all([
            Customer.countDocuments({ assigned_agent_id: agent._id }),
            UserPolicy.countDocuments({
              sales_agent_id: agent._id,
              workflowStage: "Relationship Active",
            }),
            CommissionPayout.find({ agent: agent._id }),
            Commission.find({ agent: agent._id, status: "Pending" }),
          ]);

        const totalCommissionPaid = paidPayouts.reduce(
          (s, p) => s + p.amount,
          0
        );
        const pendingCommission = pendingCommissions.reduce(
          (s, c) => s + c.commissionAmount,
          0
        );

        return {
          ...agent.toObject(),
          clientCount,
          policyCount,
          pendingCommission,
          totalCommissionPaid,
        };
      })
    );

    res.json({ agents: agentsWithStats });
  } catch (err) {
    console.error("ERROR In getTeamAgents:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getPublicAgents = async (req, res) => {
  try {
    const agents = await Customer.find({
      role: { $in: ["captive_agent", "independent_agent", "super_agent"] },
      email: { $ne: "direct@insurance.com" },
    })
      .select("name email role")
      .sort({ name: 1 });

    res.json({ agents });
  } catch (error) {
    console.error("Get public agents error:", error);
    res.status(500).json({ message: "Unable to fetch agents" });
  }
};