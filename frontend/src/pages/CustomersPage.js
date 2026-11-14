import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiGet, apiPost, apiPut, apiDelete } from "../api/client.js";
import { FiEdit2, FiTrash2, FiX, FiCheck, FiRefreshCw, FiUserPlus, FiEye, FiEyeOff, FiActivity, FiArrowLeft, FiPhone, FiMapPin, FiBriefcase, FiFileText } from "react-icons/fi";
import { useAuth } from "../context/AuthContext.js";
import { useChatPanel } from "../context/ChatPanelContext.js";
import { useSocketEvent } from "../hooks/useSocketEvents";
import Pagination from "../components/common/Pagination.js";

const initialCreateForm = { name: "", email: "", phone: "", city: "", age: "", password: "", assigned_agent_id: "" };
const PAGE_SIZE = 10;

export default function CustomersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();
  const { openChat } = useChatPanel();
  
  const [customers, setCustomers] = useState([]);
  const [agents, setAgents] = useState([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [viewingClaimsFor, setViewingClaimsFor] = useState(null);
  const [clientClaims, setClientClaims] = useState([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimsError, setClaimsError] = useState("");

  const [viewingClientDetails, setViewingClientDetails] = useState(null);
  const [clientPolicies, setClientPolicies] = useState([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policiesError, setPoliciesError] = useState("");

  const [page, setPage] = useState(1);
  const fetchedOnce = useRef(false);

  const isTechOrRel = role === "technical_agent" || role === "relationship_agent";
  const gridCols = isTechOrRel 
    ? "1.2fr 1.6fr 1fr 0.8fr 0.6fr 1.2fr 100px" 
    : "60px 1.2fr 1.6fr 1fr 0.8fr 0.6fr 1.2fr 100px";

  const handleBack = () => {
    if (location.key !== "default") navigate(-1);
    else navigate("/home");
  };

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await apiGet("/customers");
      setCustomers(data.customers || []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadAgents = useCallback(async () => {
    if (role === "admin") {
      try {
        const res = await apiGet("/auth/agents");
        const realAgents = (res.agents || []).filter((a) => a.email !== "direct@insurance.com");
        setAgents(realAgents);
      } catch (err) {
        console.error("Failed to load agents", err);
      }
    }
  }, [role]);

  useEffect(() => {
    if (fetchedOnce.current) return;
    fetchedOnce.current = true;
    loadCustomers();
    loadAgents();
  }, [loadCustomers, loadAgents]);

  useSocketEvent("customers:update", () => {
    console.log("Live customer update received!");
    loadCustomers();
  });

  const handleCreateChange = (e) => {
    const { name, value } = e.target;
    let nextValue = value;
    if (name === "phone") nextValue = value.replace(/\D/g, "").slice(0, 10);
    if (name === "age") nextValue = value.replace(/\D/g, "").slice(0, 3);
    setCreateForm((prev) => ({ ...prev, [name]: nextValue }));
    if (createError) setCreateError("");
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateError("");

    if (createForm.name.trim().length < 5) return setCreateError("Name must be at least 5 characters.");
    if (!/^\S+@\S+\.\S+$/.test(createForm.email.trim())) return setCreateError("Invalid email format.");
    if (!/^[6-9]\d{9}$/.test(createForm.phone.trim())) return setCreateError("Enter a valid 10-digit mobile number.");
    if (createForm.password.length < 8) return setCreateError("Password must be at least 8 characters.");
    if (!/[A-Z]/.test(createForm.password)) return setCreateError("Password needs an uppercase letter.");
    if (!/[a-z]/.test(createForm.password)) return setCreateError("Password needs a lowercase letter.");
    if (!/\d/.test(createForm.password)) return setCreateError("Password needs a number.");
    if (!/[@.#$!%*?&]/.test(createForm.password)) return setCreateError("Password needs a special character.");

    setIsCreating(true);
    try {
      await apiPost("/customers", {
        name: createForm.name.trim(),
        email: createForm.email.trim().toLowerCase(),
        phone: createForm.phone.trim(),
        password: createForm.password,
        city: createForm.city.trim(),
        age: createForm.age ? Number(createForm.age) : null,
        assigned_agent_id: createForm.assigned_agent_id || undefined,
      });
      
      setToast("Client added successfully!");
      setTimeout(() => setToast(""), 3000);
      setShowCreateForm(false);
      setCreateForm(initialCreateForm);
    } catch (err) {
      setCreateError(err.message || "Failed to add client.");
    } finally {
      setIsCreating(false);
    }
  };

  function startEdit(customer, e) {
    if (e) e.stopPropagation();
    setEditingId(customer._id);
    setEditError("");
    setDraft({
      name: customer.name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      city: customer.city || "",
      age: customer.age ?? "",
      assigned_agent_id: customer.assigned_agent_id?._id || "", 
    });
  }

  function cancelEdit(e) {
    if (e) e.stopPropagation();
    setEditingId(null);
    setDraft({});
    setEditError("");
  }

  function handleDraftChange(e) {
    const { name, value } = e.target;
    let nextValue = value;
    if (name === "phone") nextValue = value.replace(/\D/g, "").slice(0, 10);
    setDraft((prev) => ({ ...prev, [name]: nextValue }));
  }

  async function saveEdit(e) {
    if (e) e.stopPropagation();
    if (!editingId) return;

    if (draft.name.trim().length < 5) return setEditError("Name too short.");
    if (!/^\S+@\S+\.\S+$/.test(draft.email.trim())) return setEditError("Invalid email.");
    if (!/^[6-9]\d{9}$/.test(draft.phone.trim())) return setEditError("Invalid 10-digit phone.");

    setIsSaving(true);
    setEditError("");
    try {
      const payload = {
        name: draft.name.trim(),
        email: draft.email.trim().toLowerCase(),
        phone: draft.phone.trim(),
        city: draft.city.trim(),
        age: draft.age === "" ? null : Number(draft.age),
        assigned_agent_id: draft.assigned_agent_id,
      };
      await apiPut(`/customers/${editingId}`, payload);
      
      setToast("Client updated");
      setTimeout(() => setToast(""), 2000);
      cancelEdit();
    } catch (err) {
      setEditError(err.message || "Update failed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(customer, e) {
    if (e) e.stopPropagation();
    const ok = window.confirm(`Delete "${customer.name}"? This cannot be undone.`);
    if (!ok) return;

    setDeletingId(customer._id);
    try {
      await apiDelete(`/customers/${customer._id}`);
      setToast("Client deleted");
      setTimeout(() => setToast(""), 2000);
    } catch (err) {
      alert("Delete failed: " + err.message);
    } finally {
      setDeletingId(null);
    }
  }

  const handleViewClientDetails = async (client, e) => {
    if (e) e.stopPropagation();
    setViewingClientDetails(client);
    setClientPolicies([]);
    setPoliciesError("");
    setPoliciesLoading(true);

    try {
      const res = await apiGet(`/customers/${client._id}/policies`);
      const allPolicies = res.policies || [];
      const visiblePolicies = allPolicies.filter(p => p.workflowStage !== "Rejected");
      
      setClientPolicies(visiblePolicies);
    } catch (err) {
      console.error("Failed to load client policies", err);
      setPoliciesError("Failed to load policies.");
    } finally {
      setPoliciesLoading(false);
    }
  };

  const handleViewClaims = async (client, e) => {
    if (e) e.stopPropagation();
    setViewingClaimsFor(client);
    setClientClaims([]);
    setClaimsError("");
    setClaimsLoading(true);
    try {
      const res = await apiGet(`/customers/${client._id}/claims`);
      setClientClaims(res.claims || []);
    } catch (err) {
      console.error("Failed to load claims", err);
      setClaimsError(err.message || "Failed to load claims.");
    } finally {
      setClaimsLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedCustomers = customers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <div className="policy-detail-fixed" 
      style={{
      display: "flex",
      flexDirection: "column",
      height: "calc(100vh - var(--navbar-height) - 32px)",
      paddingBottom: 16,
      overflow: "hidden",
    }}>
      <button
        onClick={handleBack}
        className="policy-detail-back"
        style={{
          background: "none", border: "none", cursor: "pointer", padding: 0,
          marginBottom: 12, display: "inline-flex", alignItems: "center",
          gap: 6, color: "#003366", fontWeight: 500,
        }}
      >
        <FiArrowLeft /> Back
      </button>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12, flexShrink: 0 }}>
        <h1 className="listing-title" style={{ margin: 0 }}>
          {role === "admin" ? "All Customers" : 
          role === "independent_agent" ? "My Independent Clients" : 
          role === "super_agent" ? "My Team's Clients" : 
          role === "technical_agent" || role === "relationship_agent" ? "My Team's Clients" :
          "My Assigned Clients"} 
          <span className="policy-section-count">({customers.length})</span>
        </h1>

        <div style={{ display: "flex", gap: "12px" }}>
          <button className="navbar-link-btn" onClick={loadCustomers} disabled={isLoading}>
            <FiRefreshCw /> {isLoading ? "Loading..." : "Refresh"}
          </button>
          {["admin", "super_agent", "captive_agent", "independent_agent"].includes(role) && (
            <button className="submit-btn" onClick={() => setShowCreateForm(true)}>
              <FiUserPlus style={{ marginRight: 6, verticalAlign: "middle" }} />
              Add New Client
            </button>
          )}
        </div>
      </div>

      {error && <p className="login-error">{error}</p>}
      {customers.length === 0 && !isLoading && <p className="policy-section-empty">No customers yet.</p>}

      {customers.length > 0 && (
        <>
        <section className="policy-section-client">
          <div className="all-clients-table">
            <div className="allClients-table-head" style={{
                fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.06em", color: "#666666", borderBottom: "1px solid #e5e7eb",
                position: "sticky", top: 0, backgroundColor: "#ffffff", zIndex: 2,
                display: "grid", gridTemplateColumns: gridCols,
                gap: "12px", alignItems: "center", paddingTop: "15px", marginTop: 0,
            }}>
              {!isTechOrRel && <span>Actions</span>}
              <span>Name</span>
              <span>Email</span>
              <span>Phone</span>
              <span>City</span>
              <span>Age</span>
              <span>Agent</span>
              <span>Claims</span>
            </div>

            <ul className="all-clients-table-body" style={{ listStyle: "none", padding: "0 3px", margin: 0 }}>
              {pagedCustomers.map((c) => {
                const isEditing = editingId === c._id;

                return (
                  <li 
                    key={c._id} 
                    className="all-clients-row" 
                    style={{ gridTemplateColumns: gridCols, cursor: "pointer" }}
                    onClick={(e) => handleViewClientDetails(c, e)}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f9fafb"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    {!isTechOrRel && (
                      <div style={{ display: "flex", gap: 6 }}>
                        {isEditing ? (
                          <>
                            <button title="Save" onClick={saveEdit} disabled={isSaving} style={{ color: "#16a34a", padding: 6, borderRadius: 4 }}><FiCheck /></button>
                            <button title="Cancel" onClick={cancelEdit} disabled={isSaving} style={{ color: "#6b7280", padding: 6, borderRadius: 4 }}><FiX /></button>
                          </>
                        ) : (
                          <>
                            <button title="Edit" onClick={(e) => startEdit(c, e)} style={{ color: "#003366", padding: 6, borderRadius: 4 }}><FiEdit2 /></button>
                            <button title="Delete" onClick={(e) => handleDelete(c, e)} disabled={deletingId === c._id} style={{ color: "#b91c1c", padding: 6, borderRadius: 4 }}><FiTrash2 /></button>
                          </>
                        )}
                      </div>
                    )}

                    {isEditing ? (
                      <>
                        <input name="name" value={draft.name} onChange={handleDraftChange} onClick={(e)=>e.stopPropagation()} className="profile-input" style={{ width: "100%", padding: "4px 6px" }} />
                        <input name="email" value={draft.email} onChange={handleDraftChange} onClick={(e)=>e.stopPropagation()} className="profile-input" style={{ width: "100%", padding: "4px 6px" }} />
                        <input name="phone" type="tel" maxLength={10} value={draft.phone} onChange={handleDraftChange} onClick={(e)=>e.stopPropagation()} className="profile-input" style={{ width: "100%", padding: "4px 6px" }} />
                        <input name="city" value={draft.city} onChange={handleDraftChange} onClick={(e)=>e.stopPropagation()} className="profile-input" style={{ width: "100%", padding: "4px 6px" }} />
                        <input name="age" type="number" value={draft.age} onChange={handleDraftChange} onClick={(e)=>e.stopPropagation()} className="profile-input" style={{ width: "100%", padding: "4px 6px" }} />
                        
                        {role === "admin" ? (
                          <select name="assigned_agent_id" value={draft.assigned_agent_id} onChange={handleDraftChange} onClick={(e)=>e.stopPropagation()} className="profile-input" style={{ width: "100%", padding: "4px 6px" }}>
                            <option value="">Unassigned</option>
                            {agents.map((a) => (
                              <option key={a._id} value={a._id}>{a.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="all-clients-sno">{c.assigned_agent_id?.name || "—"}</span>
                        )}
                        <span className="all-clients-sno">—</span>

                        {editError && <span style={{ gridColumn: "1 / -1", color: "red", fontSize: "0.8rem", marginTop: "4px" }}>{editError}</span>}
                      </>
                    ) : (
                      <>
                        <span className="all-clients-name">{c.name}</span>
                        <span className="all-clients-email">{c.email || "—"}</span>
                        <span className="all-clients-email">{c.phone || "—"}</span>
                        <span className="all-clients-policy">{c.city || "—"}</span>
                        <span className="all-clients-sno">{c.age ?? "—"}</span>
                        <span className="all-clients-policy" style={{ color: "#003366", fontWeight: "600" }}>
                          {c.assigned_agent_id?.name || "Unassigned"}
                        </span>
                        
                        <button 
                          onClick={(e) => handleViewClaims(c, e)}
                          style={{ background: "none", textAlign: "center", justifyContent: "center", border: "1px solid #003366", color: "#003366", padding: "4px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                        >
                          View
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </>
      )}

      {showCreateForm && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
          <div className="profile-card" style={{ width: "100%", maxWidth: "600px", margin: "20px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "10px", marginBottom: "15px" }}>
              <h2 className="profile-card-title" style={{ margin: 0 }}>Add New Client</h2>
              <button onClick={() => setShowCreateForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}><FiX size={20} /></button>
            </div>
            
            <form onSubmit={handleCreateSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
              <div className="login-field"><label className="login-label">Full Name</label><input className="login-input" name="name" value={createForm.name} onChange={handleCreateChange} required /></div>
              <div className="login-field"><label className="login-label">Email</label><input type="email" className="login-input" name="email" value={createForm.email} onChange={handleCreateChange} required /></div>
              <div className="login-field"><label className="login-label">Phone</label><input className="login-input" name="phone" type="tel" maxLength={10} value={createForm.phone} onChange={handleCreateChange} required /></div>
              <div className="login-field"><label className="login-label">City</label><input className="login-input" name="city" value={createForm.city} onChange={handleCreateChange} /></div>
              <div className="login-field"><label className="login-label">Age</label><input className="login-input" name="age" type="number" value={createForm.age} onChange={handleCreateChange} /></div>
              
              {role === "admin" && (
                <div className="login-field" style={{gridColumn: "1 / -1"}}>
                  <label className="login-label">Assign to Agent</label>
                  <select className="login-input" name="assigned_agent_id" value={createForm.assigned_agent_id || ""} onChange={handleCreateChange}>
                    <option value="">Unassigned</option>
                    {agents.map(a => <option key={a._id} value={a._id}>{a.name} ({a.role.replace(/_/g, " ")})</option>)}
                  </select>
                </div>
              )}

              <div className="login-field" style={{ gridColumn: "1 / -1" }}>
                <label className="login-label">Account Password</label>
                <div className="login-input-wrap" style={{ position: "relative" }}>
                  <input type={showPassword ? "text" : "password"} className="login-input" name="password" value={createForm.password} onChange={handleCreateChange} required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: "12px", background: "none", border: "none", cursor: "pointer" }}>
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                {createError && <p className="login-error" style={{ marginBottom: "10px" }}>{createError}</p>}
                <button type="submit" className="submit-btn" disabled={isCreating} style={{ width: "100%" }}>{isCreating ? "Creating..." : "Add Client"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingClientDetails && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }} onClick={() => setViewingClientDetails(null)}>
          <div className="profile-card" style={{ width: "100%", maxWidth: "650px", margin: "20px", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "15px", marginBottom: "20px" }}>
              <div>
                <h2 className="profile-card-title" style={{ margin: 0, color: "#003366" }}>{viewingClientDetails.name}</h2>
                <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>{viewingClientDetails.email}</span>
              </div>
              <button onClick={() => setViewingClientDetails(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
                <FiX size={24} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <FiPhone color="#003366" size={18} />
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 600 }}>Phone</div>
                  <div style={{ fontWeight: 600 }}>{viewingClientDetails.phone || "—"}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <FiMapPin color="#003366" size={18} />
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 600 }}>City / Age</div>
                  <div style={{ fontWeight: 600 }}>{viewingClientDetails.city || "—"} · {viewingClientDetails.age || "—"} yrs</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, gridColumn: "1 / -1" }}>
                <FiBriefcase color="#003366" size={18} />
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 600 }}>Assigned Agent</div>
                  <div style={{ fontWeight: 600 }}>{viewingClientDetails.assigned_agent_id?.name || "Unassigned"}</div>
                </div>
              </div>
            </div>

            <h3 style={{ fontSize: "1rem", color: "#003366", marginBottom: "15px", paddingTop: "15px", borderTop: "1px solid #e5e7eb" }}>
              <FiFileText style={{ verticalAlign: "middle", marginRight: "6px" }} /> Active Policies
            </h3>

            {policiesLoading ? (
              <p style={{ fontSize: "0.9rem", color: "#6b7280" }}>Loading policies...</p>
            ) : policiesError ? (
              <p style={{ fontSize: "0.9rem", color: "#b91c1c" }}>{policiesError}</p>
            ) : clientPolicies.length === 0 ? (
              <p style={{ fontSize: "0.9rem", color: "#6b7280", fontStyle: "italic" }}>No active policies found.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {clientPolicies.map(p => (
                  <li key={p._id} style={{ padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
                    <div style={{ fontWeight: 600, color: "#1f2937" }}>{p.policyName}</div>
                    <div style={{ fontSize: "0.8rem", color: "#003366", marginTop: "2px" }}>
                      Sales Agent: {p.sales_agent_id?.name || "Direct / Unassigned"}
                      {p.sales_agent_id && <span style={{ color: "#003366" }}> ({p.sales_agent_id._id.slice(-6).toUpperCase()})</span>}
                    </div>
                    {p.assigned_relationship_agent_id && (
                      <div style={{ fontSize: "0.8rem", color: "#003366", marginTop: "2px" }}>
                        Relationship Agent: {p.assigned_relationship_agent_id.name}
                        <span style={{ color: "#003366" }}> ({p.assigned_relationship_agent_id._id.slice(-6).toUpperCase()})</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div style={{ marginTop: "25px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button 
                className="submit-btn" 
                onClick={() => {
                  openChat(null, viewingClientDetails._id, true, viewingClientDetails.name);
                  setViewingClientDetails(null);
                }}
              >
                Chat
              </button>
              <button className="navbar-link-btn" style={{background: "#003366", color: "white"}} onClick={() => setViewingClientDetails(null)}>Close Details</button>
            </div>
          </div>
        </div>
      )}

      {viewingClaimsFor && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }} onClick={() => setViewingClaimsFor(null)}>
          <div className="profile-card" style={{ width: "100%", maxWidth: "600px", margin: "20px", maxHeight: "80vh", overflowY: "auto", animation: "modalPopIn 0.25s ease-out" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "10px", marginBottom: "15px" }}>
              <div>
                <h2 className="profile-card-title" style={{ margin: 0 }}>Claims for {viewingClaimsFor.name}</h2>
                <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>{viewingClaimsFor.email}</span>
              </div>
                <button onClick={() => setViewingClaimsFor(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
                  <FiX size={20} />
                </button>
              </div>
      
              {claimsLoading ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Loading claims...</div>
              ) : claimsError ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#b91c1c" }}>{claimsError}</div>
              ) : clientClaims.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
                  <FiActivity size={32} style={{ marginBottom: "12px", opacity: 0.5 }} />
                    <p style={{ margin: 0, fontWeight: "500" }}>No claims filed yet.</p>
                </div>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {clientClaims.map(c => (
                    <li key={c._id} style={{ padding: "12px 0", borderBottom: "1px solid #f3f4f6" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                        <strong style={{ color: "#003366" }}>{c.userPolicy?.policyName}</strong>
                        <span className={`client-status ${c.status === "Approved" ? "client-status-active" : c.status === "Rejected" ? "client-status-expired" : ""}`}>{c.status}</span>
                      </div>
                        <p style={{ margin: "4px 0", fontSize: "0.85rem", fontWeight: "600" }}>Amount: ₹{c.claimAmount.toLocaleString()}</p>
                        <p style={{ margin: "4px 0", fontSize: "0.8rem", color: "#6b7280" }}>Reason: {c.reason}</p>
                        
                        {c.status !== "Pending" && (
                          <p style={{ margin: "4px 0", fontSize: "0.8rem", color: "#003366" }}>
                            <strong>Approved By:</strong> {c.approved_by?.name || c.reviewed_by?.name || "Legacy Tech Agent"} 
                            {(c.approved_by?.role || c.reviewed_by?.role) && ` (${(c.approved_by?.role || c.reviewed_by?.role).replace(/_/g, " ")})`}
                          </p>
                        )}

                          {c.review_notes && (
                            <p style={{ margin: "6px 0 0", fontSize: "0.8rem", color: "#b45309", backgroundColor: "#fef3c7", padding: "6px 10px", borderRadius: "4px" }}>
                              <strong>Notes:</strong> {c.review_notes}
                            </p>
                          )}
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </div>
      )}
      {toast && <div className="profile-toast">{toast}</div>}
    </div>
  );
}