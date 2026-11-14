import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiGet, apiPost } from "../api/client";
import { useSocketEvent } from "../hooks/useSocketEvents";
import { FiArrowLeft, FiCheckCircle, FiChevronRight } from "react-icons/fi";
import { FaRupeeSign } from "react-icons/fa";
import Pagination from "../components/common/Pagination";

const PAGE_SIZE = 5;
const RECENT_POLICIES_COUNT = 5;
const MODAL_PAGE_SIZE = 6;

export default function AdminCommissionPage() {
  const [summaries, setSummaries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [processingId, setProcessingId] = useState(null);
  
  const [payingPolicyId, setPayingPolicyId] = useState(null); 

  const [viewingAgent, setViewingAgent] = useState(null);
  const [modalVisibleCount, setModalVisibleCount] = useState(MODAL_PAGE_SIZE);

  const [page, setPage] = useState(1);

  const navigate = useNavigate();
  const location = useLocation();
  const modalScrollRef = useRef(null);

  const handleBack = () => {
    if (location.key !== "default") navigate(-1);
    else navigate("/home");
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiGet("/policies/commissions/admin");
      setSummaries(res.summaries || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useSocketEvent("commissions:update", () => {
    console.log("Live commission update received!");
    loadData();
  });

  useEffect(() => {
    if (viewingAgent) {
      const updatedAgent = summaries.find(s => s.agent._id === viewingAgent.agent._id);
      if (updatedAgent) {
        setViewingAgent(updatedAgent);
      } else {
        setViewingAgent(null);
      }
    }
  }, [summaries, viewingAgent]);

  const handlePayAll = async (agentId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Confirm payout for ALL pending policies for this agent?")) return;
    setProcessingId(agentId);
    try {
      await apiPost(`/policies/commissions/admin/pay/${agentId}`, {});
      setToast("Full payout processed successfully!");
      setTimeout(() => setToast(""), 3000);
      setViewingAgent(null); 
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handlePaySingle = async (commissionId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Pay commission for this specific policy?")) return;
    setPayingPolicyId(commissionId);
    try {
      await apiPost(`/policies/commissions/admin/pay-policy/${commissionId}`, {});
      setToast("Policy paid successfully!");
      setTimeout(() => setToast(""), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setPayingPolicyId(null);
    }
  };

  const formatCurrency = (amt) => `₹${Number(amt || 0).toLocaleString("en-IN")}`;

  const openAgentModal = (summary, e) => {
    if (e) e.stopPropagation();
    setViewingAgent(summary);
    setModalVisibleCount(MODAL_PAGE_SIZE); 
    if (modalScrollRef.current) modalScrollRef.current.scrollTop = 0;
  };

  const totalPages = Math.max(1, Math.ceil(summaries.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedSummaries = useMemo(
    () => summaries.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [summaries, currentPage]
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const handleModalScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 50) {
      if (viewingAgent && modalVisibleCount < viewingAgent.pendingPolicies.length) {
        setModalVisibleCount((prev) => prev + MODAL_PAGE_SIZE);
      }
    }
  };

  return (
    <div className="policy-detail-fixed admin-commission-page"
    style={{ height: "calc(100vh - var(--navbar-height) - 2rem)", margin: 0 }}>
      <button
        onClick={handleBack}
        className="policy-detail-back"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 16, justifyContent: "left", textAlign: "left" }}
      >
        <FiArrowLeft /> Back
      </button>

      <h1 className="listing-title">
        <FaRupeeSign style={{ verticalAlign: "middle" }} /> Commission Payouts
      </h1>

      {isLoading ? (
        <p className="policy-section-empty">Loading agents...</p>
      ) : summaries.length === 0 ? (
        <p className="policy-section-empty">No agents have commission activity yet.</p>
      ) : (
        <>
          <section className="policy-section-client">
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {pagedSummaries.map((s) => {
                const allPolicies = s.pendingPolicies || [];
                const visiblePolicies = allPolicies.slice(0, RECENT_POLICIES_COUNT);
                const hasMore = allPolicies.length > RECENT_POLICIES_COUNT;

                return (
                  <li
                    key={s.agent._id}
                    onClick={(e) => openAgentModal(s, e)}
                    style={{ padding: 16, borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, cursor: "pointer", transition: "background 0.15s ease" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f9fafb")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <strong style={{ color: "#003366", fontSize: "1.05rem" }}>{s.agent.name}</strong>
                      <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: "2px 0 0" }}>
                        {s.agent.email} · {s.agent.role.replace(/_/g, " ")}
                      </p>
                      <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: "4px 0 0" }}>
                        <FiCheckCircle size={12} style={{ verticalAlign: "middle", color: "#16a34a" }} /> Lifetime Paid: <strong>{formatCurrency(s.totalPaid)}</strong>
                      </p>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: "0.7rem", textTransform: "uppercase", color: "#6b7280", margin: 0, fontWeight: 700 }}>Pending</p>
                        <p style={{ fontSize: "1.1rem", fontWeight: 700, color: s.pendingAmount > 0 ? "#b45309" : "#9ca3af", margin: 0 }}>
                          {formatCurrency(s.pendingAmount)}
                        </p>
                        <p style={{ fontSize: "0.7rem", color: "#6b7280", margin: 0 }}>across {s.pendingCount} policies</p>
                      </div>

                      <button
                        onClick={(e) => handlePayAll(s.agent._id, e)}
                        disabled={s.pendingAmount === 0 || processingId === s.agent._id}
                        className="submit-btn"
                        style={{ height: "fit-content", opacity: s.pendingAmount === 0 ? 0.5 : 1, cursor: s.pendingAmount === 0 ? "not-allowed" : "pointer" }}
                      >
                        {processingId === s.agent._id ? "Processing..." : "Pay Agent"}
                      </button>
                    </div>

                    {allPolicies.length > 0 && (
                      <div style={{ width: "100%", marginTop: 12, paddingTop: 12, borderTop: "1px dashed #e5e7eb" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <p style={{ fontSize: "0.7rem", textTransform: "uppercase", color: "#6b7280", margin: 0, fontWeight: 700 }}>
                            {hasMore ? "Recent Pending Policies" : `Pending Policies (${allPolicies.length})`}
                          </p>

                          {hasMore && (
                            <button
                              onClick={(e) => openAgentModal(s, e)}
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.8rem", fontWeight: 600, color: "#003366", background: "none", border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 4 }}
                            >
                              Show all ({allPolicies.length}) <FiChevronRight size={14} />
                            </button>
                          )}
                        </div>

                        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                          {visiblePolicies.map((p) => (
                            <li key={p._id} style={{ fontSize: "0.85rem", display: "flex", justifyContent: "space-between", color: "#4b5563" }}>
                              <span>• {p.policyName} <span style={{ color: "#9ca3af" }}>({p.clientName})</span></span>
                              <span>Approved by: <strong style={{ color: "#003366" }}>{p.approvedBy?.name || "Legacy Tech Agent"}</strong></span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {viewingAgent && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }} onClick={() => setViewingAgent(null)}>
          <div
            className="profile-card"
            style={{ width: "100%", maxWidth: "640px", margin: "20px", maxHeight: "90vh", overflowY: "auto", animation: "modalPopIn 0.25s ease-out", display: "flex", flexDirection: "column", padding: "0 24px 24px 24px" }}
            onClick={(e) => e.stopPropagation()}
            onScroll={handleModalScroll}
            ref={modalScrollRef}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #e5e7eb", paddingBottom: 15, marginBottom: 20, position: "sticky", top: 0, backgroundColor: "white", zIndex: 10, paddingTop: 10 }}>
              <div>
                <h2 style={{ margin: 0, color: "#003366" }}>{viewingAgent.agent.name}</h2>
                <span style={{ fontSize: "0.85rem", color: "#6b7280", textTransform: "capitalize" }}>
                  {viewingAgent.agent.email} · {viewingAgent.agent.role.replace(/_/g, " ")}
                </span>
              </div>
              
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button className="navbar-link-btn" onClick={() => setViewingAgent(null)} style={{background: "#003366", color: "white"}}>Close</button>
                <button
                  className="navbar-link-btn"
                  disabled={viewingAgent.pendingAmount === 0 || processingId === viewingAgent.agent._id}
                  onClick={(e) => handlePayAll(viewingAgent.agent._id, e)}
                  style={{ opacity: viewingAgent.pendingAmount === 0 ? 0.5 : 1, cursor: viewingAgent.pendingAmount === 0 ? "not-allowed" : "pointer", background: "#003366", color: "white" }}
                >
                  {processingId === viewingAgent.agent._id ? "Processing..." : "Pay Agent"}
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
              <div style={{ padding: 14, border: "1px solid #e5e7eb", borderRadius: 8, backgroundColor: "#f9fafb" }}>
                <div style={{ fontSize: "0.7rem", color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>Pending</div>
                <div style={{ fontSize: "1.15rem", fontWeight: 700, color: viewingAgent.pendingAmount > 0 ? "#b45309" : "#9ca3af", marginTop: 4 }}>
                  {formatCurrency(viewingAgent.pendingAmount)}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 2 }}>{viewingAgent.pendingCount} policies</div>
              </div>

              <div style={{ padding: 14, border: "1px solid #e5e7eb", borderRadius: 8, backgroundColor: "#f9fafb" }}>
                <div style={{ fontSize: "0.7rem", color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>Lifetime Paid</div>
                <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#16a34a", marginTop: 4 }}>{formatCurrency(viewingAgent.totalPaid)}</div>
                <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 2 }}>Total processed</div>
              </div>
            </div>

            <h3 style={{ fontSize: "0.95rem", color: "#003366", margin: "0 0 10px", fontWeight: 700 }}>
              Pending Policies ({viewingAgent.pendingPolicies?.length || 0})
            </h3>

            {(!viewingAgent.pendingPolicies || viewingAgent.pendingPolicies.length === 0) ? (
              <p style={{ fontSize: "0.9rem", color: "#6b7280", fontStyle: "italic", margin: 0 }}>No pending policies for this agent.</p>
            ) : (
              <>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, borderTop: "1px solid #e5e7eb" }}>
                  {viewingAgent.pendingPolicies.slice(0, modalVisibleCount).map((p) => (
                    <li key={p._id} style={{ padding: "10px 0", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ minWidth: 200 }}>
                        <div style={{ fontWeight: 600, color: "#1f2937", fontSize: "0.9rem" }}>{p.policyName}</div>
                        <div style={{ fontSize: "0.78rem", color: "#6b7280", marginTop: 2 }}>Client: {p.clientName}</div>
                      </div>
                      <div style={{ textAlign: "right", minWidth: 140, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                        <div>
                          <div style={{ fontSize: "0.72rem", color: "#9ca3af" }}>
                            {p.rateApplied || 15}% of ₹{Number(p.premiumAmount || 0).toLocaleString("en-IN")}
                          </div>
                          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#b45309", marginTop: 2 }}>
                            {formatCurrency(p.commissionAmount)}
                          </div>
                          <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: 2 }}>
                            Approved by: {p.approvedBy?.name || "Legacy Tech Agent"}
                          </div>
                        </div>
                        
                        <button
                          className="submit-btn"
                          onClick={(e) => handlePaySingle(p._id, e)}
                          disabled={payingPolicyId === p._id}
                          style={{ padding: "4px 10px", fontSize: "0.75rem", height: "fit-content", opacity: payingPolicyId === p._id ? 0.6 : 1, cursor: payingPolicyId === p._id ? "not-allowed" : "pointer" }}
                        >
                          {payingPolicyId === p._id ? "Paying..." : "Pay"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                {modalVisibleCount < viewingAgent.pendingPolicies.length && (
                  <div style={{ textAlign: "center", padding: "15px 0", color: "#6b7280", fontSize: "0.9rem" }}>
                    Loading more policies...
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {toast && <div className="profile-toast">{toast}</div>}
    </div>
  );
}