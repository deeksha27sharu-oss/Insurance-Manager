import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiGet } from "../api/client";
import { useSocketEvent } from "../hooks/useSocketEvents";
import {FiMail,FiPhone,FiArrowLeft,FiUsers,FiFileText,FiSearch,FiX,FiChevronUp,FiChevronDown,} from "react-icons/fi";
import { FaRupeeSign } from "react-icons/fa";

const SORT_OPTIONS = [
  { key: "clients_desc", label: "Clients (High → Low)" },
  { key: "pending_desc", label: "Pending (High → Low)" },
  { key: "paid_desc",    label: "Paid (High → Low)" },
  { key: "name",         label: "Name (A–Z)" },
];

const ROLE_FILTERS = [
  { key: "all",                label: "All Roles" },
  { key: "captive_agent",      label: "Captive Agents" },
  { key: "independent_agent",  label: "Independent Agents" },
  { key: "technical_agent",    label: "Technical Agents"},
  { key: "relationship_agent", label: "Relationship Agent"}, 
];

const formatCurrency = (amt) => `₹${Number(amt || 0).toLocaleString("en-IN")}`;

export default function TeamAgentsPage() {
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortBy, setSortBy] = useState("clients_desc");

  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (location.key !== "default") navigate(-1);
    else navigate("/home");
  };

  const loadTeam = useCallback(async () => {
    try {
      const res = await apiGet("/auth/team-agents");
      setAgents(res.agents || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  useSocketEvent("agents:update", () => {
    console.log("Live agent update received — refreshing team");
    loadTeam();
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const visibleAgents = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();

    let list = agents.filter((a) => {
      if (roleFilter !== "all" && a.role !== roleFilter) return false;
      if (!q) return true;
      return (
        (a.name || "").toLowerCase().includes(q) ||
        (a.email || "").toLowerCase().includes(q) ||
        (a.phone || "").toLowerCase().includes(q)
      );
    });

    list = [...list];
    const lifetime = (a) =>
      (a.pendingCommission || 0) + (a.totalCommissionPaid || 0);

    switch (sortBy) {
      case "name":
      case "name_desc":
        list.sort((a, b) =>
          sortBy === "name_desc"
            ? b.name.localeCompare(a.name)
            : a.name.localeCompare(b.name)
        );
        break;
      case "pending_desc":
      case "pending_asc":
        list.sort((a, b) =>
          sortBy === "pending_asc"
            ? a.pendingCommission - b.pendingCommission
            : b.pendingCommission - a.pendingCommission
        );
        break;
      case "paid_desc":
      case "paid_asc":
        list.sort((a, b) =>
          sortBy === "paid_asc"
            ? a.totalCommissionPaid - b.totalCommissionPaid
            : b.totalCommissionPaid - a.totalCommissionPaid
        );
        break;
      case "clients_desc":
      case "clients_asc":
        list.sort((a, b) =>
          sortBy === "clients_asc"
            ? a.clientCount - b.clientCount
            : b.clientCount - a.clientCount
        );
        break;
      case "policies_desc":
      case "policies_asc":
        list.sort((a, b) =>
          sortBy === "policies_asc"
            ? a.policyCount - b.policyCount
            : b.policyCount - a.policyCount
        );
        break;
      case "lifetime_desc":
      case "lifetime_asc":
        list.sort((a, b) =>
          sortBy === "lifetime_asc"
            ? lifetime(a) - lifetime(b)
            : lifetime(b) - lifetime(a)
        );
        break;
      default:
        break;
    }

    return list;
  }, [agents, debouncedQuery, roleFilter, sortBy]);

  const handleColumnSort = (baseKey) => {
    const ascKey = `${baseKey}_asc`;
    const descKey = `${baseKey}_desc`;
    if (sortBy === descKey) setSortBy(ascKey);
    else setSortBy(descKey);
  };

  const renderSortIcon = (baseKey) => {
    if (sortBy === `${baseKey}_asc`) return <FiChevronUp size={14} />;
    if (sortBy === `${baseKey}_desc`) return <FiChevronDown size={14} />;
    return null;
  };

  return (
    <div className="policy-detail team-agents-page" style={{ maxWidth: 1100, margin: "0 auto" }}>
      <button
        onClick={handleBack}
        className="policy-detail-back"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          marginBottom: 16,
          textAlign: "left",
        }}
      >
        <FiArrowLeft /> Back
      </button>

      <div style={{ marginBottom: 20 }}>
        <h1 className="listing-title" style={{ margin: 0 }}>
          My Team{" "}
          <span className="policy-section-count">({agents.length} agents)</span>
        </h1>
      </div>

      {isLoading ? (
        <p className="policy-section-empty">Loading team...</p>
      ) : (
        <>
          {/* Filters */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                height: 40,
                padding: "0 12px",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                background: "#fff",
                flex: "1 1 260px",
                minWidth: 220,
              }}
            >
              <FiSearch style={{ color: "#6b7280", marginRight: 8 }} />
              <input
                type="text"
                placeholder="Search name, email, phone..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: "0.9rem",
                  minWidth: 0,
                }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#6b7280",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  <FiX size={14} />
                </button>
              )}
            </div>

            <select
              className="listing-filter-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              {ROLE_FILTERS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>

            <select
              className="listing-filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <section className="policy-section-client">
            <h2 className="policy-section-title" style={{ marginBottom: 0 }}>
              Team Members
              <span className="policy-section-count">
                {" "}
                ({visibleAgents.length})
              </span>
            </h2>

            {visibleAgents.length === 0 ? (
              <p className="policy-section-empty" style={{ padding: "32px 0" }}>
                {agents.length === 0
                  ? "You don't have any agents assigned to your team yet."
                  : "No agents match the current filters."}
              </p>
            ) : (
              <div className="all-clients-table">
                <div
                  className="allClients-table-head"
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "1.6fr 2fr 1fr 1fr 0.8fr 0.8fr 1fr 1fr 1fr",
                    gap: 12,
                    padding: "12px 8px",
                    borderBottom: "1px solid #e5e7eb",
                    fontWeight: 700,
                    fontSize: "0.72rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "#666",
                  }}
                >
                  <SortableHeader
                    label="Agent"
                    active={sortBy === "name" || sortBy === "name_desc"}
                    icon={renderSortIcon("name")}
                    onClick={() => handleColumnSort("name")}
                  />
                  <span>Contact</span>
                  <span>Role</span>
                  <SortableHeader
                    label="Clients"
                    active={sortBy.startsWith("clients")}
                    icon={renderSortIcon("clients")}
                    onClick={() => handleColumnSort("clients")}
                  />
                  <SortableHeader
                    label="Policies"
                    active={sortBy.startsWith("policies")}
                    icon={renderSortIcon("policies")}
                    onClick={() => handleColumnSort("policies")}
                  />
                  <SortableHeader
                    label="Pending"
                    active={sortBy.startsWith("pending")}
                    icon={renderSortIcon("pending")}
                    onClick={() => handleColumnSort("pending")}
                  />
                  <SortableHeader
                    label="Paid"
                    active={sortBy.startsWith("paid")}
                    icon={renderSortIcon("paid")}
                    onClick={() => handleColumnSort("paid")}
                  />
                  <SortableHeader
                    label="Lifetime"
                    active={sortBy.startsWith("lifetime")}
                    icon={renderSortIcon("lifetime")}
                    onClick={() => handleColumnSort("lifetime")}
                  />
                </div>

                <ul
                  className="all-clients-table-body"
                  style={{ listStyle: "none", padding: 0, margin: 0 }}
                >
                  {visibleAgents.map((a) => {
                    const lifetime =
                      (a.pendingCommission || 0) +
                      (a.totalCommissionPaid || 0);
                    return (
                      <li
                        key={a._id}
                        className="all-clients-row"
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "1.6fr 2fr 1fr 1fr 0.8fr 0.8fr 1fr 1fr 1fr",
                          gap: 12,
                          padding: "12px 8px",
                          borderBottom: "1px solid #f3f4f6",
                          alignItems: "center",
                        }}
                      >
                        <span className="all-clients-name">{a.name}</span>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                          }}
                        >
                          <span
                            className="all-clients-email"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: "0.82rem",
                            }}
                          >
                            <FiMail size={12} /> {a.email}
                          </span>
                          <span
                            className="all-clients-email"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: "0.82rem",
                            }}
                          >
                            <FiPhone size={12} /> {a.phone}
                          </span>
                        </div>
                        <span
                          className="all-clients-policy"
                          style={{
                            textTransform: "capitalize",
                            fontSize: "0.85rem",
                          }}
                        >
                          {a.role.replace(/_/g, " ")}
                        </span>
                        <span
                          style={{
                            fontWeight: 700,
                            color: "#003366",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <FiUsers size={13} /> {a.clientCount}
                        </span>
                        <span
                          style={{
                            fontWeight: 700,
                            color: "#003366",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <FiFileText size={13} /> {a.policyCount}
                        </span>
                        <span
                          style={{ fontWeight: 700, color: "#b45309" }}
                        >
                          {formatCurrency(a.pendingCommission)}
                        </span>
                        <span
                          style={{
                            fontWeight: 700,
                            color: "#166534",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <FaRupeeSign size={13} />{formatCurrency(a.totalCommissionPaid)}
                        </span>
                        <span
                          style={{ fontWeight: 600, color: "#1e40af" }}
                        >
                          {formatCurrency(lifetime)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function SortableHeader({ label, active, icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        textAlign: "left",
        fontWeight: 700,
        fontSize: "0.72rem",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: active ? "#003366" : "#666",
        display: "flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {label}{icon}
    </button>
  );
}