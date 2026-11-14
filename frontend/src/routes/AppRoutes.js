import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import InsuranceListingPage from "../pages/InsuranceListingPage.js";
import PolicyDetailPage from "../pages/PolicyDetailPage";
import ClientDetailPage from "../pages/ClientDetailPage";
import LoginPage from "../pages/LoginPage";
import NotFoundPage from "../pages/NotFoundPage";
import { useAuth } from "../context/AuthContext";
import { ROUTES } from "./routePaths";
import CLientsListPage from "../pages/ClientListPage.js";
import AllClientsPage from "../pages/AllClientsPage.js";
import SignupPage from "../pages/SignupPage.js";
import UserProfilePage from "../pages/UserProfilePage.js";
import CustomersPage from "../pages/CustomersPage.js";
import ManageAgentsPage from "../pages/ManageAgentsPage.js";
import ManagePoliciesPage from "../pages/ManagePoliciesPage.js";
import ManageCategoriesPage from "../pages/ManageCategoriesPage.js";
import TeamAgentsPage from "../pages/TeamAgentsPage.js";
import TechnicalReviewPage from "../pages/TechnicalReviewPage.js";
import RelationshipDashboardPage from "../pages/RelationshipDashboardPage.js";
import AgentEarningsPage from "../pages/AgentEarningsPage.js";
import AdminCommissionPage from "../pages/AdminCommissionPage.js";
import LandingPage from "../pages/LandingPage.js";

function RequireAuth({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: "center" }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  }
  return children;
}

function RequireRole({allowedRoles, children}){
  const {role, isAuthenticated, isLoading}= useAuth();
  if(isLoading) return <div>Loading...</div>;
  if(!isAuthenticated) return <Navigate to ="/" replace />
  if(!allowedRoles.includes(role)) return <div style={{padding: 40}}>Access Denied. You dont have permission to view this page.</div>;
  return children;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      <Route path="/home" element={<RequireAuth><InsuranceListingPage /></RequireAuth>} />
      
      <Route path="/policy/:policyId" element={<PolicyDetailPage />} />      <Route path="/policy/:policyId/client/:clientId" element={<RequireAuth><ClientDetailPage /></RequireAuth>} />
      <Route path="/policy/:policyId/clients" element={<RequireAuth><CLientsListPage /></RequireAuth>} />
      <Route path="/clients" element={<RequireAuth><AllClientsPage /></RequireAuth>} />
      <Route path="/userprofile" element={<RequireAuth><UserProfilePage /></RequireAuth>} />
      
      <Route path="/customers" element={<RequireAuth><CustomersPage /></RequireAuth>} />
      <Route path="/manage-agents" element={<RequireAuth><RequireRole allowedRoles={["admin"]}><ManageAgentsPage /></RequireRole></RequireAuth>} />
      <Route path="/manage-policies" element={<RequireAuth><RequireRole allowedRoles={["admin"]}><ManagePoliciesPage /></RequireRole></RequireAuth>} />
      <Route path="/manage-categories" element={<RequireAuth><RequireRole allowedRoles={["admin"]}><ManageCategoriesPage /></RequireRole></RequireAuth>} />
      <Route path="/team-agents" element={<RequireAuth><RequireRole allowedRoles={["super_agent"]}><TeamAgentsPage /></RequireRole></RequireAuth>} />
      <Route path="/technical-review" element={<RequireAuth><RequireRole allowedRoles={["technical_agent", "admin"]}><TechnicalReviewPage /></RequireRole></RequireAuth>} />
      <Route path="/relationship-dashboard" element={<RequireAuth><RequireRole allowedRoles={["relationship_agent"]}><RelationshipDashboardPage /></RequireRole></RequireAuth>} />
      <Route path="/my-earnings" element={<RequireAuth><RequireRole allowedRoles={["captive_agent", "independent_agent", "super_agent"]}><AgentEarningsPage /></RequireRole></RequireAuth>} />
      <Route path="/admin-commissions" element={<RequireAuth><RequireRole allowedRoles={["admin"]}><AdminCommissionPage /></RequireRole></RequireAuth>} />
      
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}