import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiGet, apiPost, apiPut, apiDelete } from "../api/client";
import Pagination from "../components/common/Pagination";
import { useSocketEvent } from "../hooks/useSocketEvents";
import { FiEdit2, FiTrash2, FiX, FiCheck, FiRefreshCw, FiUserPlus, FiEye, FiEyeOff, FiArrowLeft, FiMail, FiPhone, FiBriefcase } from "react-icons/fi";

const initialForm = { name: "", email: "", phone: "", password: "", role: "captive_agent", team_id: "" };
const PAGE_SIZE= 10;

export default function ManageAgentsPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [agents, setAgents] = useState([]);
  const [superAgents, setSuperAgents] = useState([]);
  const [isFetching, setIsFetching] = useState(true);
  const [toast, setToast] = useState("");
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});
  const [editError, setEditError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [viewingAgent, setViewingAgent] = useState(null);

  const [page, setPage]= useState(1);

  const fetchedOnce = useRef(false);

  const handleBack = () => {
    if (location.key !== "default") navigate(-1);
    else navigate("/home");
  };

  const loadAgents = useCallback(async () => {
    setIsFetching(true);
    try {
      const data = await apiGet("/auth/agents");
      const allAgents = data.agents || [];
      setAgents(allAgents);
      setSuperAgents(allAgents.filter(a => a.role === "super_agent"));
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    if (fetchedOnce.current) return;
    fetchedOnce.current = true;
    loadAgents();
  }, [loadAgents]);

  useSocketEvent("agents:update", ()=>{
    console.log("Live agent update received");
    loadAgents();
  });

  const handleCreateChange = (e) => {
    const { name, value } = e.target;
    let nextValue = value;
    if (name === "phone") nextValue = value.replace(/\D/g, "").slice(0, 10);
    setCreateForm((prev) => ({ ...prev, [name]: nextValue }));
    if (createError) setCreateError("");
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateError("");
    if (createForm.name.trim().length < 5) return setCreateError("Name must be at least 5 characters.");
    if (!/^[6-9]\d{9}$/.test(createForm.phone.trim())) return setCreateError("Enter a valid 10-digit Indian mobile number.");
    if (createForm.password.length < 8) return setCreateError("Password must be at least 8 characters.");

    setIsCreating(true);
    try {
      const data = await apiPost("/auth/create-agent", createForm);
      setAgents((prev) => [data.agent, ...prev]);
      setToast("Agent created successfully!");
      setTimeout(() => setToast(""), 3000);
      setShowCreateForm(false);
      setCreateForm(initialForm);
      loadAgents();
    } catch (err) {
      setCreateError(err.message || "Failed to create agent.");
    } finally {
      setIsCreating(false);
    }
  };

  const startEdit = (agent, e) => {
    e.stopPropagation(); 
    setEditingId(agent._id);
    setEditError("");
    setDraft({
      name: agent.name || "",
      email: agent.email || "",
      phone: agent.phone || "",
      role: agent.role || "captive_agent",
      team_id: agent.team_id || "",
      password: "",
    });
  };

  const cancelEdit = (e) => {
    if(e) e.stopPropagation();
    setEditingId(null);
    setDraft({});
    setEditError("");
  };

  const handleDraftChange = (e) => {
    e.stopPropagation(); 
    const { name, value } = e.target;
    let nextValue = value;
    if (name === "phone") nextValue = value.replace(/\D/g, "").slice(0, 10);
    setDraft((prev) => ({ ...prev, [name]: nextValue }));
  };

  const saveEdit = async (e) => {
    e.stopPropagation();
    if (!editingId) return;
    if (draft.name.trim().length < 5) return setEditError("Name too short.");
    if (!/^\S+@\S+\.\S+$/.test(draft.email.trim())) return setEditError("Invalid email.");
    if (!/^[6-9]\d{9}$/.test(draft.phone.trim())) return setEditError("Invalid phone.");

    setIsSaving(true);
    setEditError("");
    try {
      const payload = {
        name: draft.name.trim(),
        email: draft.email.trim().toLowerCase(),
        phone: draft.phone.trim(),
        role: draft.role,
        team_id: draft.team_id,
      };
      if (draft.password.trim()) payload.password = draft.password;

      const res = await apiPut(`/auth/agents/${editingId}`, payload);
      setAgents((prev) => prev.map((a) => (a._id === editingId ? res.agent : a)));
      setToast("Agent updated");
      setTimeout(() => setToast(""), 2000);
      cancelEdit();
      loadAgents();
    } catch (err) {
      setEditError(err.message || "Update failed.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (agent, e) => {
    e.stopPropagation(); 
    if (!window.confirm(`Delete "${agent.name}"? This cannot be undone.`)) return;
    setDeletingId(agent._id);
    try {
      await apiDelete(`/auth/agents/${agent._id}`);
      setAgents((prev) => prev.filter((a) => a._id !== agent._id));
      setToast("Agent deleted");
      setTimeout(() => setToast(""), 2000);
    } catch (err) {
      alert("Delete failed: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages= Math.max(1, Math.ceil(agents.length / PAGE_SIZE));
  const currentPage= Math.min(page, totalPages);
  const pagedAgents= agents.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(()=>{
    if(page > totalPages) setPage(totalPages);
  },[totalPages, page]);

  return (
    <div className="policy-detail manage-agents-page">
      <button
        onClick={handleBack}
        className="policy-detail-back"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          marginBottom: 12,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "#003366",
          fontWeight: 500,
        }}
      >
        <FiArrowLeft /> Back
      </button>
      
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h1 className="listing-title" style={{ margin: 0 }}>
          Manage Agents
          <span className="policy-section-count">({agents.length})</span>
        </h1>

        <div style={{ display: "flex", gap: "12px" }}>
          <button className="navbar-link-btn" onClick={loadAgents} disabled={isFetching}>
            <FiRefreshCw /> {isFetching ? "Loading..." : "Refresh"}
          </button>
          
          <button className="submit-btn" onClick={() => setShowCreateForm(true)}>
             <FiUserPlus style={{ marginRight: 6, verticalAlign: "middle" }}/> 
             Create New Agent
          </button>
        </div>
      </div>

      {agents.length > 0 && (
        <>
          <section className="policy-section-client">
            <div className="all-clients-table">
              <div
                className="allClients-table-head"
                style={{
                  fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666666",
                  borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, backgroundColor: "#ffffff", zIndex: 1,
                  display: "grid", gridTemplateColumns: "60px 1.2fr 1.6fr 1fr 1fr 1fr 100px",
                  gap: "12px", alignItems: "center", paddingTop: 0, marginTop: 0, height: "50px",
                }}
              >
                <span>Actions</span>
                <span>Name</span>
                <span>Email</span>
                <span>Phone</span>
                <span>Role</span>
                <span>Team Lead</span>
                <span>Password</span>
              </div>

              <ul className="all-clients-table-body" style={{ listStyle: "none", padding: "0 8px", margin: 0 }}>
                {pagedAgents.map((agent) => {  
                  const isEditing = editingId === agent._id;
                  const teamLead = superAgents.find(sa => sa._id === agent.team_id);

                  return (
                    <li
                      key={agent._id}
                      className="all-clients-row"
                      onClick={() => setViewingAgent(agent)}
                      style={{
                        gridTemplateColumns: "60px 1.2fr 1.6fr 1fr 1fr 1fr 100px",
                        cursor: "pointer", transition: "background 0.15s ease"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f9fafb"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      <div style={{ display: "flex", gap: 6 }}>
                        {isEditing ? (
                          <>
                            <button title="Save" onClick={saveEdit} disabled={isSaving} style={{ color: "#16a34a", padding: 6, borderRadius: 4 }}><FiCheck /></button>
                            <button title="Cancel" onClick={cancelEdit} disabled={isSaving} style={{ color: "#6b7280", padding: 6, borderRadius: 4 }}><FiX /></button>
                          </>
                        ) : (
                          <>
                            <button title="Edit" onClick={(e) => startEdit(agent, e)} style={{ color: "#003366", padding: 6, borderRadius: 4 }}><FiEdit2 /></button>
                            <button title="Delete" onClick={(e) => handleDelete(agent, e)} disabled={deletingId === agent._id} style={{ color: "#b91c1c", padding: 6, borderRadius: 4 }}><FiTrash2 /></button>
                          </>
                        )}
                      </div>

                      {isEditing ? (
                        <>
                          <input name="name" value={draft.name} onChange={handleDraftChange} onClick={(e)=>e.stopPropagation()} className="profile-input" style={{ width: "100%", padding: "4px 6px" }} />
                          <input name="email" value={draft.email} onChange={handleDraftChange} onClick={(e)=>e.stopPropagation()} className="profile-input" style={{ width: "100%", padding: "4px 6px" }} />
                          <input name="phone" type="tel" maxLength={10} value={draft.phone} onChange={handleDraftChange} onClick={(e)=>e.stopPropagation()} className="profile-input" style={{ width: "100%", padding: "4px 6px" }} />
                          
                          <select name="role" value={draft.role} onChange={handleDraftChange} onClick={(e)=>e.stopPropagation()} className="profile-input" style={{ width: "100%", padding: "4px 6px" }}>
                            <option value="captive_agent">Captive Agent</option>
                            <option value="independent_agent">Independent Agent</option>
                            <option value="super_agent">Super Agent</option>
                            <option value="technical_agent">Technical Agent</option>
                            <option value="relationship_agent">Relationship Agent</option>
                          </select>
                          
                          <select name="team_id" value={draft.team_id} onChange={handleDraftChange} onClick={(e)=>e.stopPropagation()} className="profile-input" style={{ width: "100%", padding: "4px 6px" }}>
                            <option value="">No Team</option>
                            {superAgents.map(sa => (<option key={sa._id} value={sa._id}>{sa.name}</option>))}
                          </select>

                          <input type="password" name="password" placeholder="New pass" value={draft.password} onChange={handleDraftChange} onClick={(e)=>e.stopPropagation()} className="profile-input" style={{ width: "100%", padding: "4px 6px" }} />
                          
                          {editError && <span style={{ gridColumn: "1 / -1", color: "red", fontSize: "0.8rem", marginTop: "4px" }}>{editError}</span>}
                        </>
                      ) : (
                        <>
                          <span className="all-clients-name">{agent.name}</span>
                          <span className="all-clients-email">{agent.email || "—"}</span>
                          <span className="all-clients-email">{agent.phone || "—"}</span>
                          <span className="all-clients-policy" style={{ textTransform: "capitalize" }}>
                            {agent.role.replace(/_/g, " ")}
                          </span>
                          
                          <span className="all-clients-policy" style={{color: agent.team_id ? "#003366" : "#9ca3af"}}>
                            {teamLead ? teamLead.name : "—"}
                          </span>

                          <span className="all-clients-sno" style={{ color: "#9ca3af" }}>••••••••</span>
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

      {viewingAgent && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }} onClick={() => setViewingAgent(null)}>
          <div className="profile-card" style={{ width: "100%", maxWidth: "500px", margin: "20px", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "15px", marginBottom: "20px" }}>
              <div>
                <h2 className="profile-card-title" style={{ margin: 0, color: "#003366" }}>{viewingAgent.name}</h2>
                <span style={{ fontSize: "0.85rem", color: "#6b7280", textTransform: "capitalize" }}>{viewingAgent.role.replace(/_/g, " ")}</span>
              </div>
              <button onClick={() => setViewingAgent(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
                <FiX size={24} />
              </button>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", backgroundColor: "#f9fafb", borderRadius: "8px" }}>
                <FiMail color="#003366" size={20} />
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 600 }}>Email</div>
                  <div style={{ fontWeight: 600 }}>{viewingAgent.email}</div>
                </div>
              </div>
              
              <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", backgroundColor: "#f9fafb", borderRadius: "8px" }}>
                <FiPhone color="#003366" size={20} />
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 600 }}>Phone</div>
                  <div style={{ fontWeight: 600 }}>{viewingAgent.phone || "—"}</div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", backgroundColor: "#f0f4f9", borderRadius: "8px" }}>
                <FiBriefcase color="#003366" size={20} />
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 600 }}>Team Lead (Super Agent)</div>
                  <div style={{ fontWeight: 600, color: "#003366" }}>
                    {superAgents.find(sa => sa._id === viewingAgent.team_id)?.name || "No Team Assigned"}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "30px", display: "flex", justifyContent: "flex-end" }}>
              <button className="submit-btn" onClick={() => setViewingAgent(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showCreateForm && (
        <div style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex", justifyContent: "center", alignItems: "center",
          zIndex: 2000
        }}>
          <div className="profile-card" style={{ 
            width: "100%", maxWidth: "600px", margin: "20px", 
            maxHeight: "90vh", overflowY: "auto", animation: "modalPopIn 0.25s ease-out" 
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "10px", marginBottom: "15px" }}>
              <h2 className="profile-card-title" style={{ margin: 0 }}>Create New Agent</h2>
              <button onClick={() => setShowCreateForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
                <FiX size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
              
              <div className="login-field">
                <label className="login-label">Full Name</label>
                <input className="login-input" name="name" value={createForm.name} onChange={handleCreateChange} required />
              </div>

              <div className="login-field">
                <label className="login-label">Email</label>
                <input type="email" className="login-input" name="email" value={createForm.email} onChange={handleCreateChange} required />
              </div>

              <div className="login-field">
                <label className="login-label">Phone</label>
                <input className="login-input" name="phone" type="tel" maxLength={10} value={createForm.phone} onChange={handleCreateChange} required />
              </div>

              <div className="login-field">
                <label className="login-label">Agent Role</label>
                <select className="login-input" name="role" value={createForm.role} onChange={handleCreateChange}>
                  <option value="captive_agent">Captive Agent</option>
                  <option value="independent_agent">Independent Agent</option>
                  <option value="super_agent">Super Agent</option>
                  <option value="technical_agent">Technical Agent</option>
                  <option value="relationship_agent">Relationship Agent</option>
                </select>
              </div>

              <div className="login-field" style={{ gridColumn: "1 / -1" }}>
                <label className="login-label">Assign to Super Agent (Team)</label>
                <select className="login-input" name="team_id" value={createForm.team_id || ""} onChange={handleCreateChange}>
                  <option value="">No Team (Independent)</option>
                  {superAgents.map(sa => (
                    <option key={sa._id} value={sa._id}>{sa.name}</option>
                  ))}
                </select>
              </div>

              <div className="login-field" style={{ gridColumn: "1 / -1" }}>
                <label className="login-label">Temporary Password</label>
                <div className="login-input-wrap" style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="login-input"
                    name="password"
                    value={createForm.password}
                    onChange={handleCreateChange}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: "absolute", right: "12px", background: "none", border: "none", color: "#6b7280", cursor: "pointer", display: "flex", alignItems: "center" }}
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                {createError && <p className="login-error" style={{ marginBottom: "10px" }}>{createError}</p>}
                <button type="submit" className="submit-btn" disabled={isCreating} style={{ width: "100%" }}>
                  {isCreating ? "Creating..." : "Create Agent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <div className="profile-toast">{toast}</div>}
    </div>
  );
}