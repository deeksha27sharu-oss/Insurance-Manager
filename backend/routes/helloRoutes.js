import { Router } from "express";
import { getAllClients } from "../controllers/clientsController.js";
import { getHello, getRoot } from "../controllers/helloController.js";
import {getAllCustomers, getCustomerById, updateCustomer, deleteCustomer, deleteAllCustomers, getCustomerStats,} from "../controllers/customerController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createClient, getCustomerClaims } from "../controllers/customerController.js";
import { getClientActivePolicies } from "../controllers/policyController.js";
import { getExternalPolicies, getAdminExternalPolicies, getExternalPolicyById } from "../controllers/externalApiController.js";

export const helloRouter = Router();

helloRouter.get("/", getRoot);
helloRouter.get("/hello", getHello);

helloRouter.get("/external/policies", requireAuth, getExternalPolicies);
helloRouter.get("/external/policies/:uin", requireAuth, getExternalPolicyById);
helloRouter.get("/external/admin-policies", requireAuth, requireRole("admin"), getAdminExternalPolicies);

helloRouter.get("/clients", requireAuth, requireRole("admin", "super_agent", "captive_agent", "independent_agent", "technical_agent", "relationship_agent"), getAllClients);
helloRouter.get("/customers/stats/summary", requireAuth, requireRole("admin", "super_agent", "captive_agent", "independent_agent", "technical_agent", "relationship_agent"), getCustomerStats);
helloRouter.get("/customers", requireAuth, requireRole("admin", "super_agent", "captive_agent", "independent_agent", "technical_agent", "relationship_agent"), getAllCustomers);

helloRouter.get("/customers/:id", requireAuth, getCustomerById);
helloRouter.put("/customers/:id", requireAuth, updateCustomer);
helloRouter.get("/customers/:id/claims", requireAuth, requireRole("admin", "super_agent", "captive_agent", "independent_agent", "technical_agent", "relationship_agent"), getCustomerClaims);
helloRouter.get("/customers/:id/policies", requireAuth, requireRole("admin", "super_agent", "captive_agent", "independent_agent", "technical_agent", "relationship_agent"), getClientActivePolicies);
helloRouter.delete("/customers", requireAuth, requireRole("admin"), deleteAllCustomers);
helloRouter.delete("/customers/:id", requireAuth, requireRole("admin", "super_agent", "captive_agent", "independent_agent"), deleteCustomer);
helloRouter.post("/customers", requireAuth, requireRole("admin", "super_agent", "captive_agent", "independent_agent"), createClient);