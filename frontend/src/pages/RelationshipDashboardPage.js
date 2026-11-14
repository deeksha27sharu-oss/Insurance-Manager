import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiGet } from "../api/client";
import { useSocketEvent } from "../hooks/useSocketEvents";
import { FiArrowLeft, FiCalendar, FiX, FiMessageCircle } from "react-icons/fi"; // <-- Added FiMessageCircle
import { useChatPanel } from "../context/ChatPanelContext"; // <-- Added Chat hook
import Pagination from "../components/common/Pagination";

const PAGE_SIZE = 5;

export default function RelationshipDashboardPage() {
  const [policies, setPolicies] = useState([]);
  const [claims, setClaims] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("clients");
  const navigate = useNavigate();
  const location = useLocation();
  
  const { openChat } = useChatPanel(); 

  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedClaim, setSelectedClaim] = useState(null);

  const [pageByTab, setPageByTab] = useState({ clients: 1, claims: 1 });
  const getPage = (tab) => pageByTab[tab] || 1;
  const setPageFor = (tab) => (p) => setPageByTab((prev) => ({ ...prev, [tab]: p }));

  const handleBack = () => {
    if (location.key !== "default") navigate(-1);
    else navigate("/home");
  };

  const loadData = useCallback(async () => {
    try {
      const [polRes, claimRes] = await Promise.all([
        apiGet("/policies/relationship-policies"),
        apiGet("/policies/claims/relationship")
      ]);
      setPolicies(polRes.policies || []);
      setClaims(claimRes.claims || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useSocketEvent("claims:update", () => {
    console.log("Live claim update received for relationship agent!");
    loadData();
  });

  useSocketEvent("policies:update", () => {
    console.log("Live policy update received for relationship agent!");
    loadData();
  });

  const formatDate = (iso) =>
    iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const sortedPolicies = [...policies].sort((a, b) => (a.daysToRenewal ?? 999) - (b.daysToRenewal ?? 999));

  const clientsTotalPages = Math.max(1, Math.ceil(sortedPolicies.length / PAGE_SIZE));
  const clientsCurrentPage = Math.min(getPage("clients"), clientsTotalPages);
  const pagedClients = sortedPolicies.slice((clientsCurrentPage - 1) * PAGE_SIZE, clientsCurrentPage * PAGE_SIZE);

  const claimsTotalPages = Math.max(1, Math.ceil(claims.length / PAGE_SIZE));
  const claimsCurrentPage = Math.min(getPage("claims"), claimsTotalPages);
  const pagedClaims = claims.slice((claimsCurrentPage - 1) * PAGE_SIZE, claimsCurrentPage * PAGE_SIZE);

  useEffect(() => {
    setPageByTab((prev) => ({
      clients: Math.min(prev.clients, clientsTotalPages),
      claims: Math.min(prev.claims, claimsTotalPages),
    }));
  }, [clientsTotalPages, claimsTotalPages]);

  const handleChat = () => {
    if (selectedClient?.user?._id) {
      openChat(null, selectedClient.user._id, true);
      setSelectedClient(null); 
    }
  };

  if (isLoading) return <div className="policy-detail">Loading...</div>;

  return (
    <div className="policy-detail-fixed relationship-dashboard-page">
      <button onClick={handleBack} className="policy-detail-back" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 16, textAlign: "left" }}>
        <FiArrowLeft /> Back
      </button>

      <h1 className="listing-title">Relationship Manager</h1>

      <div style={{ display: "flex", gap: "16px", borderBottom: "1px solid #e5e7eb", marginBottom: "24px", flexShrink: 0 }}>
        <button 
          onClick={() => setActiveTab("clients")} 
          style={{ padding: "12px 16px", border: "none", background: "none", cursor: "pointer", fontWeight: "600", borderBottom: activeTab === "clients" ? "3px solid #003366" : "3px solid transparent", color: activeTab === "clients" ? "#003366" : "#6b7280" }}
        >
          My Clients ({policies.length})
        </button>
        <button 
          onClick={() => setActiveTab("claims")} 
          style={{ padding: "12px 16px", border: "none", background: "none", cursor: "pointer", fontWeight: "600", borderBottom: activeTab === "claims" ? "3px solid #003366" : "3px solid transparent", color: activeTab === "claims" ? "#003366" : "#6b7280" }}
        >
          Client Claims ({claims.length})
        </button>
      </div>

      {activeTab === "clients" && (
        <>
          <section className="policy-section-client">
            {policies.length === 0 ? (
              <p className="policy-section-empty">No clients assigned.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {pagedClients.map((p) => {
                  const dl = p.daysToRenewal;
                  const urgent = dl !== null && dl >= 0 && dl < 30;
                  const expired = dl !== null && dl < 0;
                  return (
                    <li 
                      key={p._id} 
                      onClick={() => setSelectedClient(p)}
                      style={{ padding: 16, borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, cursor: "pointer", transition: "background 0.15s" }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f9fafb"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      <div style={{ flex: 1 }}>
                        <strong style={{ color: "#003366", fontSize: "1.05rem" }}>{p.user?.name}</strong>
                        <p style={{ margin: "4px 0", fontSize: "0.85rem", color: "#6b7280" }}>{p.policyName} · {p.premium}</p>
                        <p style={{ margin: "4px 0", fontSize: "0.85rem", color: "#6b7280" }}>
                          <FiCalendar size={12}/> Renewal: {formatDate(p.renewalDate)} 
                          <span style={{ marginLeft: 8, fontWeight: 700, color: expired ? "#b91c1c" : urgent ? "#b45309" : "#16a34a" }}>
                            {expired ? `expired` : dl === 0 ? "today" : `${dl} days left`}
                          </span>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <Pagination
            currentPage={clientsCurrentPage}
            totalPages={clientsTotalPages}
            onPageChange={setPageFor("clients")}
          />
        </>
      )}

      {activeTab === "claims" && (
        <>
          <section className="policy-section-client">
            <h2 className="policy-section-title">Client Claims</h2>
            {claims.length === 0 ? (
              <p className="policy-section-empty">No claims from your clients.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {pagedClaims.map(c => (
                  <li 
                    key={c._id} 
                    onClick={() => setSelectedClaim(c)}
                    style={{ padding: 16, borderBottom: "1px solid #e5e7eb", cursor: "pointer", transition: "background 0.15s" }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f9fafb"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong>{c.user?.name} - {c.userPolicy?.policyName}</strong>
                      <span className={`client-status ${c.status === "Approved" ? "client-status-active" : c.status === "Rejected" ? "client-status-expired" : ""}`}>{c.status}</span>
                    </div>
                    <p style={{ margin: "4px 0", fontSize: "0.85rem" }}>Amount: ₹{c.claimAmount}</p>
                    <p style={{ margin: "4px 0", fontSize: "0.8rem", color: "#6b7280" }}>Reason: {c.reason}</p>
                    {c.review_notes && <p style={{ margin: "4px 0", fontSize: "0.8rem", color: "#b45309" }}>Reviewer Notes: {c.review_notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <Pagination
            currentPage={claimsCurrentPage}
            totalPages={claimsTotalPages}
            onPageChange={setPageFor("claims")}
          />
        </>
      )}

      {selectedClient && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
          <div className="profile-card" style={{ width: "100%", maxWidth: "600px", margin: "20px", maxHeight: "80vh", overflowY: "auto", animation: "modalPopIn 0.25s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "15px", marginBottom: "20px" }}>
              <div>
                <h2 className="profile-card-title" style={{ margin: 0, color: "#003366" }}>{selectedClient.user?.name}</h2>
                <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>{selectedClient.user?.email}</span>
              </div>
              <button onClick={() => setSelectedClient(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
                <FiX size={24} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
              <div>
                <span className="profile-field-label">Phone</span>
                <div style={{ fontWeight: "600", marginTop: "4px" }}>{selectedClient.user?.phone || "—"}</div>
              </div>
              <div>
                <span className="profile-field-label">City / Age</span>
                <div style={{ fontWeight: "600", marginTop: "4px" }}>{selectedClient.user?.city || "—"} · {selectedClient.user?.age || "—"} yrs</div>
              </div>
            </div>

            <h3 style={{ fontSize: "1rem", color: "#003366", marginBottom: "15px", paddingTop: "15px", borderTop: "1px solid #e5e7eb" }}>Policy Information</h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
              <div>
                <span className="profile-field-label">Policy Name</span>
                <div style={{ fontWeight: "600", marginTop: "4px" }}>{selectedClient.policyName}</div>
              </div>
              <div>
                <span className="profile-field-label">Status</span>
                <div style={{ marginTop: "4px" }}>
                  <span className={`client-status ${selectedClient.status === "Active" ? "client-status-active" : "client-status-expired"}`}>{selectedClient.status}</span>
                </div>
              </div>
              <div>
                <span className="profile-field-label">Premium</span>
                <div style={{ fontWeight: "600", marginTop: "4px", color: "#003366" }}>{selectedClient.premium}</div>
              </div>
              <div>
                <span className="profile-field-label">Renewal Date</span>
                <div style={{ fontWeight: "600", marginTop: "4px", color: selectedClient.daysToRenewal < 0 ? "#b91c1c" : "#1f2937" }}>
                  {formatDate(selectedClient.renewalDate)}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
              <button 
                className="submit-btn" 
                onClick={handleChat}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <FiMessageCircle /> Message
              </button>
              <button className="navbar-link-btn" onClick={() => setSelectedClient(null)}>Close Details</button>
            </div>
          </div>
        </div>
      )}

      {selectedClaim && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
          <div className="profile-card" style={{ width: "100%", maxWidth: "600px", margin: "20px", maxHeight: "80vh", overflowY: "auto", animation: "modalPopIn 0.25s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "15px", marginBottom: "20px" }}>
              <div>
                <h2 className="profile-card-title" style={{ margin: 0, color: "#003366" }}>Claim Details</h2>
                <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>{selectedClaim.userPolicy?.policyName}</span>
              </div>
              <button onClick={() => setSelectedClaim(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
                <FiX size={24} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
              <div>
                <span className="profile-field-label">Client Name</span>
                <div style={{ fontWeight: "600", marginTop: "4px" }}>{selectedClaim.user?.name}</div>
              </div>
              <div>
                <span className="profile-field-label">Claim Status</span>
                <div style={{ marginTop: "4px" }}>
                  <span className={`client-status ${selectedClaim.status === "Approved" ? "client-status-active" : selectedClaim.status === "Rejected" ? "client-status-expired" : ""}`}>{selectedClaim.status}</span>
                </div>
              </div>
              <div>
                <span className="profile-field-label">Claim Amount</span>
                <div style={{ fontWeight: "700", marginTop: "4px", color: "#b91c1c", fontSize: "1.1rem" }}>₹{selectedClaim.claimAmount.toLocaleString()}</div>
              </div>
              <div>
                <span className="profile-field-label">Filed On</span>
                <div style={{ fontWeight: "600", marginTop: "4px" }}>{formatDate(selectedClaim.filedAt)}</div>
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <span className="profile-field-label">Reason for Claim</span>
              <div style={{ marginTop: "4px", padding: "12px", backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "0.9rem", fontStyle: "italic" }}>
                "{selectedClaim.reason}"
              </div>
            </div>

            {selectedClaim.status !== "Pending" && (
              <div>
                <span className="profile-field-label">Reviewer Notes</span>
                <div style={{ marginTop: "4px", padding: "12px", backgroundColor: "#fef3c7", border: "1px solid #fcd34d", borderRadius: "6px", fontSize: "0.9rem", color: "#b45309" }}>
                  <strong>{selectedClaim.reviewed_by?.name || "Reviewer"}:</strong> {selectedClaim.review_notes}
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "30px" }}>
              <button className="navbar-link-btn" onClick={() => setSelectedClaim(null)}>Close Details</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}