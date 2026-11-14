import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {getAllPolicies, getPolicyById, getMyPolicies, buyPolicy, createPolicy, deletePolicy, togglePolicyStatus, getPendingReviews, approvePolicy, rejectPolicy, getRelationshipPolicies,
getSoldPolicies, getPendingReviewCount, getMyEarnings, getAllCommissions, payAgent, fileClaim, getPendingClaims, reviewClaim, getMyClientClaims, getMyClaims, getPolicyHistory, updatePolicy, paySingleCommission} from "../controllers/policyController.js";

export const policyRouter = Router();

policyRouter.get("/public", getAllPolicies);
policyRouter.get("/my-policies", requireAuth, getMyPolicies);
policyRouter.get("/sold-policies", requireAuth, getSoldPolicies);

//tech agent- policy review
policyRouter.get("/pending-reviews", requireAuth, requireRole("technical_agent", "admin"), getPendingReviews);
policyRouter.get("/pending-reviews/count", requireAuth, requireRole("technical_agent", "admin"), getPendingReviewCount);
policyRouter.get("/history", requireAuth, requireRole("admin", "technical_agent"), getPolicyHistory);
policyRouter.put("/:id/approve", requireAuth, requireRole("technical_agent", "admin"), approvePolicy);
policyRouter.put("/:id/reject", requireAuth, requireRole("technical_agent", "admin"), rejectPolicy);

//tech agentclaims
policyRouter.get("/claims/pending", requireAuth, requireRole("technical_agent", "admin"), getPendingClaims);
policyRouter.put("/claims/:id/review", requireAuth, requireRole("technical_agent", "admin"), reviewClaim);

//rel agent
policyRouter.get("/relationship-policies", requireAuth, requireRole("relationship_agent"), getRelationshipPolicies);
policyRouter.get("/claims/relationship", requireAuth, requireRole("relationship_agent"), getMyClientClaims);

// User
policyRouter.post("/buy", requireAuth, requireRole("user"), buyPolicy);
policyRouter.post("/claims", requireAuth, requireRole("user"), fileClaim);
policyRouter.get("/claims/my-claims", requireAuth, requireRole("user"), getMyClaims);

// Commission Routes
policyRouter.get("/commissions/my-earnings", requireAuth, requireRole("captive_agent", "independent_agent", "super_agent"), getMyEarnings);
policyRouter.get("/commissions/admin", requireAuth, requireRole("admin"), getAllCommissions);
policyRouter.post("/commissions/admin/pay/:agentId", requireAuth, requireRole("admin"), payAgent);
policyRouter.post("/commissions/admin/pay-policy/:commissionId", requireAuth, requireRole("admin"), paySingleCommission);

// Admin
policyRouter.post("/", requireAuth, requireRole("admin"), createPolicy);
policyRouter.put("/:id", requireAuth, requireRole("admin"), updatePolicy);
policyRouter.put("/:id/toggle", requireAuth, requireRole("admin"), togglePolicyStatus);
policyRouter.delete("/:id", requireAuth, requireRole("admin"), deletePolicy);

policyRouter.get("/public", requireAuth, getAllPolicies);

policyRouter.get("/", requireAuth, getAllPolicies);
policyRouter.get("/:id", getPolicyById);
