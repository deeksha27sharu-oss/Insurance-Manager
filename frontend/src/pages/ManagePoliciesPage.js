import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom"; 
import { apiGet, apiPost, apiPut, apiDelete } from "../api/client"; 
import { fileToCompressedDataUrl } from "../utils/imageCompress";
import { getPolicyLogo } from "../utils/companyLogos";
import { FiUpload, FiPlus, FiTrash2, FiX, FiArrowLeft, FiCheckCircle, FiXCircle, FiEdit2, FiAlertCircle, FiFileText, FiChevronDown, FiChevronUp } from "react-icons/fi"; 

const initialForm = {
  id: "", name: "", category: "", premium: "", premiumValue: "", coverage: "", coverageValue: "",
  description: "", tagline: "", tenure: "", eligibility: "", keyFeatures: "", isExternal: false, logo: ""
};

const BATCH_SIZE = 15; 

export default function ManagePoliciesPage() {
  const [dbPolicies, setDbPolicies] = useState([]);
  const [apiPolicies, setApiPolicies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState("");
  
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create"); 
  const [editingId, setEditingId] = useState(null); 
  const [originalCategory, setOriginalCategory] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false); 
  
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [viewingPolicy, setViewingPolicy] = useState(null);

  const [editingExternalFacts, setEditingExternalFacts] = useState([]);
  const [isFetchingFacts, setIsFetchingFacts] = useState(false);
  const [showModalFacts, setShowModalFacts] = useState(false);

  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const scrollContainerRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (location.key !== "default") navigate(-1);
    else navigate("/home");
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [dbRes, catsRes, apiRes] = await Promise.all([
        apiGet("/policies"),
        apiGet("/categories"),
        apiGet("/external/admin-policies").catch(() => ({ policies: [] }))
      ]);
      
      setDbPolicies(dbRes.policies || []);
      setApiPolicies(apiRes.policies || []);
      
      const activeCats = (catsRes.categories || []).filter(c => c.isActive);
      setCategories(activeCats);
      
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => { loadData(); }, []);

  const mergedPolicies = [
    ...dbPolicies,
    ...apiPolicies.filter(apiP => !dbPolicies.some(dbP => dbP.id === apiP.id))
  ];

  useEffect(() => {
    if (visibleCount > mergedPolicies.length) {
      setVisibleCount(Math.max(BATCH_SIZE, mergedPolicies.length));
    }
  }, [mergedPolicies.length, visibleCount]);

  const handleScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 50) {
      if (visibleCount < mergedPolicies.length) {
        setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, mergedPolicies.length));
      }
    }
  }, [visibleCount, mergedPolicies.length]);

  // Returns the exact category name from the DB that matches (ignoring case/spaces), or "" if none.
  const matchCategory = (value) => {
    const v = String(value || "").trim().toLowerCase();
    if (!v) return "";
    const found = categories.find((c) => String(c.name).trim().toLowerCase() === v);
    return found ? found.name : "";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setError("");
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setForm((prev) => ({ ...prev, logo: dataUrl }));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleOpenCreate = () => {
    setModalMode("create");
    setEditingId(null);
    setIsTransitioning(false); 
    setOriginalCategory("");
    setForm({ ...initialForm, category: "" });
    setError("");
    setShowModal(true);
  };

  const handleOpenEdit = async (policy) => {
    setViewingPolicy(null); 
    setModalMode("edit");
    setEditingId(policy._id || policy.id);
    setOriginalCategory(policy.category || "");
    setIsTransitioning(true); 
    
    const featuresString = Array.isArray(policy.keyFeatures) 
      ? policy.keyFeatures.join(", ") 
      : policy.keyFeatures || "";

    setForm({
      id: policy.id || "",
      name: policy.name || "",
      category: matchCategory(policy.category),
      premium: policy.premium || "",
      premiumValue: policy.premiumValue || "",
      coverage: policy.coverage || "",
      coverageValue: policy.coverageValue || "",
      description: policy.description || "",
      tagline: policy.tagline || policy.insurer || "",
      tenure: policy.tenure || "",
      eligibility: policy.eligibility || "",
      keyFeatures: featuresString,
      isExternal: policy.isExternal || false,
      logo: policy.logo || ""
    });
    
    setError("");
    setShowModal(true);     

    if (policy.isExternal) {
      setIsFetchingFacts(true);
      setEditingExternalFacts([]);
      try {
        const apiRes = await apiGet(`/external/policies/${policy.id}`);
        setEditingExternalFacts(apiRes.policy.externalFacts || []);
      } catch (err) {
        console.warn("Could not load API facts for edit modal", err);
      } finally {
        setIsFetchingFacts(false);
      }
    } else {
      setEditingExternalFacts([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.category) {
      setError("Please select a category.");
      return;
    }
    setIsSubmitting(true);
    
    try {
      const payload = {
        ...form,
        premiumValue: Number(form.premiumValue) || 0,
        coverageValue: Number(form.coverageValue) || 0,
        keyFeatures: form.keyFeatures.split(",").map(f => f.trim()).filter(Boolean)
      };

      const isSavingExternal = modalMode === "edit" && apiPolicies.some(p => p.id === editingId && !p.isSaved);

      if (isSavingExternal || modalMode === "create") {
        await apiPost("/policies", payload);
        setToast("Policy saved successfully!");
      } else {
        await apiPut(`/policies/${editingId}`, payload);
        setToast("Policy updated successfully!");
      }
      
      setTimeout(() => setToast(""), 3000);
      setShowModal(false);
      loadData();
    } catch (err) {
      setError(err.message || `Failed to ${modalMode} policy.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation(); 
    if (!window.confirm(`Are you sure you want to permanently delete policy ${id}?`)) return;
    try {
      await apiDelete(`/policies/${id}`);
      setToast("Policy deleted.");
      setTimeout(() => setToast(""), 3000);
      loadData();
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  const handleToggleStatus = async (id, currentStatus, e) => {
    e.stopPropagation(); 
    if (currentStatus) {
      if (!window.confirm("Deactivating this policy will hide it from the user catalog. Are you sure?")) return;
    }
    try {
      await apiPut(`/policies/${id}/toggle`, {});
      setToast("Policy status updated.");
      setTimeout(() => setToast(""), 3000);
      loadData();
    } catch (err) {
      alert("Failed to toggle status: " + err.message);
    }
  };

  const formatCurrency = (amt) => `₹${Number(amt || 0).toLocaleString("en-IN")}`;
  const visiblePolicies = mergedPolicies.slice(0, visibleCount);

  return (
    <div className="policy-detail" style={{ height: "calc(100vh - var(--navbar-height) - 40px)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      
      <div style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "var(--color-bg, #f9fafb)", paddingBottom: "10px", flexShrink: 0 }}>
        <button onClick={handleBack} className="policy-detail-back" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: "16px", display: "inline-block" }}>
          <FiArrowLeft /> Back
        </button>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" , zIndex: 1}}>
          <h1 className="listing-title" style={{ margin: 0 }}>
            Manage Policies <span className="policy-section-count">({mergedPolicies.length})</span>
          </h1>
          <button className="submit-btn" onClick={handleOpenCreate} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FiPlus /> Add New Policy
          </button>
        </div>
      </div>

      <section 
        className="policy-section-client" 
        style={{ flex: 1, overflowY: "auto", marginBottom: 0, maxHeight: "none" }}
        onScroll={handleScroll}
        ref={scrollContainerRef}
      >
        <div className="all-clients-table">
          <div className="allClients-table-head" style={{
              display: "grid", gridTemplateColumns: "80px 2fr 1fr 1fr 1fr 100px",
              gap: "12px", padding: "12px 8px", borderBottom: "1px solid #e5e7eb", fontWeight: "bold", fontSize: "0.75rem",
              position: "sticky", top: 0, backgroundColor: "#ffffff", zIndex: 2
          }}>
            <span>Policy ID</span>
            <span>Name</span>
            <span>Category</span>
            <span>Premium (Value)</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          <ul className="all-clients-table-body" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {isLoading ? (
              <li style={{ padding: "20px", textAlign: "center" }}>Loading policies...</li>
            ) : visiblePolicies.map((p) => {
              const isPriced = p.premiumValue > 0;
              return (
              <li 
                key={p._id || p.id} 
                className="all-clients-row" 
                onClick={() => setViewingPolicy(p)}
                style={{
                  display: "grid", gridTemplateColumns: "80px 2fr 1fr 1fr 1fr 100px",
                  gap: "12px", padding: "12px 8px", borderBottom: "1px solid #f3f4f6", alignItems: "center",
                  cursor: "pointer", transition: "background 0.15s ease"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f9fafb"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <span className="all-clients-sno" title={p.id}>{p.id?.substring(0, 8)}...</span>
                <span className="all-clients-name" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {getPolicyLogo(p) && (
                    <img src={getPolicyLogo(p)} alt="" style={{ height: "24px", width: "36px", objectFit: "contain", flexShrink: 0 }} />
                  )}
                  {p.name}
                  {p.isExternal && !isPriced && (
                    <span style={{ fontSize: "0.65rem", backgroundColor: "#fee2e2", color: "#b91c1c", padding: "2px 6px", borderRadius: "4px" }}>Needs Pricing</span>
                  )}
                </span>
                <span className="all-clients-policy">{p.category}</span>
                
                <span className="all-clients-policy" style={{ fontWeight: 600, color: isPriced ? "#003366" : "#9ca3af" }}>
                  {isPriced ? formatCurrency(p.premiumValue) : "Not Set"}
                </span>
                
                <span className={`client-status ${p.isActive !== false ? "client-status-active" : "client-status-expired"}`} style={{ justifySelf: "start" }}>
                  {p.isActive !== false ? "Active" : "Inactive"}
                </span>
                
                <div style={{ display: "flex", gap: "8px" }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleOpenEdit(p); }} 
                    title="Edit Pricing"
                    style={{ color: "#003366", background: "none", border: "none", cursor: "pointer" }}
                  >
                    <FiEdit2 size={18} />
                  </button>
                  <button 
                    onClick={(e) => handleDelete(p.id, e)} 
                    title="Delete"
                    style={{ color: "#b91c1c", background: "none", border: "none", cursor: "pointer" }}
                  >
                    <FiTrash2 size={18} />
                  </button>
                </div>
              </li>
            )})}
            
            {visibleCount < mergedPolicies.length && (
              <li style={{ padding: "20px", textAlign: "center", color: "#6b7280", fontSize: "0.9rem", fontWeight: "500" }}>
                Loading more policies...
              </li>
            )}
          </ul>
        </div>
      </section>

      {viewingPolicy && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }} onClick={() => setViewingPolicy(null)}>
          <div className="profile-card" style={{ width: "100%", maxWidth: "700px", margin: "20px", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "15px", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {getPolicyLogo(viewingPolicy) && (
                  <img src={getPolicyLogo(viewingPolicy)} alt="" style={{ height: "40px", maxWidth: "90px", objectFit: "contain" }} />
                )}
                <div>
                <h2 className="profile-card-title" style={{ margin: 0, color: "#003366" }}>{viewingPolicy.name}</h2>
                <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>ID: {viewingPolicy.id} · {viewingPolicy.category}</span>
                </div>
              </div>
              <button onClick={() => setViewingPolicy(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
                <FiX size={24} />
              </button>
            </div>
            
            {viewingPolicy.isExternal ? (
              <div>
                 <div style={{ backgroundColor: "#fef3c7", padding: "12px", borderRadius: "8px", marginBottom: "20px", display: "flex", gap: "10px" }}>
                  <FiAlertCircle color="#b45309" size={20} style={{ flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#92400e" }}>
                    This is an external API policy. Click <strong>Edit</strong> to set a premium and save it to the database.
                  </p>
                </div>
                <div style={{ marginTop: "30px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button className="submit-btn" onClick={() => handleOpenEdit(viewingPolicy)} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <FiEdit2 /> Edit Pricing
                  </button>
                  <button className="navbar-link-btn" onClick={() => setViewingPolicy(null)}>Close</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                  <div><span className="profile-field-label">Premium Value</span><div style={{ fontWeight: "600", color: "#003366" }}>{formatCurrency(viewingPolicy.premiumValue)}</div></div>
                  <div><span className="profile-field-label">Premium Desc</span><div>{viewingPolicy.premium}</div></div>
                  <div><span className="profile-field-label">Status</span><div><span className={`client-status ${viewingPolicy.isActive !== false ? "client-status-active" : "client-status-expired"}`}>{viewingPolicy.isActive !== false ? "Active" : "Inactive"}</span></div></div>
                  <div><span className="profile-field-label">Coverage</span><div>{viewingPolicy.coverage || "—"}</div></div>
                </div>
                <div style={{ marginTop: "30px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button className="submit-btn" style={{marginTop: 0}} onClick={() => handleOpenEdit(viewingPolicy)}><FiEdit2 /> Edit Policy</button>
                  <button className="navbar-link-btn" onClick={() => setViewingPolicy(null)}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
          <div 
            className="profile-card" 
            style={{ 
              width: "100%", maxWidth: "800px", margin: "20px", maxHeight: "90vh", overflowY: "auto", 
              animation: isTransitioning ? "none" : "modalPopIn 0.25s ease-out" 
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "10px", marginBottom: "15px", position: "sticky", top: 0, backgroundColor: "white", zIndex: 10 }}>
              <h2 className="profile-card-title" style={{ margin: 0 }}>
                {modalMode === "edit" ? "Edit Policy" : "Create New Policy"}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}><FiX size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
              
              {modalMode === "edit" && form.isExternal && (
                <div style={{ gridColumn: "1 / -1", marginBottom: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", cursor: "pointer" }} onClick={() => setShowModalFacts(!showModalFacts)}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <FiFileText color="#003366" />
                      <strong style={{ color: "#003366" }}>External API Policy Details</strong>
                    </div>
                    <button type="button" style={{ background: "none", border: "none", cursor: "pointer", color: "#003366" }}>
                      {showModalFacts ? <FiChevronUp /> : <FiChevronDown />}
                    </button>
                  </div>

                  {showModalFacts && (
                    <div style={{ marginTop: "12px", maxHeight: "250px", overflowY: "auto", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px" }}>
                      <div style={{ marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid #e2e8f0", display: "flex", flexWrap: "wrap", gap: "16px" }}>
                        <div>
                          <span style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>API Category</span>
                          <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#003366", textTransform: "capitalize" }}>{originalCategory || "—"}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>Company</span>
                          <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#003366" }}>{form.tagline || "External Provider"}</div>
                        </div>
                      </div>

                      {isFetchingFacts ? (
                        <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>Loading facts from API...</p>
                      ) : editingExternalFacts.length === 0 ? (
                        <p style={{ fontSize: "0.85rem", color: "#6b7280", fontStyle: "italic" }}>No additional facts found for this policy.</p>
                      ) : (
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                          {editingExternalFacts.map((fact, i) => {
                            const safeValue = (val) => {
                              if (val === null || val === undefined) return "";
                              if (typeof val === "object") {
                                if (val.amount !== undefined && val.unit !== undefined) return `${val.amount} ${val.unit}`;
                                if (val.name) return val.name;
                                if (val.text) return val.text;
                                return JSON.stringify(val);
                              }
                              return val;
                            };

                            return (
                              <li key={i} style={{ fontSize: "0.85rem", borderBottom: "1px dashed #e5e7eb", paddingBottom: "8px" }}>
                                <strong style={{ color: "#1f2937", textTransform: "capitalize" }}>{fact.key ? fact.key.replace(/_/g, " ") : "Detail"}:</strong>
                                <span style={{ color: "#4b5563", marginLeft: "6px" }}>{safeValue(fact.value)}</span>
                                {fact.quote && <p style={{ margin: "4px 0 0 0", color: "#6b7280", fontStyle: "italic", fontSize: "0.75rem" }}>"{safeValue(fact.quote)}"</p>}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="login-field" style={{ gridColumn: "1 / -1", backgroundColor: "#f0f4f9", padding: "10px", borderRadius: "6px" }}>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#003366", fontWeight: "600" }}>Edit Pricing & Category</p>
              </div>

              <div className="login-field">
                <label className="login-label">Category</label>
                <select className="login-input" name="category" value={form.category} onChange={handleChange} required>
                  <option value="" disabled>Select category</option>
                  {categories.map((cat) => (<option key={cat._id} value={cat.name}>{cat.name}</option>))}
                </select>
              </div>
              <div className="login-field">
                <label className="login-label">Premium Value (Numeric ₹)</label>
                <input type="number" className="login-input" name="premiumValue" value={form.premiumValue} onChange={handleChange} required />
              </div>
              <div className="login-field">
                <label className="login-label">Premium Description</label>
                <input className="login-input" name="premium" value={form.premium} onChange={handleChange} required />
              </div>
              <div className="login-field">
                <label className="login-label">Coverage Text</label>
                <input className="login-input" name="coverage" value={form.coverage} onChange={handleChange} />
              </div>
              <div className="login-field">
                <label className="login-label">Coverage Value (Numeric)</label>
                <input type="number" className="login-input" name="coverageValue" value={form.coverageValue} onChange={handleChange} />
              </div>

              <div className="login-field" style={{ gridColumn: "1 / -1" }}>
                <label className="login-label">Policy Logo (PNG, JPG or WEBP)</label>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{ width: "96px", height: "64px", border: "1px dashed #cbd5e1", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", overflow: "hidden", flexShrink: 0 }}>
                    {getPolicyLogo({ logo: form.logo, name: form.name }) ? (
                      <img src={getPolicyLogo({ logo: form.logo, name: form.name })} alt="Logo preview" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                    ) : (
                      <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>No logo</span>
                    )}
                  </div>
                  <label className="navbar-link-btn" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <FiUpload /> {form.logo ? "Change logo" : "Upload logo"}
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoChange} style={{ display: "none" }} />
                  </label>
                  {form.logo && (
                    <button type="button" className="navbar-link-btn" onClick={() => setForm((prev) => ({ ...prev, logo: "" }))}>
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {!form.isExternal && (
                <>
                  <div className="login-field"><label className="login-label">Policy ID</label><input className="login-input" name="id" value={form.id} onChange={handleChange} required disabled={modalMode === "edit"} /></div>
                  <div className="login-field"><label className="login-label">Policy Name</label><input className="login-input" name="name" value={form.name} onChange={handleChange} required /></div>
                  <div className="login-field"><label className="login-label">Tenure</label><input className="login-input" name="tenure" value={form.tenure} onChange={handleChange} /></div>
                  <div className="login-field" style={{ gridColumn: "1 / -1" }}><label className="login-label">Tagline</label><input className="login-input" name="tagline" value={form.tagline} onChange={handleChange} /></div>
                  <div className="login-field" style={{ gridColumn: "1 / -1" }}><label className="login-label">Description</label><textarea className="login-input" name="description" value={form.description} onChange={handleChange} rows={3} /></div>
                  <div className="login-field" style={{ gridColumn: "1 / -1" }}><label className="login-label">Eligibility</label><input className="login-input" name="eligibility" value={form.eligibility} onChange={handleChange} /></div>
                  <div className="login-field" style={{ gridColumn: "1 / -1" }}><label className="login-label">Key Features (Comma separated)</label><input className="login-input" name="keyFeatures" value={form.keyFeatures} onChange={handleChange} /></div>
                </>
              )}
              
              <div style={{ gridColumn: "1 / -1", marginTop: "10px" }}>
                {error && <p className="login-error" style={{ marginBottom: "10px" }}>{error}</p>}
                <button type="submit" className="submit-btn" disabled={isSubmitting || categories.length === 0} style={{ width: "100%" }}>
                  {isSubmitting ? "Saving..." : (modalMode === "edit" ? "Save Changes" : "Create Policy")}
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