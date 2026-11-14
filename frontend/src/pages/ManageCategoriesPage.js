import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiGet, apiPost, apiPut, apiDelete } from "../api/client";
import { FiPlus, FiTrash2, FiX, FiCheckCircle, FiXCircle, FiArrowLeft } from "react-icons/fi";

export default function ManageCategoriesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState("");
  
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBack =()=>{
    if(location.key !== "default"){
      navigate(-1);
    }else{
      navigate("/home");
    }
  }

  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const res = await apiGet("/categories");
      setCategories(res.categories || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadCategories(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await apiPost("/categories", form);
      setToast("Category created!");
      setTimeout(() => setToast(""), 3000);
      setShowModal(false);
      setForm({ name: "", description: "" });
      loadCategories();
    } catch (err) {
      setError(err.message || "Failed to create category.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (id, currentStatus) => {
    if (currentStatus) {
      const confirmMsg = "Deactivating this category will hide ALL policies under it from the user catalog. Are you sure?";
      if (!window.confirm(confirmMsg)) return;
    }

    try {
      await apiPut(`/categories/${id}/toggle`, {});
      loadCategories();
    } catch (err) {
      alert("Failed to toggle status: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this category permanently?")) return;
    try {
      await apiDelete(`/categories/${id}`);
      setToast("Category deleted");
      setTimeout(() => setToast(""), 3000);
      loadCategories();
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  return (
    <div className="policy-detail">
      <button
        onClick={handleBack}
        className="policy-back-btn"
        style={{background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: "16px"}}
      >
        <FiArrowLeft /> Back
      </button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 className="listing-title" style={{ margin: 0 }}>
          Manage Categories <span className="policy-section-count">({categories.length})</span>
        </h1>
        <button className="submit-btn" onClick={() => setShowModal(true)} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FiPlus /> Add Category
        </button>
      </div>

      <section className="policy-section-client">
        <div className="all-clients-table">
          <div className="allClients-table-head" style={{
              display: "grid", gridTemplateColumns: "2fr 2fr 1fr 120px",
              gap: "12px", padding: "12px 8px", borderBottom: "1px solid #e5e7eb", fontWeight: "bold", fontSize: "0.75rem"
          }}>
            <span>Category Name</span>
            <span>Description</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          <ul className="all-clients-table-body" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {isLoading ? (
              <li style={{ padding: "20px", textAlign: "center" }}>Loading categories...</li>
            ) : categories.map((c) => (
              <li key={c._id} className="all-clients-row" style={{
                  display: "grid", gridTemplateColumns: "2fr 2fr 1fr 120px",
                  gap: "12px", padding: "12px 8px", borderBottom: "1px solid #f3f4f6", alignItems: "center"
              }}>
                <span className="all-clients-name">{c.name}</span>
                <span className="all-clients-email">{c.description || "—"}</span>
                
                <span className={`client-status ${c.isActive ? "client-status-active" : "client-status-expired"}`} style={{ justifySelf: "start" }}>
                  {c.isActive ? "Active" : "Inactive"}
                </span>
                
                <div style={{ display: "flex", gap: "8px" }}>
                  <button 
                    onClick={() => handleToggle(c._id, c.isActive)} 
                    title={c.isActive ? "Deactivate" : "Activate"}
                    style={{ color: c.isActive ? "#f59e0b" : "#16a34a", background: "none", border: "none", cursor: "pointer" }}
                  >
                    {c.isActive ? <FiXCircle size={18} /> : <FiCheckCircle size={18} />}
                  </button>
                  <button 
                    onClick={() => handleDelete(c._id)} 
                    title="Delete"
                    style={{ color: "#b91c1c", background: "none", border: "none", cursor: "pointer" }}
                  >
                    <FiTrash2 size={18} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
          <div className="profile-card" style={{ width: "100%", maxWidth: "450px", margin: "20px", animation: "modalPopIn 0.25s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "10px", marginBottom: "15px" }}>
              <h2 className="profile-card-title" style={{ margin: 0 }}>Add New Category</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
                <FiX size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div className="login-field">
                <label className="login-label">Category Name</label>
                <input className="login-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>

              <div className="login-field">
                <label className="login-label">Description (Optional)</label>
                <input className="login-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

              {error && <p className="login-error">{error}</p>}

              <button type="submit" className="submit-btn" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Category"}
              </button>
            </form>
          </div>
        </div>
      )}

      {toast && <div className="profile-toast">{toast}</div>}
    </div>
  );
}