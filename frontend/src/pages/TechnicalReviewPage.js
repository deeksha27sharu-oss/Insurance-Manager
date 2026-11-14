import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiGet, apiPut } from "../api/client";
import { useAuth } from "../context/AuthContext"; 
import { useSocketEvent } from "../hooks/useSocketEvents";
import { FiArrowLeft, FiX } from "react-icons/fi";
import Pagination from "../components/common/Pagination"; 

const PAGE_SIZE = 10; 

export default function TechnicalReviewPage() {
  const [policies, setPolicies] = useState([]);
  const [claims, setClaims] = useState([]);
  const [historyPolicies, setHistoryPolicies] = useState([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();

  const [activeTab, setActiveTab] = useState("policies"); 
  const [modalAction, setModalAction] = useState(null); 
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [claimModalAction, setClaimModalAction] = useState(null); 
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  const [pageByTab, setPageByTab] = useState({
    policies: 1,
    claims: 1,
    "claims-history": 1,
    history: 1,
  });

  const handleBack = () => {
    if (location.key !== "default") navigate(-1);
    else navigate("/home");
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [polRes, claimRes, histRes] = await Promise.all([
        apiGet("/policies/pending-reviews"),
        apiGet("/policies/claims/pending"),
        apiGet("/policies/history")
      ]);
      setPolicies(polRes.policies || []);
      setClaims(claimRes.claims || []);
      setHistoryPolicies(histRes.policies || []);
    } catch (err) { 
      console.error(err); 
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { 
    loadData();
  }, [loadData]);

  useSocketEvent("reviews:update", () => {
    console.log("Live policy review update received!");
    loadData();
  });

  useSocketEvent("claims:update", () => {
    console.log("Live claim update received!");
    loadData();
  });

  const openPolicyModal = (policy, action) => {
    setSelectedPolicy(policy);
    setModalAction(action);
    setNotes("");
    setModalError("");
  };

  const openClaimModal = (claim, action) => {
    setSelectedClaim(claim);
    setClaimModalAction(action);
    setNotes("");
    setModalError("");
  };

  const closeModal = () => {
    setSelectedPolicy(null);
    setSelectedClaim(null);
    setModalAction(null);
    setClaimModalAction(null);
    setNotes("");
    setModalError("");
  };

  const handleSubmitPolicyAction = async () => {
    setModalError("");
    if (!notes.trim()) return setModalError("Review notes are required.");
    setIsSubmitting(true);
    try {
      if (modalAction === "approve") {
        await apiPut(`/policies/${selectedPolicy._id}/approve`, { notes });
      } else {
        await apiPut(`/policies/${selectedPolicy._id}/reject`, { notes });
      }
      window.dispatchEvent(new Event("reviews:updated")); 
      setToast("Policy updated successfully.");
      setTimeout(()=>{setToast("");},3000);
      loadData();
      closeModal();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitClaimAction = async () => {
    setModalError("");
    if (!notes.trim()) return setModalError("Review notes are required.");
    setIsSubmitting(true);
    try {
      await apiPut(`/policies/claims/${selectedClaim._id}/review`, {
        action: claimModalAction,
        notes,
      });
      setToast(`Claim ${claimModalAction}.`);
      setTimeout(() => {setToast("");}, 3000);
      loadData();
      closeModal();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingClaims = claims.filter(c => c.status === "Pending");
  const claimHistory = claims.filter(c => c.status !== "Pending");

  const getPage = (tab) => pageByTab[tab] || 1;
  const setPageFor = (tab) => (p) =>
    setPageByTab((prev) => ({ ...prev, [tab]: p }));

  const policiesTotalPages = Math.max(1, Math.ceil(policies.length / PAGE_SIZE));
  const policiesCurrentPage = Math.min(getPage("policies"), policiesTotalPages);
  const pagedPolicies = policies.slice(
    (policiesCurrentPage - 1) * PAGE_SIZE,
    policiesCurrentPage * PAGE_SIZE
  );

  const claimsTotalPages = Math.max(1, Math.ceil(pendingClaims.length / PAGE_SIZE));
  const claimsCurrentPage = Math.min(getPage("claims"), claimsTotalPages);
  const pagedPendingClaims = pendingClaims.slice(
    (claimsCurrentPage - 1) * PAGE_SIZE,
    claimsCurrentPage * PAGE_SIZE
  );

  const claimHistoryTotalPages = Math.max(1, Math.ceil(claimHistory.length / PAGE_SIZE));
  const claimHistoryCurrentPage = Math.min(getPage("claims-history"), claimHistoryTotalPages);
  const pagedClaimHistory = claimHistory.slice(
    (claimHistoryCurrentPage - 1) * PAGE_SIZE,
    claimHistoryCurrentPage * PAGE_SIZE
  );

  const historyTotalPages = Math.max(1, Math.ceil(historyPolicies.length / PAGE_SIZE));
  const historyCurrentPage = Math.min(getPage("history"), historyTotalPages);
  const pagedHistory = historyPolicies.slice(
    (historyCurrentPage - 1) * PAGE_SIZE,
    historyCurrentPage * PAGE_SIZE
  );

  useEffect(() => {
    setPageByTab((prev) => ({
      policies: Math.min(prev.policies, policiesTotalPages),
      claims: Math.min(prev.claims, claimsTotalPages),
      "claims-history": Math.min(prev["claims-history"], claimHistoryTotalPages),
      history: Math.min(prev.history, historyTotalPages),
    }));
  }, [policiesTotalPages, claimsTotalPages, claimHistoryTotalPages, historyTotalPages]);

  if (isLoading) return <div className="policy-detail">Loading...</div>;

  return (
    <div className="policy-detail-fixed technical-review-page">
      <button onClick={handleBack} className="policy-detail-back" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 16 , textAlign: "left"}}>
        <FiArrowLeft /> Back
      </button>

      <h1 className="listing-title">Review Dashboard</h1>

      <div style={{ display: "flex", gap: "16px", borderBottom: "1px solid #e5e7eb", marginBottom: "24px", overflowX: "auto", flexShrink: 0 }}>
        <button 
          onClick={() => setActiveTab("policies")}
          style={{ padding: "12px 16px", border: "none", background: "none", cursor: "pointer", fontWeight: "600", borderBottom: activeTab === "policies" ? "3px solid #003366" : "3px solid transparent", color: activeTab === "policies" ? "#003366" : "#6b7280", whiteSpace: "nowrap" }}
        >
          Policy Reviews ({policies.length})
        </button>
        <button 
          onClick={() => setActiveTab("claims")}
          style={{ padding: "12px 16px", border: "none", background: "none", cursor: "pointer", fontWeight: "600", borderBottom: activeTab === "claims" ? "3px solid #003366" : "3px solid transparent", color: activeTab === "claims" ? "#003366" : "#6b7280", whiteSpace: "nowrap" }}
        >
          Pending Claims ({pendingClaims.length})
        </button>
        <button 
          onClick={() => setActiveTab("claims-history")}
          style={{ padding: "12px 16px", border: "none", background: "none", cursor: "pointer", fontWeight: "600", borderBottom: activeTab === "claims-history" ? "3px solid #003366" : "3px solid transparent", color: activeTab === "claims-history" ? "#003366" : "#6b7280", whiteSpace: "nowrap" }}
        >
          Claims History
        </button>
        <button 
          onClick={() => setActiveTab("history")}
          style={{ padding: "12px 16px", border: "none", background: "none", cursor: "pointer", fontWeight: "600", borderBottom: activeTab === "history" ? "3px solid #003366" : "3px solid transparent", color: activeTab === "history" ? "#003366" : "#6b7280", whiteSpace: "nowrap" }}
        >
          Policy History
        </button>
      </div>

      {activeTab === "policies" && (
        <>
          <section className="policy-section-client">
            {policies.length === 0 ? (
              <p className="policy-section-empty">No policies awaiting review.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {pagedPolicies.map((p) => (
                  <li key={p._id} style={{ padding: 16, borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <strong style={{ color: "#003366", fontSize: "1.05rem" }}>{p.policyName}</strong>
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "#fef3c7", color: "#b45309" }}>PENDING</span>
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#6b7280" }}><strong>Customer:</strong> {p.user?.name} · {p.user?.age} yrs</p>
                      <p style={{ margin: "6px 0 0", fontSize: "0.85rem" }}><strong>Premium:</strong> {p.premium}</p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button onClick={() => openPolicyModal(p, "approve")} style={{ background: "#16a34a", color: "#fff", padding: "8px 16px", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer" }}>Approve</button>
                      <button onClick={() => openPolicyModal(p, "reject")} style={{ background: "#fee2e2", color: "#b91c1c", padding: "8px 16px", border: "1px solid #fca5a5", borderRadius: 6, fontWeight: 600, cursor: "pointer" }}>Reject</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <Pagination
            currentPage={policiesCurrentPage}
            totalPages={policiesTotalPages}
            onPageChange={setPageFor("policies")}
          />
        </>
      )}

      {activeTab === "claims" && (
        <>
          <section className="policy-section-client">
            {pendingClaims.length === 0 ? (
              <p className="policy-section-empty">No claims awaiting review.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {pagedPendingClaims.map((c) => (
                  <li key={c._id} style={{ padding: 16, borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <strong style={{ color: "#003366", fontSize: "1.05rem" }}>Claim: ₹{c.claimAmount.toLocaleString()}</strong>
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "#fee2e2", color: "#b91c1c" }}>PENDING</span>
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#6b7280" }}><strong>Policy:</strong> {c.userPolicy?.policyName}</p>
                      <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "#6b7280" }}><strong>User:</strong> {c.user?.name}</p>
                      <p style={{ margin: "8px 0 0", fontSize: "0.85rem", color: "#1f2937", fontStyle: "italic", borderLeft: "3px solid #cbd5e1", paddingLeft: "8px" }}>"{c.reason}"</p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button onClick={() => openClaimModal(c, "Approved")} style={{ background: "#16a34a", color: "#fff", padding: "8px 16px", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer" }}>Approve Claim</button>
                      <button onClick={() => openClaimModal(c, "Rejected")} style={{ background: "#fee2e2", color: "#b91c1c", padding: "8px 16px", border: "1px solid #fca5a5", borderRadius: 6, fontWeight: 600, cursor: "pointer" }}>Reject Claim</button>
                    </div>
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

      {activeTab === "claims-history" && (
        <>
          <section className="policy-section-client">
            {claimHistory.length === 0 ? (
              <p className="policy-section-empty">No previous claims found.</p>
            ) : (
              <div className="all-clients-table">
                <div className="allClients-table-head" style={{
                    display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1.5fr", gap: "12px", 
                    padding: "12px 8px", borderBottom: "1px solid #e5e7eb", fontWeight: "bold", fontSize: "0.75rem"
                }}>
                  <span>Policy / Client</span>
                  <span>Amount</span>
                  <span>Status</span>
                  <span>Approved By</span>
                  <span>Review Notes</span>
                </div>
                <ul className="all-clients-table-body" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {pagedClaimHistory.map((c) => (
                    <li key={c._id} className="all-clients-row" style={{
                        display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1.5fr", gap: "12px", 
                        padding: "12px 8px", borderBottom: "1px solid #f3f4f6", alignItems: "center"
                    }}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span className="all-clients-name">{c.userPolicy?.policyName}</span>
                        <span className="all-clients-email">{c.user?.name}</span>
                      </div>
                      <span className="all-clients-sno" style={{ fontWeight: "bold" }}>₹{c.claimAmount.toLocaleString()}</span>
                      <span className={`client-status ${c.status === "Approved" ? "client-status-active" : "client-status-expired"}`} style={{ justifySelf: "start" }}>
                        {c.status}
                      </span>
                      <span style={{ fontSize: "0.85rem", color: "#003366", fontWeight: "600" }}>
                        {c.approved_by?.name || c.reviewed_by?.name || "System"}
                      </span>
                      <span style={{ fontSize: "0.8rem", color: "#6b7280", fontStyle: "italic" }}>
                        {c.review_notes || "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
          <Pagination
            currentPage={claimHistoryCurrentPage}
            totalPages={claimHistoryTotalPages}
            onPageChange={setPageFor("claims-history")}
          />
        </>
      )}

      {activeTab === "history" && (
        <>
          <section className="policy-section-client">
            {historyPolicies.length === 0 ? (
              <p className="policy-section-empty">No history found.</p>
            ) : (
              <div className="all-clients-table">
                <div className="allClients-table-head" style={{
                    display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1.5fr 1.5fr", gap: "12px", 
                    padding: "12px 8px", borderBottom: "1px solid #e5e7eb", fontWeight: "bold", fontSize: "0.75rem"
                }}>
                  <span>Policy Name</span>
                  <span>Customer</span>
                  <span>Status</span>
                  <span>Assigned To</span>
                  <span>Approved/Rejected By</span>
                </div>
                <ul className="all-clients-table-body" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {pagedHistory.map((p) => (
                    <li key={p._id} className="all-clients-row" style={{
                        display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1.5fr 1.5fr", gap: "12px", 
                        padding: "12px 8px", borderBottom: "1px solid #f3f4f6", alignItems: "center"
                    }}>
                      <span className="all-clients-name">{p.policyName}</span>
                      <span className="all-clients-email">{p.user?.name}</span>
                      <span className={`client-status ${p.workflowStage === "Relationship Active" ? "client-status-active" : "client-status-expired"}`} style={{ justifySelf: "start" }}>
                        {p.workflowStage === "Relationship Active" ? "APPROVED" : "REJECTED"}
                      </span>
                      <span style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                        {p.reviewed_by?.name || "—"}
                      </span>
                      <span style={{ color: "#003366", fontWeight: "600", fontSize: "0.85rem" }}>
                        {p.approved_by?.name || (p.workflowStage === "Relationship Active" ? "Legacy Tech Agent" : "System")} 
                        <span style={{ color: "#6b7280", fontWeight: "400", marginLeft: "4px" }}>
                          {p.approved_by?.role ? `(${p.approved_by.role.replace(/_/g, " ")})` : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
          <Pagination
            currentPage={historyCurrentPage}
            totalPages={historyTotalPages}
            onPageChange={setPageFor("history")}
          />
        </>
      )}

      {(modalAction || claimModalAction) && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
          <div className="profile-card" style={{ width: "100%", maxWidth: "500px", margin: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <h2 className="profile-card-title" style={{ margin: 0 }}>
                {selectedClaim 
                  ? (claimModalAction === "Approved" ? "Approve Claim" : "Reject Claim") 
                  : (modalAction === "approve" ? "Approve Policy" : "Reject Policy")}
              </h2>
              <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer" }}><FiX size={20} /></button>
            </div>
            <div className="login-field">
              <label className="login-label">Review Notes <span style={{ color: "red" }}>*</span></label>
              <textarea className="login-input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {modalError && <p className="login-error">{modalError}</p>}
            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button onClick={closeModal} className="navbar-link-btn" style={{ flex: 1 }}>Cancel</button>
              <button 
                onClick={selectedClaim ? handleSubmitClaimAction : handleSubmitPolicyAction} 
                className="submit-btn" 
                style={{ flex: 1, backgroundColor: (modalAction === "approve" || claimModalAction === "Approved") ? "#16a34a" : "#dc2626", border: "none" }}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="profile-toast">{toast}</div>}
    </div>
  );
}