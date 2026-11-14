import { Policy } from "../models/Policy.js";
import { UserPolicy, CommissionPayout, Claim } from "../models/UserPolicy.js";
import { Commission } from "../models/Commission.js"; 
import { Category } from "../models/Category.js";
import Customer from "../models/Customer.js";
import { parsePremiumToNumber } from "../utils/premiumParser.js";
import { queueEmail } from "../services/emailService.js";
import { emailTemplates } from "../services/emailTemplates.js";

const getIO = (req) => req.app.get("io");

const LOGO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
function parseLogo(input) {
  if (input === undefined) return { skip: true };
  if (input === null || input === "") return { value: "" };
  if (typeof input !== "string" || !LOGO_RE.test(input) || input.length > 400000) {
    return { error: "Logo must be a PNG, JPEG or WEBP image under ~300KB." };
  }
  return { value: input };
}

async function findLeastLoaded(role, countingFilter, teamId = null) {
  const query = { role };
  if (teamId) query.team_id = teamId;
  
  let agents = await Customer.find(query);
  if (agents.length === 0 && teamId) {
    agents = await Customer.find({ role });
  }
  if (agents.length === 0) return null;
  
  const loads = await Promise.all(
    agents.map(async (a) => ({
      id: a._id,
      count: await UserPolicy.countDocuments({
        ...countingFilter,
        [countingFilter.field]: a._id,
      }),
    }))
  );
  loads.sort((a, b) => a.count - b.count);
  return loads[0].id;
}

export const getAllPolicies = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      const activeCategories = await Category.find({ isActive: true }).select("name");
      const regexPatterns = activeCategories.map((c) => new RegExp(`^${c.name}$`, "i"));
      const policies = await Policy.find({ category: { $in: regexPatterns }, isActive: true }).sort({ _id: 1 });
      return res.json({ policies });
    }
    const policies = await Policy.find({}).sort({ _id: 1 });
    res.json({ policies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getPolicyById = async (req, res) => {
  try {
    const policy = await Policy.findOne({ id: req.params.id });
    if (!policy) return res.status(404).json({ error: "Policy not found" });
    const isAdmin = req.user && req.user.role === "admin";
    if (!isAdmin) {
      if (!policy.isActive) return res.status(404).json({ error: "This policy is no longer available." });
      const category = await Category.findOne({ name: { $regex: new RegExp(`^${policy.category}$`, "i") } });
      if (!category || !category.isActive) return res.status(404).json({ error: "This policy is no longer available." });
    }
    res.json({ policy });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const buyPolicy = async (req, res) => {
  try {
    const { policyId, nominees, agentId } = req.body;
    const userId = req.user.id;

    if (nominees && nominees.length > 3) return res.status(400).json({ error: "You can add a maximum of 3 nominees." });

    let policy = await Policy.findOne({ id: policyId });
    let isExternal = false;

    if (!policy) {
      if (policyId.length > 10) {
        isExternal = true;
      } else {
        return res.status(404).json({ error: "Policy not found" });
      }
    }

    if (policy && !policy.isActive) return res.status(400).json({ error: "This policy is currently unavailable." });

    if (!isExternal) {
      const category = await Category.findOne({ name: { $regex: new RegExp(`^${policy.category}$`, "i") } });
      if (!category || !category.isActive) return res.status(400).json({ error: "This policy category has been discontinued." });
    }

    const existing = await UserPolicy.findOne({ user: userId, policyId });
    if (existing) return res.status(400).json({ error: "You already own this policy." });

    const startDate = new Date();
    const renewalDate = new Date();
    renewalDate.setFullYear(startDate.getFullYear() + 1);

    const finalPolicyName = isExternal ? `External Plan (${policyId})` : policy.name;
    const finalCategory = isExternal ? "General" : policy.category;
    const finalPremiumText = isExternal ? "Check details" : policy.premium;
    const finalPremiumValue = isExternal ? (15000 + (policyId.length * 100)) : policy.premiumValue;

    const newUserPolicy = await UserPolicy.create({
      user: userId, 
      policyId: policyId, 
      policyName: finalPolicyName, 
      category: finalCategory,
      premium: finalPremiumText, 
      startDate, renewalDate, nominees: nominees || [],
      status: "Active", workflowStage: "Pending Technical Review", sale_date: new Date(),
    });
    
    const currentUser = await Customer.findById(userId);
    let finalSalesAgentId = null;

    if (agentId) {
      const selectedAgent = await Customer.findById(agentId);
      if (selectedAgent && selectedAgent.role.includes("agent")) finalSalesAgentId = selectedAgent._id;
    }

    if (!finalSalesAgentId && currentUser.assigned_agent_id) finalSalesAgentId = currentUser.assigned_agent_id;

    if (!finalSalesAgentId) {
      const houseAgent = await Customer.findOne({ email: "direct@insurance.com" });
      if (houseAgent) finalSalesAgentId = houseAgent._id;
    }

    if (finalSalesAgentId && !currentUser.assigned_agent_id) {
      await Customer.findByIdAndUpdate(userId, { assigned_agent_id: finalSalesAgentId });
    }

    let salesAgentTeamId = null;
    if (finalSalesAgentId) {
      const salesAgent = await Customer.findById(finalSalesAgentId);
      if (salesAgent) salesAgentTeamId = salesAgent.team_id;
    }

    const techAgentId = await findLeastLoaded("technical_agent", {
      field: "reviewed_by", workflowStage: "Pending Technical Review",
    }, salesAgentTeamId);

    await UserPolicy.findByIdAndUpdate(newUserPolicy._id, {
      sales_agent_id: finalSalesAgentId, reviewed_by: techAgentId,
    });

    if (nominees && nominees.length > 0) {
      await Customer.findByIdAndUpdate(userId, { $push: { nominees: { $each: nominees } } });
    }
    
    const io = getIO(req);
    if (io) {
      io.to(`role_technical_agent`).emit("reviews:update");
      io.to(`role_admin`).emit("reviews:update"); 
    }

    queueEmail(currentUser.email, emailTemplates.policyPurchased({
      name: currentUser.name, policyName: finalPolicyName, category: finalCategory,
      startDate, renewalDate,
    }));
    if (techAgentId) {
      Customer.findById(techAgentId).select("name email").then((tech) => {
        if (tech) queueEmail(tech.email, emailTemplates.reviewAssigned({
          agentName: tech.name, policyName: finalPolicyName, clientName: currentUser.name,
        }));
      }).catch((e) => console.error("[email] tech agent lookup failed:", e.message));
    }

    res.status(201).json({ message: "Policy purchased! Pending technical review.", userPolicy: newUserPolicy });
  } catch (err) {
    console.error("Buy Policy Error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getPendingReviews = async (req, res) => {
  try {
    let query = { workflowStage: "Pending Technical Review" };
    if (req.user.role === "technical_agent") {
      const techAgent = await Customer.findById(req.user.id);
      
      if (techAgent && techAgent.team_id) {
        const superAgentId = techAgent.team_id;
        const teamAgents = await Customer.find({ team_id: superAgentId }).select("_id");
        const teamAgentIds = teamAgents.map(a => a._id);
        teamAgentIds.push(superAgentId);
        query.sales_agent_id = { $in: teamAgentIds };
      } else {
        return res.json({ policies: [] });
      }
    }
    const policies = await UserPolicy.find(query)
      .populate("user", "name email phone city age")
      .populate("sales_agent_id", "name email role")
      .sort({ sale_date: 1 });

    res.json({ policies });
  } catch (err) {
    console.error("getPendingReviews Error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getPolicyHistory = async (req, res) => {
  try {
    let query = { workflowStage: { $in: ["Relationship Active", "Rejected"] } };
    if (req.user.role === "technical_agent") {
      const techAgent = await Customer.findById(req.user.id);
      
      if (techAgent && techAgent.team_id) {
        const superAgentId = techAgent.team_id;
        const teamAgents = await Customer.find({ team_id: superAgentId }).select("_id");
        const teamAgentIds = teamAgents.map(a => a._id);
        teamAgentIds.push(superAgentId);
        
        query.sales_agent_id = { $in: teamAgentIds };
      } else {
        return res.json({ policies: [] });
      }
    }
    const policies = await UserPolicy.find(query)
      .populate("user", "name email")
      .populate("reviewed_by", "name role")
      .populate("approved_by", "name role")
      .sort({ reviewed_at: -1 });

    res.json({ policies });
  } catch (err) {
    console.error("getPolicyHistory Error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const approvePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const policy = await UserPolicy.findById(id);
    if (!policy) return res.status(404).json({ error: "Policy not found" });
    
    if (req.user.role !== "admin" && String(policy.reviewed_by) !== String(req.user.id)) {
      return res.status(403).json({ error: "Not your assigned review" });
    }
    
    if (policy.workflowStage !== "Pending Technical Review") {
      return res.status(400).json({ error: "Policy already reviewed." });
    }

    let salesAgentTeamId = null;
    if (policy.sales_agent_id) {
      const salesAgent = await Customer.findById(policy.sales_agent_id);
      if (salesAgent) salesAgentTeamId = salesAgent.team_id;
    }

    const relAgentId = await findLeastLoaded("relationship_agent", {
      field: "assigned_relationship_agent_id", workflowStage: "Relationship Active",
    }, salesAgentTeamId);

    let amount = 0;
    const masterPolicy = await Policy.findOne({ id: policy.policyId });
    if (masterPolicy && typeof masterPolicy.premiumValue === "number" && masterPolicy.premiumValue > 0) {
      amount = masterPolicy.premiumValue;
    } else if (masterPolicy) {
      amount = parsePremiumToNumber(masterPolicy.premium);
    } else {
      amount = parsePremiumToNumber(policy.premium);
    }

    let salesAgentCommission = 0;
    let salesAgentRate = 0;
    let salesAgent = null;
    
    if (policy.sales_agent_id) {
      salesAgent = await Customer.findById(policy.sales_agent_id);
      if (salesAgent && salesAgent.email !== "direct@insurance.com") {
        const category = String(policy.category || "").trim().toLowerCase();
        let categoryRate = 10;
        if (category === "health") categoryRate = 15;
        if (category === "life") categoryRate = 20;
        if (category === "education") categoryRate = 12;

        salesAgentRate = salesAgent.commissionRate > 0 ? salesAgent.commissionRate : categoryRate;
        salesAgentCommission = Math.round(amount * (salesAgentRate / 100));
      }
    }

    let superAgentCommission = 0;
    let superAgent = null;

    if (salesAgent && salesAgent.team_id) {
      superAgent = await Customer.findById(salesAgent.team_id);
      const overrideRate = 3; 
      superAgentCommission = Math.round(amount * (overrideRate / 100));
    }

    policy.workflowStage = "Relationship Active";
    policy.review_notes = notes || "Approved.";
    policy.reviewed_at = new Date();
    policy.approved_by = req.user.id; 
    policy.assigned_relationship_agent_id = relAgentId;
    await policy.save();

    const clientUser = await Customer.findById(policy.user);

    if (salesAgentCommission > 0) {
      await Commission.create({
        agent: policy.sales_agent_id, userPolicy: policy._id, policyName: policy.policyName,
        clientName: clientUser?.name || "Unknown", premiumAmount: amount, rateApplied: salesAgentRate,
        commissionAmount: salesAgentCommission, status: "Pending", approvedBy: req.user.id
      });
    }

    if (superAgentCommission > 0) {
      await Commission.create({
        agent: superAgent._id, userPolicy: policy._id, policyName: policy.policyName,
        clientName: clientUser?.name || "Unknown", premiumAmount: amount, rateApplied: 3,
        commissionAmount: superAgentCommission, status: "Pending", approvedBy: req.user.id
      });
    }

    const io = getIO(req);
    if (io) {
      if (policy.sales_agent_id){
        io.to(`user_${policy.sales_agent_id.toString()}`).emit("earnings:update");
        io.to(`user_${policy.sales_agent_id.toString()}`).emit("agents:update");
      }
      if (superAgent && superAgent._id){
        io.to(`user_${superAgent._id.toString()}`).emit("earnings:update");
        io.to(`user_${superAgent._id.toString()}`).emit("agents:update");
      }
      if (policy.user) io.to(`user_${policy.user.toString()}`).emit("policies:update");
      if (relAgentId) {
        io.to(`user_${relAgentId.toString()}`).emit("policies:update");
        io.to(`role_relationship_agent`).emit("policies:update");
      }
      io.to(`role_admin`).emit("commissions:update");
      io.to(`role_admin`).emit("reviews:update");
      io.to(`role_technical_agent`).emit("reviews:update");
    }

    queueEmail(clientUser?.email, emailTemplates.policyApproved({
      name: clientUser?.name, policyName: policy.policyName, notes: policy.review_notes,
    }));

    res.json({ message: "Approved. Handed to relationship agent.", policy });
  } catch (err) {
    console.error("Approve Error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const rejectPolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    if (!notes) return res.status(400).json({ error: "Rejection reason is required." });

    const policy = await UserPolicy.findById(id);
    if (!policy) return res.status(404).json({ error: "Policy not found" });

    if (req.user.role !== "admin" && String(policy.reviewed_by) !== String(req.user.id)) {
      return res.status(403).json({ error: "Not your assigned review" });
    }

    policy.workflowStage = "Rejected";
    policy.review_notes = notes;
    policy.reviewed_at = new Date();
    policy.approved_by = req.user.id;
    policy.status = "Expired";
    await policy.save();

    const io = getIO(req);
    if (io) {
      if (policy.user) io.to(`user_${policy.user.toString()}`).emit("policies:update");
      if (policy.sales_agent_id) io.to(`user_${policy.sales_agent_id.toString()}`).emit("earnings:update");
      io.to(`role_admin`).emit("reviews:update");
      io.to(`role_admin`).emit("commissions:update");
      io.to(`role_technical_agent`).emit("reviews:update");
    }

    const rejectedUser = await Customer.findById(policy.user).select("name email");
    queueEmail(rejectedUser?.email, emailTemplates.policyRejected({
      name: rejectedUser?.name, policyName: policy.policyName, notes,
    }));

    res.json({ message: "Policy rejected.", policy });
  } catch (err) {
    console.error("Reject Error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getRelationshipPolicies = async (req, res) => {
  try {
    const policies = await UserPolicy.find({
      assigned_relationship_agent_id: req.user.id,
      workflowStage: "Relationship Active",
    })
      .populate("user", "name email phone city age")
      .populate("sales_agent_id", "name email")
      .sort({ reviewed_at: -1 });

    const enriched = policies.map((p) => {
      const obj = p.toObject();
      obj.daysToRenewal = Math.ceil((new Date(p.renewalDate) - new Date()) / (1000 * 60 * 60 * 24));
      return obj;
    });

    res.json({ policies: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getMyPolicies = async (req, res) => {
  try {
    const myPolicies = await UserPolicy.find({ user: req.user.id })
      .sort({ _id: -1 })
      .populate("sales_agent_id", "name email")
      .populate("assigned_relationship_agent_id", "name email phone");

    const policyIds = myPolicies.map((p) => p.policyId);
    const masterPolicies = await Policy.find({ id: { $in: policyIds } });
    const activeStatusMap = {};
    const logoMap = {};
    masterPolicies.forEach((p) => { activeStatusMap[p.id] = p.isActive; logoMap[p.id] = p.logo || ""; });

    const enriched = myPolicies.map((up) => {
      const obj = up.toObject();
      obj.isCatalogActive = activeStatusMap[up.policyId] ?? false;
      obj.logo = logoMap[up.policyId] || "";
      return obj;
    });

    res.json({ policies: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getSoldPolicies = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "super_agent") {
      const team = await Customer.find({ team_id: req.user.id }).select("_id");
      const ids = team.map((t) => t._id);
      ids.push(req.user.id);
      filter.sales_agent_id = { $in: ids };
    } else if (req.user.role.includes("agent")) {
      filter.sales_agent_id = req.user.id;
    } else {
      return res.status(403).json({ error: "Not allowed" });
    }

    const policies = await UserPolicy.find(filter)
      .populate("user", "name email phone")
      .populate("sales_agent_id", "name")
      .populate("assigned_relationship_agent_id", "name")
      .sort({ sale_date: -1 });

    res.json({ policies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const togglePolicyStatus = async (req, res) => {
  try {
    const policy = await Policy.findOne({ id: req.params.id });
    if (!policy) return res.status(404).json({ error: "Policy not found" });
    policy.isActive = !policy.isActive;
    await policy.save();

    const io = getIO(req);
    if (io) io.emit("policies:update");

    res.json({ message: `Policy ${policy.isActive ? "activated" : "deactivated"}`, policy });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createPolicy = async (req, res) => {
  try {
    const { id, name, category, premium, coverage, description, tagline, tenure, eligibility, keyFeatures, isExternal } = req.body;
    const existing = await Policy.findOne({ id });
    if (existing) return res.status(400).json({ error: "A policy with this ID already exists." });

    let premiumValue = req.body.premiumValue;
    if (premiumValue === undefined || premiumValue === null || premiumValue === "") {
      premiumValue = parsePremiumToNumber(premium);
    }
    
    let coverageValue = req.body.coverageValue;
    if (coverageValue === undefined || coverageValue === null || coverageValue === "") {
      coverageValue = 1000000;
    }

    const logoResult = parseLogo(req.body.logo);
    if (logoResult.error) return res.status(400).json({ error: logoResult.error });

    const newPolicy = await Policy.create({
      id, name, category, premium, premiumValue, coverageValue,
      coverage, description, tagline, tenure, eligibility, keyFeatures,
      isExternal: isExternal || false,
      logo: logoResult.value || "",
    });

    const io = getIO(req);
    if (io) io.emit("policies:update");

    res.status(201).json({ message: "Policy created successfully", policy: newPolicy });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updatePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, premium, premiumValue, coverage, coverageValue, description, tagline, tenure, eligibility, keyFeatures, isExternal } = req.body;

    const logoResult = parseLogo(req.body.logo);
    if (logoResult.error) return res.status(400).json({ error: logoResult.error });

    const update = { name, category, premium, premiumValue: Number(premiumValue) || 0, coverage, coverageValue: Number(coverageValue) || 0, description, tagline, tenure, eligibility, keyFeatures, isExternal };
    if (!logoResult.skip) update.logo = logoResult.value;

    const updatedPolicy = await Policy.findByIdAndUpdate(
      id,
      update,
      { new: true, runValidators: true }
    );

    if (!updatedPolicy) return res.status(404).json({ error: "Policy not found" });

    const io = getIO(req);
    if (io) io.emit("policies:update");

    res.json({ message: "Policy updated successfully", policy: updatedPolicy });
  } catch (err) {
    console.error("Update Policy Error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const deletePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Policy.findOneAndDelete({ id });
    if (!deleted) return res.status(404).json({ error: "Policy not found" });
    await UserPolicy.deleteMany({ policyId: id });

    const io = getIO(req);
    if (io) io.emit("policies:update");

    res.json({ message: "Policy deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getPendingReviewCount = async (req, res) => {
  try {
    let query = { workflowStage: "Pending Technical Review" };
    if (req.user.role === "technical_agent") {
      const techAgent = await Customer.findById(req.user.id);
      
      if (techAgent && techAgent.team_id) {
        const superAgentId = techAgent.team_id;
        const teamAgents = await Customer.find({ team_id: superAgentId }).select("_id");
        const teamAgentIds = teamAgents.map(a => a._id);
        teamAgentIds.push(superAgentId);
        query.sales_agent_id = { $in: teamAgentIds };
      } else {
        return res.json({ count: 0 });
      }
    }
    const count = await UserPolicy.countDocuments(query);
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getMyEarnings = async (req, res) => {
  try {
    const agentId = req.user.id;
    const isSuperAgent = req.user.role === "super_agent";

    const myCommissions = await Commission.find({ agent: agentId });
    
    let pendingAmount = 0;
    let paidAmount = 0;
    const pendingPolicies = [];
    const paidPolicies = [];

    myCommissions.forEach((c) => {
      if (c.status === "Paid") {
        paidAmount += c.commissionAmount;
        paidPolicies.push(c);
      } else {
        pendingAmount += c.commissionAmount;
        pendingPolicies.push(c);
      }
    });

    const payouts = await CommissionPayout.find({ agent: agentId }).sort({ paidAt: -1 });

    let teamSnapshot = null;
    if (isSuperAgent) {
      const teamAgents = await Customer.find({ team_id: agentId }).select("_id");
      const memberIds = teamAgents.map((t) => t._id);
      const allIds = [agentId, ...memberIds]; 
      const teamCommissions = await Commission.find({ agent: { $in: allIds } });
      
      const teamPending = teamCommissions
        .filter((c) => c.status === "Pending")
        .reduce((s, c) => s + c.commissionAmount, 0);
        
      const teamPaid = teamCommissions
        .filter((c) => c.status === "Paid")
        .reduce((s, c) => s + c.commissionAmount, 0);

      const [teamClientCount, teamPolicyCount] = await Promise.all([
        Customer.countDocuments({ assigned_agent_id: { $in: allIds } }),
        UserPolicy.countDocuments({ sales_agent_id: { $in: allIds }, workflowStage: "Relationship Active" }),
      ]);

      teamSnapshot = {
        memberCount: allIds.length,
        clientCount: teamClientCount,
        policyCount: teamPolicyCount,
        pendingTotal: teamPending,
        paidTotal: teamPaid,
        lifetimeTotal: teamPending + teamPaid,
      };
    }

    res.json({
      summary: { totalEarned: pendingAmount + paidAmount, pendingAmount, paidAmount, policyCount: myCommissions.length },
      pendingPolicies,
      paidPolicies,
      payouts,
      teamSnapshot,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAllCommissions = async (req, res) => {
  try {
    const agents = await Customer.find({
      role: { $in: ["captive_agent", "independent_agent", "super_agent"] },
      email: { $ne: "direct@insurance.com" }
    });

    const summary = await Promise.all(
      agents.map(async (agent) => {
        // Fetch commissions for this agent
        const allCommissions = await Commission.find({ agent: agent._id });
        
        // Calculate pending & paid for this specific agent
        const pendingCommissions = allCommissions.filter(c => c.status === "Pending");
        const totalPending = pendingCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);
        
        const totalPaid = allCommissions
          .filter(c => c.status === "Paid")
          .reduce((sum, c) => sum + c.commissionAmount, 0);

        return { 
          agent, 
          pendingAmount: totalPending, 
          pendingCount: pendingCommissions.length, 
          totalPaid, 
          pendingPolicies: pendingCommissions 
        };
      })
    );

    const activeSummaries = summary.filter(s => s.pendingAmount > 0 || s.totalPaid > 0);
    res.json({ summaries: activeSummaries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const payAgent = async (req, res) => {
  try {
    const { agentId } = req.params;
    const adminId = req.user.id;

    const pendingCommissions = await Commission.find({ agent: agentId, status: "Pending" });
    if (pendingCommissions.length === 0) return res.status(400).json({ error: "No pending commission to pay." });

    const totalAmount = pendingCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);
    const now = new Date();
    const monthString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const payout = await CommissionPayout.create({
      agent: agentId, amount: totalAmount, paidBy: adminId, paidAt: now, month: monthString,
    });

    await Commission.updateMany(
      { _id: { $in: pendingCommissions.map(c => c._id) } },
      { $set: { status: "Paid", paidAt: now, paidBy: adminId, payoutBatchId: payout._id } }
    );

    const agent = await Customer.findById(agentId);
    const updatedCommissions = await Commission.find({ agent: agentId });
    const pendingPolicies = updatedCommissions.filter(c => c.status === "Pending");
    const payouts = await CommissionPayout.find({ agent: agentId }).sort({ paidAt: -1 });
    
    let teamSnapshot = null;
    if (agent.role === "super_agent") {
      const teamAgents = await Customer.find({ team_id: agentId }).select("_id");
      const allIds = [agentId, ...teamAgents.map(t => t._id)];
      
      const teamCommissions = await Commission.find({ agent: { $in: allIds } });
      const [teamClientCount, teamPolicyCount] = await Promise.all([
        Customer.countDocuments({ assigned_agent_id: { $in: allIds } }),
        UserPolicy.countDocuments({ sales_agent_id: { $in: allIds }, workflowStage: "Relationship Active" }),
      ]);

      const teamPending = teamCommissions.filter(c => c.status === "Pending").reduce((s, c) => s + c.commissionAmount, 0);
      const teamPaid = teamCommissions.filter(c => c.status === "Paid").reduce((s, c) => s + c.commissionAmount, 0);

      teamSnapshot = {
        memberCount: allIds.length, clientCount: teamClientCount, policyCount: teamPolicyCount,
        pendingTotal: teamPending, paidTotal: teamPaid, lifetimeTotal: teamPending + teamPaid,
      };
    }

    const io = getIO(req);
    if (io) {
      io.to(`user_${agentId}`).emit("earnings:update", { 
        type: "PAYOUT_COMPLETED", 
        fullData: {
          summary: { 
            totalEarned: updatedCommissions.reduce((s, c) => s + c.commissionAmount, 0), 
            pendingAmount: pendingPolicies.reduce((s, c) => s + c.commissionAmount, 0), 
            paidAmount: updatedCommissions.filter(c => c.status === "Paid").reduce((s, c) => s + c.commissionAmount, 0), 
            policyCount: updatedCommissions.length 
          },
          pendingPolicies,
          payouts,
          teamSnapshot
        }
      });
      io.to(`role_admin`).emit("commissions:update");
    }

    queueEmail(agent?.email, emailTemplates.commissionPaid({
      name: agent?.name, amount: totalAmount, month: monthString,
    }));

    res.json({ message: "Payout processed successfully", payout });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const paySingleCommission = async (req, res) => {
  try {
    const { commissionId } = req.params;
    const adminId = req.user.id;

    const commission = await Commission.findById(commissionId);
    if (!commission) return res.status(404).json({ error: "Commission record not found." });
    if (commission.status === "Paid") return res.status(400).json({ error: "This commission is already paid." });

    const now = new Date();
    const monthString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const payout = await CommissionPayout.create({
      agent: commission.agent, amount: commission.commissionAmount, paidBy: adminId, paidAt: now, month: monthString,
    });

    commission.status = "Paid";
    commission.paidAt = now;
    commission.paidBy = adminId;
    commission.payoutBatchId = payout._id;
    await commission.save();

    const agentId = commission.agent;
    const agent = await Customer.findById(agentId);
    const updatedCommissions = await Commission.find({ agent: agentId });
    const pendingPolicies = updatedCommissions.filter(c => c.status === "Pending");
    const payouts = await CommissionPayout.find({ agent: agentId }).sort({ paidAt: -1 });
    
    let teamSnapshot = null;
    if (agent.role === "super_agent") {
      const teamAgents = await Customer.find({ team_id: agentId }).select("_id");
      const allIds = [agentId, ...teamAgents.map(t => t._id)];
      const teamCommissions = await Commission.find({ agent: { $in: allIds } });
      const [teamClientCount, teamPolicyCount] = await Promise.all([
        Customer.countDocuments({ assigned_agent_id: { $in: allIds } }),
        UserPolicy.countDocuments({ sales_agent_id: { $in: allIds }, workflowStage: "Relationship Active" }),
      ]);
      const teamPending = teamCommissions.filter(c => c.status === "Pending").reduce((s, c) => s + c.commissionAmount, 0);
      const teamPaid = teamCommissions.filter(c => c.status === "Paid").reduce((s, c) => s + c.commissionAmount, 0);
      teamSnapshot = {
        memberCount: allIds.length, clientCount: teamClientCount, policyCount: teamPolicyCount,
        pendingTotal: teamPending, paidTotal: teamPaid, lifetimeTotal: teamPending + teamPaid,
      };
    }

    const io = getIO(req);
    if (io) {
      io.to(`user_${agentId}`).emit("earnings:update", { 
        type: "PAYOUT_COMPLETED", 
        fullData: {
          summary: { 
            totalEarned: updatedCommissions.reduce((s, c) => s + c.commissionAmount, 0), 
            pendingAmount: pendingPolicies.reduce((s, c) => s + c.commissionAmount, 0), 
            paidAmount: updatedCommissions.filter(c => c.status === "Paid").reduce((s, c) => s + c.commissionAmount, 0), 
            policyCount: updatedCommissions.length 
          },
          pendingPolicies, payouts, teamSnapshot
        }
      });
      io.to(`role_admin`).emit("commissions:update");
    }

    queueEmail(agent?.email, emailTemplates.commissionPaid({
      name: agent?.name, amount: commission.commissionAmount, month: monthString,
      policyName: commission.policyName,
    }));

    res.json({ message: "Policy commission paid successfully", payout });
  } catch (err) {
    console.error("Pay Single Commission Error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const fileClaim = async (req, res) => {
  try {
    const { policyId, claimAmount, reason } = req.body;
    const userId = req.user.id;

    const userPolicy = await UserPolicy.findOne({ _id: policyId, user: userId });
    if (!userPolicy) return res.status(404).json({ error: "Policy not found or not owned by you." });
    if (userPolicy.status !== "Active") return res.status(400).json({ error: "Cannot claim on an inactive policy." });

    const masterPolicy = await Policy.findOne({ id: userPolicy.policyId });
    if (!masterPolicy) return res.status(404).json({ error: "Master policy details not found." });

    const coverageLimit = masterPolicy.coverageValue || 1000000; 
    const previousClaims = await Claim.find({ userPolicy: policyId, status: { $in: ["Pending", "Approved"] } });
    const totalClaimedSoFar = previousClaims.reduce((sum, c) => sum + c.claimAmount, 0);
    const remainingCoverage = coverageLimit - totalClaimedSoFar;

    if (Number(claimAmount) > remainingCoverage) {
      return res.status(400).json({ error: `Claim exceeds remaining coverage. You can only claim up to ₹${remainingCoverage.toLocaleString()} more.` });
    }

    const claim = await Claim.create({ userPolicy: policyId, user: userId, claimAmount: Number(claimAmount), reason });

    const io = getIO(req);
    if (io) {
      io.to(`role_technical_agent`).emit("claims:update");
      io.to(`role_admin`).emit("claims:update");
      io.to(`role_relationship_agent`).emit("claims:update");
      io.to(`user_${userId}`).emit("claims:update"); 
    }

    const claimant = await Customer.findById(userId).select("name email");
    queueEmail(claimant?.email, emailTemplates.claimFiled({
      name: claimant?.name, policyName: userPolicy.policyName,
      claimAmount: claim.claimAmount, reason: claim.reason,
    }));

    res.status(201).json({ message: "Claim filed successfully.", claim });
  } catch (err) {
    console.error("File Claim Error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const reviewClaim = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body;

    if (!notes) return res.status(400).json({ error: "Review notes are required." });
    const claim = await Claim.findById(id);
    if (!claim) return res.status(404).json({ error: "Claim not found" });
    if (claim.status !== "Pending") return res.status(400).json({ error: "Claim already reviewed." });

    claim.status = action;
    claim.review_notes = notes;
    claim.reviewed_by = req.user.id;
    claim.approved_by = req.user.id;
    claim.reviewed_at = new Date();
    await claim.save();

    const io = getIO(req);
    if (io) {
      io.to(`user_${claim.user}`).emit("claims:update");
      io.to(`role_admin`).emit("claims:update");
      io.to(`role_technical_agent`).emit("claims:update");
      io.to(`role_relationship_agent`).emit("claims:update");
    }

    const [claimUser, claimPolicy] = await Promise.all([
      Customer.findById(claim.user).select("name email"),
      UserPolicy.findById(claim.userPolicy).select("policyName"),
    ]);
    queueEmail(claimUser?.email, emailTemplates.claimReviewed({
      name: claimUser?.name, policyName: claimPolicy?.policyName || "your policy",
      claimAmount: claim.claimAmount, status: claim.status, notes: claim.review_notes,
    }));

    res.json({ message: `Claim ${action.toLowerCase()} successfully.`, claim });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getPendingClaims = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === "technical_agent") {
      const techAgent = await Customer.findById(req.user.id);
      
      if (techAgent && techAgent.team_id) {
        const superAgentId = techAgent.team_id;
        const teamAgents = await Customer.find({ team_id: superAgentId }).select("_id");
        const teamAgentIds = teamAgents.map(a => a._id);
        teamAgentIds.push(superAgentId);
        const teamPolicies = await UserPolicy.find({
          sales_agent_id: { $in: teamAgentIds }
        }).select("_id");

        const teamPolicyIds = teamPolicies.map(p => p._id);
        query.userPolicy = { $in: teamPolicyIds };
      } else {
        return res.json({ claims: [] });
      }
    } else if (req.user.role !== "admin") {
      query.status = "Pending";
    }
    const claims = await Claim.find(query)
      .populate("user", "name email phone")
      .populate("userPolicy", "policyName policyId premium")
      .populate("reviewed_by", "name role") 
      .sort({ filedAt: -1 });

    res.json({ claims });
  } catch (err) {
    console.error("getPendingClaims Error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getMyClientClaims = async (req, res) => {
  try {
    const myPolicies = await UserPolicy.find({ assigned_relationship_agent_id: req.user.id }).select("_id");
    const policyIds = myPolicies.map(p => p._id);
    const claims = await Claim.find({ userPolicy: { $in: policyIds } })
      .populate("user", "name email phone")
      .populate("userPolicy", "policyName")
      .sort({ filedAt: -1 });
    res.json({ claims });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getMyClaims = async (req, res) => {
  try {
    const claims = await Claim.find({ user: req.user.id })
      .populate("userPolicy", "policyName premium")
      .sort({ filedAt: -1 });
    res.json({ claims });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getClientActivePolicies = async (req, res) => {
  try {
    const clientId = req.params.id;

    const policies = await UserPolicy.find({ user: clientId })
      .populate("sales_agent_id", "name email role")
      .populate("assigned_relationship_agent_id", "name email role");

    res.json({ policies });
  } catch (err) {
    console.error("Get client policies error:", err);
    res.status(500).json({ error: err.message });
  }
};