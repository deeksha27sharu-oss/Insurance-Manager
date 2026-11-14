import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiGet } from "../api/client";
import { useSocketEvent } from "../hooks/useSocketEvents";
import { FiArrowLeft, FiClock, FiCheckCircle, FiTrendingUp, FiInbox, FiUsers, FiFileText, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { FaRupeeSign } from "react-icons/fa";

const RECENT_POLICIES_COUNT = 3;

export default function AgentEarningsPage() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false); 
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (location.key !== "default") navigate(-1);
    else navigate("/home");
  };

  const loadData = useCallback(async () => {
    try {
      const res = await apiGet("/policies/commissions/my-earnings");
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

    useSocketEvent("earnings:update", (payload) => {
    console.log("Live earnings update received!", payload);
    
    if (payload && payload.type === "PAYOUT_COMPLETED") {
      if (payload.fullData) {
        setData(payload.fullData);
      } else {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            summary: {
              ...prev.summary,
              pendingAmount: prev.summary.pendingAmount - payload.amount,
              paidAmount: prev.summary.paidAmount + payload.amount,
            },
            pendingPolicies: [], 
            payouts: [payload.payout, ...prev.payouts], 
          };
        });
      }
      setIsExpanded(false); 
    } else {
      loadData();
    }
  });

  if (isLoading) {
    return (
      <div className="policy-detail" style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
        Loading your earnings...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="policy-detail">
        <button onClick={handleBack} className="policy-detail-back" style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          ← Back
        </button>
        <p>No earnings data found.</p>
      </div>
    );
  }

  const formatCurrency = (amt) => `₹${(amt || 0).toLocaleString("en-IN")}`;
  const formatDate = (iso) => new Date(iso).toLocaleDateString("en-IN", { 
    day: "2-digit", month: "short", year: "numeric" 
  });

  const { summary, pendingPolicies, payouts, teamSnapshot } = data;
  
  // Calculate which pending policies to show
  const visiblePolicies = isExpanded 
    ? pendingPolicies 
    : pendingPolicies.slice(0, RECENT_POLICIES_COUNT);
  const hasMore = pendingPolicies.length > RECENT_POLICIES_COUNT;

  return (
    <div className="policy-detail" style={{ maxWidth: "900px", margin: "0 auto", paddingBottom: "40px" }}>
      
      <button 
        onClick={handleBack} 
        className="policy-detail-back" 
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: "24px", display: "flex", alignItems: "center", gap: "6px" }}
      >
        <FiArrowLeft /> Back 
      </button>

      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "1.75rem", color: "#003366", margin: 0, fontWeight: "700" }}>
          Earnings
        </h1>
        <p style={{ color: "#6b7280", margin: "4px 0 0", fontSize: "0.95rem" }}>
          Track your commissions and payout history.
        </p>
      </div>

      {teamSnapshot && (
        <>
          <h2 style={{ fontSize: "1rem", color: "#003366", margin: "0 0 12px", fontWeight: 700 }}>
            Team Overview (incl. you)
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
            <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280" }}>Team Pending</span>
                <FiClock size={18} color="#b45309" />
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#b45309", lineHeight: 1.1 }}>{formatCurrency(teamSnapshot.pendingTotal)}</div>
            </div>
            <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280" }}>Team Paid</span>
                <FiCheckCircle size={18} color="#166534" />
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#166534", lineHeight: 1.1 }}>{formatCurrency(teamSnapshot.paidTotal)}</div>
            </div>
            <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280" }}>Team Lifetime</span>
                <FiTrendingUp size={18} color="#1e40af" />
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#1e40af", lineHeight: 1.1 }}>{formatCurrency(teamSnapshot.lifetimeTotal)}</div>
            </div>
            <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280" }}>Team Clients</span>
                <FiUsers size={18} color="#003366" />
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#003366", lineHeight: 1.1 }}>{teamSnapshot.clientCount}</div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}>
                <FiFileText size={11} /> {teamSnapshot.policyCount} policies · {teamSnapshot.memberCount} members
              </div>
            </div>
          </div>
          <h2 style={{ fontSize: "1rem", color: "#003366", margin: "0 0 12px", fontWeight: 700 }}>
            Your Commission (as team member)
          </h2>
        </>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px", marginBottom: "32px" }}>
        <div style={{ background: "white", border: "1px solid #807f7e", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#003366", textTransform: "uppercase", letterSpacing: "0.05em" }}>Pending Payout</span>
            <FiClock size={20} color="#003366" />
          </div>
          <div style={{ fontSize: "2rem", fontWeight: "800", color: "#003366", lineHeight: 1 }}>{formatCurrency(summary.pendingAmount)}</div>
          <div style={{ fontSize: "0.85rem", color: "#003366", opacity: 0.8 }}>Across {pendingPolicies.length} policies</div>
        </div>

        <div style={{ background: "white", border: "1px solid #807f7e", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#003366", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Paid</span>
            <FiCheckCircle size={20} color="#003366" />
          </div>
          <div style={{ fontSize: "2rem", fontWeight: "800", color: "#003366", lineHeight: 1 }}>{formatCurrency(summary.paidAmount)}</div>
          <div style={{ fontSize: "0.85rem", color: "#003366", opacity: 0.8 }}>Processed to your account</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #eff6ff, #dbeafe)", border: "1px solid #93c5fd", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#1e40af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Lifetime Earnings</span>
            <FiTrendingUp size={20} color="#1e40af" />
          </div>
          <div style={{ fontSize: "2rem", fontWeight: "800", color: "#1e3a8a", lineHeight: 1 }}>{formatCurrency(summary.totalEarned)}</div>
          <div style={{ fontSize: "0.85rem", color: "#1e40af", opacity: 0.8 }}>Your all-time commission</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px" }}>
        <section style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: "8px" }}>
            <FiClock color="#b45309" size={20} />
            <h2 style={{ margin: 0, fontSize: "1.1rem", color: "#1f2937" }}>Pending Commissions</h2>
          </div>
          
          {pendingPolicies.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
              <FiCheckCircle size={32} color="#10b981" style={{ marginBottom: "12px", opacity: 0.5 }} />
              <p style={{ margin: 0, fontWeight: "500" }}>You're all caught up!</p>
              <p style={{ margin: "4px 0 0", fontSize: "0.85rem", opacity: 0.8 }}>No pending commissions at the moment.</p>
            </div>
          ) : (
            <>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {visiblePolicies.map((p, idx) => (
                  <li key={p._id} style={{ 
                    padding: "16px 24px", 
                    borderBottom: (idx === visiblePolicies.length - 1 && !hasMore) ? "none" : "1px solid #f3f4f6",
                    display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px"
                  }}>
                    <div>
                      <strong style={{ display: "block", color: "#003366", fontSize: "0.95rem" }}>{p.policyName}</strong>
                      <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>Client: {p.clientName}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ display: "block", fontSize: "0.75rem", color: "#9ca3af", marginBottom: "2px" }}>
                        {p.rateApplied || 15}% of ₹{p.premiumAmount?.toLocaleString("en-IN") || "0"}
                      </span>
                      <span style={{ display: "block", fontWeight: "700", color: "#b45309", fontSize: "1.05rem" }}>{formatCurrency(p.commissionAmount)}</span>
                      <span style={{ fontSize: "0.7rem", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px" }}>Awaiting payout</span>
                    </div>
                  </li>
                ))}
              </ul>
              
              {/* Show All / Show Less Toggle */}
              {hasMore && (
                <div style={{ padding: "12px 24px", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "center", backgroundColor: "#f9fafb" }}>
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      background: "none",
                      border: "none",
                      color: "#003366",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      cursor: "pointer",
                      padding: "6px 12px",
                    }}
                  >
                    {isExpanded ? (
                      <>Show Less <FiChevronUp size={16} /></>
                    ) : (
                      <>Show All ({pendingPolicies.length}) <FiChevronDown size={16} /></>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <section style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: "8px" }}>
            <FaRupeeSign color="#166534" size={20} />
            <h2 style={{ margin: 0, fontSize: "1.1rem", color: "#1f2937" }}>Payout History</h2>
          </div>
          
          {payouts.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
              <FiInbox size={32} color="#9ca3af" style={{ marginBottom: "12px", opacity: 0.5 }} />
              <p style={{ margin: 0, fontWeight: "500" }}>No payouts yet</p>
              <p style={{ margin: "4px 0 0", fontSize: "0.85rem", opacity: 0.8 }}>Your processed payments will appear here.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: "12px 24px", fontSize: "0.75rem", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Date</th>
                    <th style={{ padding: "12px 24px", fontSize: "0.75rem", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Period</th>
                    <th style={{ padding: "12px 24px", fontSize: "0.75rem", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p, idx) => (
                    <tr key={p._id} style={{ borderBottom: idx === payouts.length - 1 ? "none" : "1px solid #f3f4f6" }}>
                      <td style={{ padding: "16px 24px", fontSize: "0.9rem", color: "#1f2937", fontWeight: "500" }}>{formatDate(p.paidAt)}</td>
                      <td style={{ padding: "16px 24px", fontSize: "0.9rem", color: "#6b7280" }}>{p.month || "—"}</td>
                      <td style={{ padding: "16px 24px", textAlign: "right" }}>
                        <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: "999px", fontSize: "0.85rem", fontWeight: "700", color: "#166534", backgroundColor: "#dcfce7" }}>
                          + {formatCurrency(p.amount)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}