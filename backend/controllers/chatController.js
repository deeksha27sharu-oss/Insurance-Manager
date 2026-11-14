import { Message } from "../models/Message.js";
import Customer from "../models/Customer.js";
import { UserPolicy } from "../models/UserPolicy.js";

const getIO = (req) => req.app.get("io");

export const getChatContacts = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const contactsMap = new Map();
    if (role === "user") {
      const client = await Customer.findById(userId).populate("assigned_agent_id", "name role _id");
      const activePolicy = await UserPolicy.findOne({ 
        user: userId, workflowStage: "Relationship Active" 
      }).populate("assigned_relationship_agent_id", "name role _id").sort({ createdAt: -1 });

      if (client && client.assigned_agent_id) {
        const a = client.assigned_agent_id;
        contactsMap.set(String(a._id), { id: a._id, name: a.name, role: a.role, type: "Sales Agent" });
      }
      if (activePolicy && activePolicy.assigned_relationship_agent_id) {
        const a = activePolicy.assigned_relationship_agent_id;
        contactsMap.set(String(a._id), { id: a._id, name: a.name, role: a.role, type: "Relationship Agent" });
      }
      if (contactsMap.size === 0) {
        const supportAgent = await Customer.findOne({ email: "support@insurance.com" });
        if (supportAgent) {
          contactsMap.set(String(supportAgent._id), { id: supportAgent._id, name: supportAgent.name, role: supportAgent.role, type: "Support" });
        } else {
          const houseAgent = await Customer.findOne({ email: "direct@insurance.com" });
          if (houseAgent) {
             contactsMap.set(String(houseAgent._id), { id: houseAgent._id, name: "Customer Support", role: houseAgent.role, type: "Support" });
          }
        }
      }
    } 
    else if (role === "admin") {
      const agents = await Customer.find({ role: { $ne: "user" } }).select("name role _id");
      agents.forEach(a => contactsMap.set(String(a._id), { id: a._id, name: a.name, role: a.role, type: "Agent" }));
    } 
    else if (role === "super_agent") {
      const team = await Customer.find({ team_id: userId }).select("name role _id");
      const clients = await Customer.find({ assigned_agent_id: userId }).select("name role _id");
      team.forEach(a => contactsMap.set(String(a._id), { id: a._id, name: a.name, role: a.role, type: "Team Member" }));
      clients.forEach(c => contactsMap.set(String(c._id), { id: c._id, name: c.name, role: c.role, type: "Client" }));
    } 
    else if (role === "technical_agent") {
      const techAgent = await Customer.findById(userId);
      
      const admin = await Customer.findOne({ role: "admin" }).select("name role _id");
      if (admin) contactsMap.set(String(admin._id), { id: admin._id, name: admin.name, role: admin.role, type: "Admin" });

      if (techAgent && techAgent.team_id) {
        const superAgent = await Customer.findById(techAgent.team_id).select("name role _id");
        if (superAgent) contactsMap.set(String(superAgent._id), { id: superAgent._id, name: superAgent.name, role: superAgent.role, type: "Super Agent" });

        const relAgents = await Customer.find({ team_id: techAgent.team_id, role: "relationship_agent" }).select("name role _id");
        relAgents.forEach(a => contactsMap.set(String(a._id), { id: a._id, name: a.name, role: a.role, type: "Relationship Agent" }));
      }
    } 
    else if (role === "relationship_agent") {
      const relAgent = await Customer.findById(userId);
      
      const admin = await Customer.findOne({ role: "admin" }).select("name role _id");
      if (admin) contactsMap.set(String(admin._id), { id: admin._id, name: admin.name, role: admin.role, type: "Admin" });

      if (relAgent && relAgent.team_id) {
        const superAgent = await Customer.findById(relAgent.team_id).select("name role _id");
        if (superAgent) contactsMap.set(String(superAgent._id), { id: superAgent._id, name: superAgent.name, role: superAgent.role, type: "Super Agent" });

        const salesAgents = await Customer.find({ team_id: relAgent.team_id, role: { $in: ["captive_agent", "independent_agent"] } }).select("name role _id");
        salesAgents.forEach(a => contactsMap.set(String(a._id), { id: a._id, name: a.name, role: a.role, type: "Sales Agent" }));

        const techAgents = await Customer.find({ team_id: relAgent.team_id, role: "technical_agent" }).select("name role _id");
        techAgents.forEach(a => contactsMap.set(String(a._id), { id: a._id, name: a.name, role: a.role, type: "Technical Agent" }));
      }
    } 
    else if (role.includes("agent")) {
      const clients = await Customer.find({ assigned_agent_id: userId }).select("name role _id");
      clients.forEach(c => contactsMap.set(String(c._id), { id: c._id, name: c.name, role: c.role, type: "Client" }));
    }
    const existingThreads = await Message.find({
      $or: [{ clientId: userId }, { agentId: userId }]
    }).select("clientId agentId");

    for (const thread of existingThreads) {
      const otherId = String(thread.clientId) === String(userId) ? String(thread.agentId) : String(thread.clientId);
      
      if (!contactsMap.has(otherId)) {
        const otherUser = await Customer.findById(otherId).select("name role");
        if (otherUser) {
          let typeLabel = "Chat History";
          if (otherUser.role === "user") typeLabel = "Client";
          else if (otherUser.role === "admin") typeLabel = "Admin";
          else if (otherUser.role.includes("agent")) typeLabel = "Agent";
          
          contactsMap.set(otherId, { id: otherUser._id, name: otherUser.name, role: otherUser.role, type: typeLabel });
        }
      }
    }
    const contacts = Array.from(contactsMap.values());

    const contactsWithDetails = await Promise.all(contacts.map(async (c) => {
      const unreadCount = await Message.countDocuments({
        $or: [{ clientId: userId, agentId: c.id }, { clientId: c.id, agentId: userId }],
        senderId: { $ne: userId },
        ...(role === "user" ? { readByClient: false } : { readByAgent: false })
      });

      const lastMsg = await Message.findOne({
        $or: [{ clientId: userId, agentId: c.id }, { clientId: c.id, agentId: userId }]
      }).sort({ createdAt: -1 }).select("text createdAt senderId");

      return { 
        ...c, 
        unread: unreadCount,
        lastMessageText: lastMsg ? lastMsg.text : "",
        lastMessageTime: lastMsg ? lastMsg.createdAt.getTime() : 0,
        lastMessageSender: lastMsg ? (String(lastMsg.senderId) === String(userId) ? "You: " : "") : ""
      };
    }));
    contactsWithDetails.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
    res.json({ contacts: contactsWithDetails });
  } catch (err) {
    console.error("getChatContacts error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getChatHistory = async (req, res) => {
  try {
    const { policyId, clientId: targetId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const query = {
      $or: [
        { clientId: userId, agentId: targetId },
        { clientId: targetId, agentId: userId }
      ]
    };

    if (policyId !== "general") query.policyId = policyId;

    const messages = await Message.find(query).sort({ createdAt: 1 });

    await Message.updateMany(
      { ...query, senderId: { $ne: userId } },
      userRole === "user" ? { readByClient: true } : { readByAgent: true }
    );

    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { policyId, text, targetId } = req.body;
    const senderId = req.user.id;
    const senderRole = req.user.role === "user" ? "user" : "agent";
    
    if (!text || !text.trim() || !targetId) return res.status(400).json({ error: "Message and target required" });

    let clientId, agentId;
    const targetUser = await Customer.findById(targetId);
    
    if (senderRole === "user") {
      clientId = senderId;
      agentId = targetId;
    } else if (targetUser.role === "user") {
      clientId = targetId;
      agentId = senderId;
    } else {
      clientId = senderId; 
      agentId = targetId;
    }

    const senderObj = await Customer.findById(senderId);

    const message = await Message.create({
      policyId: policyId || "general",
      clientId,
      agentId,
      senderId,
      senderRole,
      senderName: senderObj.name,
      text: text.trim(),
    });

    const io = getIO(req);
    if (io) {
      io.to(`user_${senderId}`).emit("chat:message", message);
      io.to(`user_${targetId}`).emit("chat:message", message);
      
      if (senderRole === "user") {
        io.to("role_admin").emit("chat:message", message);
        io.to(`role_${req.user.role}`).emit("chat:message", message);
      } else {
        io.to(`role_${targetUser.role}`).emit("chat:message", message);
      }
    }

    res.status(201).json({ message });
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const markThreadRead = async (req, res) => {
  try {
    const { targetId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    await Message.updateMany(
      {
        $or: [
          { clientId: userId, agentId: targetId },
          { clientId: targetId, agentId: userId }
        ],
        senderId: { $ne: userId }
      },
      role === "user" ? { readByClient: true } : { readByAgent: true }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};