import { Link, useLocation } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react"; 
import RoleSwitcher from "./RoleSwitcher";
import { FiShield, FiMessageCircle, FiUserCheck, FiFileText, FiUsers, FiLayout, FiUser, FiMenu, FiFolder, FiCheckSquare, FiDollarSign, FiBriefcase } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { useChatPanel } from "../../context/ChatPanelContext";
import { apiGet } from "../../api/client";
import { useSocketEvent } from "../../hooks/useSocketEvents";
import "./Navbar.css";

const HIDE_ON = ["/login", "/signup"]; 

export default function Navbar() {
  const { role, user } = useAuth();
  const location = useLocation();
  const { openChat, isOpen } = useChatPanel();

  const [unreadTotal, setUnreadTotal] = useState(0);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const adminDropdownRef = useRef(null);
  const agentDropdownRef = useRef(null);

  const processedMessageIds = useRef(new Set());

  const isSuperAgent = role === "super_agent";
  const isTechnicalAgent = role === "technical_agent";
  const isRelationshipAgent = role === "relationship_agent";
  const canReview = isTechnicalAgent || role === "admin";
  const isAdmin = role === "admin";
  const isAgent = role === "super_agent" || role === "captive_agent" || role === "independent_agent";

  const [pendingCount, setPendingCount] = useState(0);

  const fetchPendingCount = useCallback(async () => {
    if (!canReview) return;
    try {
      const res = await apiGet("/policies/pending-reviews/count");
      setPendingCount(res.count || 0);
    } catch (err) {
      console.error("Failed to fetch pending count", err);
    }
  }, [canReview]);

  const fetchUnreadTotal = useCallback(async () => {
    if (!role || isOpen) return; 
    try {
      const res = await apiGet("/chat/contacts");
      const total = (res.contacts || []).reduce((sum, c) => sum + (c.unread || 0), 0);
      setUnreadTotal(total);
    } catch (err) {
      console.error("Failed to fetch unread total", err);
    }
  }, [role, isOpen]);

  useEffect(() => {
    fetchPendingCount();
    fetchUnreadTotal();
    const interval = setInterval(() => {
      fetchPendingCount();
      fetchUnreadTotal();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchPendingCount, fetchUnreadTotal]);

  useSocketEvent("reviews:update", () => {
    fetchPendingCount();
  });

  useSocketEvent("chat:message", (msg) => {
    if (isOpen || String(msg.senderId) === String(user?.userId)) return;
    if (processedMessageIds.current.has(msg._id)) return;
    processedMessageIds.current.add(msg._id);

    setUnreadTotal((prev) => prev + 1);
  });

  useEffect(() => {
    if (isOpen) {
      setUnreadTotal(0);
    } else {
      fetchUnreadTotal();
    }
  }, [isOpen, fetchUnreadTotal]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(event.target)) setShowAdminMenu(false);
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(event.target)) setShowAgentMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setShowAdminMenu(false);
    setShowAgentMenu(false);
  }, [location.pathname]);

  if (HIDE_ON.includes(location.pathname)) return null;

  if (!role) {
    return (
      <header className="navbar">
        <Link to="/" className="navbar-brand">
          <FiShield />
          <span>Insurance Portal</span>
        </Link>
        <div className="navbar-right">
          <Link to="/login" className="navbar-link-btn" style={{ textDecoration: "none" }}>Log In</Link>
          <Link to="/signup" className="navbar-link-btn" style={{ textDecoration: "none"}}>Sign Up</Link>
        </div>
      </header>
    );
  }

  return (
    <header className="navbar">
      <Link to="/home" className="navbar-brand">
        <FiShield />
        <span>Insurance Portal</span>
      </Link>
      
      <div className="navbar-right">
        
        <button
          type="button"
          className="navbar-link-btn"
          onClick={() => openChat(null, null, true)}
          style={{ position: "relative" }}
        >
          <FiMessageCircle /> Messages
          {unreadTotal > 0 && <span className="navbar-badge">{unreadTotal > 99 ? "99+" : unreadTotal}</span>}
        </button>

        {isTechnicalAgent && (
          <>
            <Link to="/customers" className="navbar-link-btn">
              <FiUsers /> My Clients
            </Link>
            <Link to="/technical-review" className="navbar-link-btn" style={{ position: "relative" }}>
              <FiCheckSquare /> Reviews
              {pendingCount > 0 && (
                <span className="navbar-badge" style={{ position: "absolute", top: "-6px", right: "-6px" }}>
                  {pendingCount}
                </span>
              )}
            </Link>
          </>
        )}

        {isRelationshipAgent && (
          <>
            <Link to="/customers" className="navbar-link-btn">
              <FiUsers /> My Clients
            </Link>
            <Link to="/relationship-dashboard" className="navbar-link-btn">
              <FiLayout /> Dashboard
            </Link>
          </>
        )}

        {isAdmin && (
          <div className="nav-dropdown" ref={adminDropdownRef}>
            <button className="navbar-link-btn" onClick={() => setShowAdminMenu(!showAdminMenu)} style={{ display: "flex", alignItems: "center", gap: "6px", position: "relative" }}>
              <FiMenu /> Admin Menu
              {pendingCount > 0 && (
                <span className="navbar-badge" style={{ position: "absolute", top: "-6px", right: "-6px", background: "#dc2626" }}>
                  {pendingCount}
                </span>
              )}
            </button>

            {showAdminMenu && (
              <div className="nav-dropdown-menu">
                <Link to="/customers" className="nav-dropdown-item"><FiUsers /> All Clients</Link>
                <Link to="/manage-agents" className="nav-dropdown-item"><FiUserCheck /> Manage Agents</Link>
                <Link to="/manage-policies" className="nav-dropdown-item"><FiFileText /> Manage Policies</Link>
                <Link to="/manage-categories" className="nav-dropdown-item"><FiFolder /> Manage Categories</Link>
                <Link to="/admin-commissions" className="nav-dropdown-item"><FiDollarSign /> Commission Payouts</Link>
                <Link to="/technical-review" className="nav-dropdown-item"><FiCheckSquare /> Approve Policies</Link>
              </div>
            )}
          </div>
        )}

        {isAgent && (
          <div className="nav-dropdown" ref={agentDropdownRef}>
            <button className="navbar-link-btn" onClick={() => setShowAgentMenu(!showAgentMenu)} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <FiBriefcase /> Agent Menu
            </button>

            {showAgentMenu && (
              <div className="nav-dropdown-menu">
                <Link to="/customers" className="nav-dropdown-item"><FiUser /> My Clients</Link>
                <Link to="/my-earnings" className="nav-dropdown-item"><FiDollarSign /> Earnings</Link>
                {isSuperAgent && (
                  <Link to="/team-agents" className="nav-dropdown-item"><FiUsers /> My Team</Link>
                )}
              </div>
            )}
          </div>
        )}

        <RoleSwitcher />
      </div>
    </header>
  );
}