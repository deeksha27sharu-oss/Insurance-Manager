import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { getPolicyLogo } from "../utils/companyLogos";
import { useAuth } from "../context/AuthContext";
import { getPolicyFaqs } from "../data/policyExtras";
import { IoIosArrowDropdown } from "react-icons/io";
import { useChatPanel } from "../context/ChatPanelContext";
import { apiGet, apiPost } from "../api/client";
import { FiArrowLeft, FiX, FiTrash2, FiPlus, FiChevronDown, FiFileText, FiInfo, FiChevronUp } from "react-icons/fi";
import { useSocketEvent } from "../hooks/useSocketEvents";

const RELATION_OPTIONS = ["Spouse", "Father", "Mother", "Son", "Daughter", "Sister", "Friend", "Others"];

function CustomSelect({ value, options, onChange }) {
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

  return (
    <div className="custom-select-container" ref={dropdownRef} style={{ position: "relative" }}>
      <button
        type="button" onClick={() => setIsOpen(!isOpen)} className="profile-input"
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", cursor: "pointer", background: "#f9fafb", paddingRight: "10px", minHeight: "38px" }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
        <FiChevronDown style={{ flexShrink: 0, transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>
      {isOpen && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: "4px", backgroundColor: "#fff", border: "1px solid #cbd5e1", borderRadius: "6px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", zIndex: 3000, maxHeight: "90px", overflowY: "auto" }}>
          {options.map((opt) => (
            <div key={opt} onClick={() => { onChange(opt); setIsOpen(false); }}
              style={{ padding: "10px 12px", cursor: "pointer", fontSize: "0.9rem", backgroundColor: value === opt ? "#f0f4f9" : "transparent", color: value === opt ? "#003366" : "#1f2937", fontWeight: value === opt ? "600" : "normal", borderBottom: "1px solid #f3f4f6" }}
              onMouseEnter={(e) => (e.target.style.backgroundColor = "#f3f4f6")}
              onMouseLeave={(e) => (e.target.style.backgroundColor = value === opt ? "#f0f4f9" : "transparent")}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
    
export default function PolicyDetailPage() {
  const { policyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation(); 
  const { role } = useAuth();
  const { openChat } = useChatPanel();

  const [policy, setPolicy] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [showBuyModal, setShowBuyModal] = useState(false);
  const [nominees, setNominees] = useState([{ name: "", relation: "Relation" }]);
  const [isBuying, setIsBuying] = useState(false);
  const [buyError, setBuyError] = useState("");

  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");

  const [isScrolled, setIsScrolled] = useState(false);
  const [showAllFacts, setShowAllFacts] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const safeText = (val) => {
    if (val === null || val === undefined) return "";
    if (typeof val === "object") return val.name || val.text || JSON.stringify(val);
    return val;
  };

  const fetchPolicy = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      let dbPolicy = null;
      try {
        const res = await apiGet(`/policies/${policyId}`);
        dbPolicy = res.policy;
      } catch (err) {
        if (policyId.length > 8) {
           const extRes = await apiGet(`/external/policies/${policyId}`);
           setPolicy(extRes.policy);
           setError("");
           return;
        } else {
           throw err;
        }
      }

      if (dbPolicy && dbPolicy.isExternal) {
        try {
          const apiRes = await apiGet(`/external/policies/${policyId}`);
          const apiDetails = apiRes.policy;

          setPolicy({
            ...apiDetails,
            id: dbPolicy.id,
            premium: dbPolicy.premium,
            premiumValue: dbPolicy.premiumValue,
            coverage: dbPolicy.coverage,
            coverageValue: dbPolicy.coverageValue,
            logo: dbPolicy.logo || "",
            isExternal: true,
          });
          setError("");
          return;
        } catch (apiErr) {
          console.warn("Failed to fetch API details, showing DB only", apiErr);
        }
      }

      setPolicy(dbPolicy);
      setError("");
    } catch (err) {
      setError(err.message || "Policy not found");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [policyId]);

  useEffect(() => {
    async function fetchAgentsAndProfile() {
      try {
        const [agentsRes, profileRes] = await Promise.all([
          apiGet("/auth/public-agents"),
          role ? apiGet("/auth/me") : Promise.resolve({ customer: null })
        ]);
        setAgents(agentsRes.agents || []);
        if (profileRes.customer?.assigned_agent_id) {
           const agentId = profileRes.customer.assigned_agent_id._id || profileRes.customer.assigned_agent_id;
           setSelectedAgentId(agentId);
        }
      } catch (err) {
        console.error("Failed to load agents/profile", err);
      }
    }
    fetchPolicy();
    if (role === "user") {
      fetchAgentsAndProfile();
    }
  }, [fetchPolicy, role]);

  useSocketEvent("policies:update", () => {
    fetchPolicy(true);
  });

  const handleBuy = async (e) => {
    e.preventDefault();
    setBuyError("");
    if (!role) { navigate("/login"); return; }
    const missingRelation = nominees.some(n => !n.relation);
    if (missingRelation) return setBuyError("Please select a relation for all nominees.");

    setIsBuying(true);
    try {
      await apiPost("/policies/buy", { policyId, nominees, agentId: selectedAgentId || undefined });
      alert("Policy under review");
      setShowBuyModal(false);
      navigate("/home");
    } catch (err) {
      setBuyError(err.message || "Failed to buy policy.");
    } finally {
      setIsBuying(false);
    }
  };

  const handleNomineeChange = (index, field, value) => {
    const newNominees = [...nominees];
    newNominees[index][field] = value;
    setNominees(newNominees);
  };

  const addNominee = () => {
    if (nominees.length >= 3) return;
    setNominees([...nominees, { name: "", relation: "Relation" }]);
  };

  const removeNominee = (index) => {
    const newNominees = nominees.filter((_, i) => i !== index);
    setNominees(newNominees);
  }

  if (isLoading) return <div className="policy-detail">Loading policy details...</div>;
  if (error || !policy) {
    return (
      <div className="policy-detail">
        <h1>Policy not found</h1>
        <p>{error}</p>
        <Link to={role ? "/home" : "/"} className="policy-detail-back"><FiArrowLeft />Back to plans</Link>
      </div>
    );
  }

  const logoSrc = getPolicyLogo(policy);
  const faqs = policy.isExternal ? [] : getPolicyFaqs(policy);

  return (
    <div className="policy-detail">
      <Link 
        to={role ? "/home" : "/"} 
        state={{ page: location.state?.page }} 
        className="policy-detail-back"
      >
        <FiArrowLeft /> Back to plans
      </Link>

      <header 
        className="policy-detail-header" 
        style={{ 
          position: "sticky", top: "var(--navbar-height)", zIndex: 10, backgroundColor: "var(--color-surface)", 
          boxShadow: isScrolled ? "0 4px 6px -1px rgba(0,0,0,0.1)" : "none",
          borderBottom: "1px solid #e5e7eb", flexWrap: "wrap", gap: isScrolled ? "12px" : "16px",
          padding: isScrolled ? "8px 16px" : "24px", transition: "all 0.3s ease",
          margin: isScrolled ? "0 -16px" : "0", borderRadius: isScrolled ? "0" : "12px"
        }}
      >
        {logoSrc && !isScrolled && (
          <div className="policy-detail-logo-container" style={{ width: "96px", height: "96px", transition: "all 0.3s ease" }}>
            <img src={logoSrc} alt={`${safeText(policy.name)} logo`} className="policy-detail-logo" />
          </div>
        )}
        
        <div className="policy-detail-header-text" style={{ flex: 1 }}>
          <span className="policy-detail-category" style={{ fontSize: isScrolled ? "0.7rem" : "0.8rem", transition: "all 0.3s ease" }}>
            {safeText(policy.category)}
          </span>
          <h1 className="policy-detail-name" style={{ margin: "4px 0", fontSize: isScrolled ? "1.2rem" : "1.8rem", transition: "all 0.3s ease" }}>
            {safeText(policy.name)}
          </h1>
          {!isScrolled && policy.tagline && (
            <p className="policy-detail-tagline" style={{ margin: 0 }}>{safeText(policy.tagline)}</p>
          )}
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexShrink: 0 }}>
          {role === "user" && (
            <>
              <button type="button" className="policy-detail-btn policy-detail-btn-primary" onClick={() => setShowBuyModal(true)} style={{ backgroundColor: "#16a34a", borderColor: "#16a34a", padding: isScrolled ? "8px 16px" : "10px 20px", fontWeight: 600, borderRadius: 8, fontSize: isScrolled ? "0.85rem" : "1rem", transition: "all 0.3s ease" }}>
                Buy this policy
              </button>
              <button type="button" className="policy-detail-btn policy-detail-btn-primary" onClick={openChat} style={{ padding: isScrolled ? "8px 16px" : "10px 20px", fontWeight: 600, borderRadius: 8, fontSize: isScrolled ? "0.85rem" : "1rem", transition: "all 0.3s ease" }}>
                Ask more
              </button>
            </>
          )}
          {(role === "captive_agent" || role === "independent_agent" || role === "super_agent") && (
            <button type="button" className="policy-detail-btn policy-detail-btn-primary" onClick={openChat} style={{ padding: isScrolled ? "8px 16px" : "10px 20px", fontWeight: 600, borderRadius: 8, fontSize: isScrolled ? "0.85rem" : "1rem", transition: "all 0.3s ease" }}>
              Clients Queries
            </button>
          )}
        </div>
      </header>

      <section className="policy-section-plan" style={{ marginTop: "16px" }}>
        
        {policy.description && (
          <section className="policy-detail-section">
            <h2>About this plan</h2>
            <p>{safeText(policy.description)}</p>
          </section>
        )}

        {(policy.coverage || policy.premium) && (
          <section className="policy-detail-section">
            <h2>Key numbers</h2>
            <div className="policy-detail-stats">
              {policy.coverage && (
                <div className="policy-detail-stat">
                  <span className="policy-detail-stat-label">Coverage</span>
                  <span className="policy-detail-stat-value">{safeText(policy.coverage)}</span>
                </div>
              )}
              {policy.premium && (
                <div className="policy-detail-stat">
                  <span className="policy-detail-stat-label">Premium</span>
                  <span className="policy-detail-stat-value">{safeText(policy.premium)}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {policy.isExternal && policy.externalFacts && policy.externalFacts.length > 0 && (
          <section className="policy-detail-section">
            <h2 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FiFileText color="#003366" /> Policy Clauses & Details
            </h2>
            
            {showAllFacts && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
                {policy.externalFacts.map((fact, i) => (
                  <div key={i} style={{ padding: "16px", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "6px" }}>
                      <FiInfo style={{ color: "#6b7280", marginTop: "3px", flexShrink: 0 }} />
                      <div style={{ fontWeight: 600, color: "#1f2937", fontSize: "0.95rem", textTransform: "capitalize" }}>
                        {fact.key ? fact.key.replace(/_/g, " ") : "Detail"}
                      </div>
                    </div>
                    <div style={{ paddingLeft: "24px", fontSize: "0.95rem", color: "#4b5563", lineHeight: 1.5 }}>
                      {safeText(fact.value)}
                    </div>
                    {fact.quote && (
                      <div style={{ marginTop: "12px", marginLeft: "24px", padding: "12px", backgroundColor: "#f8fafc", borderLeft: "3px solid #003366", borderRadius: "0 4px 4px 0", fontSize: "0.85rem", color: "#4b5563", fontStyle: "italic" }}>
                        "{fact.quote}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <button
                onClick={() => setShowAllFacts(!showAllFacts)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  background: "#003366", color: "white", padding: "10px 20px",
                  borderRadius: "8px", fontWeight: "600", cursor: "pointer", border: "none",
                  transition: "all 0.2s ease"
                }}
              >
                {showAllFacts ? (
                  <> <FiChevronUp /> Hide Policy Details </>
                ) : (
                  <> <FiChevronDown /> View More Details of this Policy </>
                )}
              </button>
            </div>
          </section>
        )}

        {!policy.isExternal && policy.keyFeatures?.length > 0 && (
          <section className="policy-detail-section">
            <h2>Key features</h2>
            <ul className="policy-detail-features">
              {policy.keyFeatures.map((f, i) => <li key={i}>{safeText(f)}</li>)}
            </ul>
          </section>
        )}

        {!policy.isExternal && policy.eligibility && (
          <section className="policy-detail-section">
            <h2>Eligibility</h2>
            <p>{safeText(policy.eligibility)}</p>
          </section>
        )}
      </section>

      {!policy.isExternal && (
        <section className="policy-section-plans">
          <h2 className="policy-section-title">Frequently Asked Questions</h2>
          {faqs.length === 0 ? (
            <p className="policy-section-empty">No FAQs available for this policy yet.</p>
          ) : (
            <div className="policy-faq-list">
              {faqs.map((faq, i) => (
                <details key={i} className="policy-faq-item">
                  <summary className="policy-faq-question">
                    <IoIosArrowDropdown className="policy-faq-icon" />
                    <span>{safeText(faq.q)}</span>
                  </summary>
                  <p className="policy-faq-answer"><span>{safeText(faq.a)}</span></p>
                </details>
              ))}
            </div>
          )}
        </section>
      )}

      {showBuyModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000, padding: "20px", overflow: "auto" }}>
          <div className="profile-card" style={{ width: "100%", maxWidth: "550px", margin: "auto", animation: "modalPopIn 0.25s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <h2 className="profile-card-title" style={{ margin: 0 }}>Confirm Purchase</h2>
              <button onClick={() => setShowBuyModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}><FiX size={20} /></button>
            </div>
            <p style={{ marginBottom: "20px", color: "#6b7280" }}>
              You are buying <strong>{safeText(policy.name)}</strong> for <strong>{safeText(policy.premium)}</strong>.
            </p>
            <form onSubmit={handleBuy}>
              <div style={{ marginBottom: "20px" }}>
                <label className="login-label" style={{ display: "block", marginBottom: "8px" }}>Select an Agent</label>
                <select className="profile-input" style={{ width: "100%", padding: "10px" }} value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)}>
                  <option value="">Auto-Assign Best Available Agent</option>
                  {agents.map(a => <option key={a._id} value={a._id}>{a.name} ({a.role.replace(/_/g, " ")})</option>)}
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", borderTop: "1px solid #e5e7eb", paddingTop: "15px" }}>
                <h3 style={{ fontSize: "1rem", color: "#003366", margin: 0 }}>Add Nominees (Max 3)</h3>
                <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>{nominees.length}/3 Added</span>
              </div>
              {nominees.map((n, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 40px", gap: "10px", marginBottom: "10px", alignItems: "center" }}>
                  <input className="profile-input" placeholder="Full Name" value={n.name} maxLength={30} required onChange={(e) => handleNomineeChange(i, "name", e.target.value)} />
                  <CustomSelect value={n.relation} options={RELATION_OPTIONS} onChange={(val) => handleNomineeChange(i, "relation", val)} />
                  {nominees.length > 1 ? (
                    <button type="button" onClick={() => removeNominee(i)} style={{ color: "#b91c1c", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "center" }}><FiTrash2 size={18} /></button>
                  ) : (<div />)}
                </div>
              ))}
              {nominees.length < 3 && (
                <button type="button" onClick={addNominee} style={{ fontSize: "0.85rem", color: "#003366", marginBottom: "20px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "5px", background: "none", border: "none", cursor: "pointer" }}>
                  <FiPlus /> Add another nominee
                </button>
              )}
              {buyError && <p className="login-error" style={{ marginBottom: "15px" }}>{buyError}</p>}
              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button type="button" onClick={() => setShowBuyModal(false)} className="navbar-link-btn" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="submit-btn" style={{ flex: 1 }} disabled={isBuying}>{isBuying ? "Processing..." : "Confirm & Pay"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}