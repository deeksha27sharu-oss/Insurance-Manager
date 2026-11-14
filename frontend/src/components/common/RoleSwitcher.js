import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ROUTES } from "../../routes/routePaths";
import { FiUser, FiLogOut } from "react-icons/fi"; 

export default function RoleSwitcher() {
  const { role, user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    setIsOpen(false);
    logout();
    navigate("/", { replace: true }); 
  };

  const isAgentRole =
    role === "super_agent" ||
    role === "captive_agent" ||
    role === "independent_agent" ||
    role === "technical_agent" ||
    role === "relationship_agent";

  const initials = (() => {
    if (role === "admin") return "A";
    const name = (user?.name || "").trim();
    if (!name) return "U";
    return name[0].toUpperCase();
  })();

  const label = user?.name || (isAgentRole ? "Agent" : "User");

  let colorClass = role;
  if (isAgentRole) colorClass = "agent";
  if (role === "admin") colorClass = "admin";

  return (
    <div className="nav-dropdown" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <div className={`role-avatar role-avatar-${colorClass}`}>
          {initials}
        </div>
      </button>

      {isOpen && (
        <div className="nav-dropdown-menu" style={{ width: "200px" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb" }}>
            <div style={{ fontWeight: "600", fontSize: "0.9rem", color: "#1f2937" }}>{label}</div>
            <div style={{ fontSize: "0.75rem", color: "#6b7280", textTransform: "capitalize" }}>
              {role.replace(/_/g, " ")}
            </div>
          </div>

          <Link to="/userprofile" className="nav-dropdown-item" onClick={() => setIsOpen(false)}>
            <FiUser /> My Profile
          </Link>

          <button 
            onClick={handleLogout} 
            className="nav-dropdown-item" 
            style={{ 
              color: "#b91c1c", 
              width: "100%", 
              textAlign: "left",
              background: "transparent",
              cursor: "pointer"
            }}
          >
            <FiLogOut /> Log Out
          </button>
        </div>
      )}
    </div>
  );
}