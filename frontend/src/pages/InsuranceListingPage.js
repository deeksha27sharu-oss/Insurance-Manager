import { useState, useMemo, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getPolicyLogo } from "../utils/companyLogos";
import { apiGet } from "../api/client";
import { useSocketEvent } from "../hooks/useSocketEvents";
import Pagination from "../components/common/Pagination"; 

const CARDS_PER_PAGE = 8;

export default function InsuranceListingPage() {
  const { role } = useAuth();
  const location = useLocation();
  
  const [policies, setPolicies] = useState([]);
  const [categories, setCategories] = useState(["All"]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentPage, setCurrentPage] = useState(location.state?.page || 1);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError("");
    try {
      const [internalRes, categoriesRes] = await Promise.all([
        apiGet("/policies"),
        apiGet("/categories"),
      ]);

      setPolicies(internalRes.policies || []);

      const activeCategoryNames = (categoriesRes.categories || [])
        .filter((c) => c.isActive)
        .map((c) => c.name);
      
      setCategories(["All", ...new Set([...activeCategoryNames, "General"])]);
    } catch (err) {
      console.error(err);
      setError("Failed to load data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useSocketEvent("policies:update", () => {
    loadData(true);
  });

  useEffect(() => {
    if (searchInput.trim() !== "") {
      const timer = setTimeout(() => {
        setSearchQuery(searchInput);
        setCurrentPage(1);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchInput]);

  const filteredPolicies = useMemo(() => {
    let result = policies;

    if (selectedCategory !== "All") {
      result = result.filter((p) => p.category?.toLowerCase() === selectedCategory.toLowerCase());
    } 

    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((p) => {
        const name = p.name?.toLowerCase() || "";
        const category = p.category?.toLowerCase() || "";
        return name.includes(query) || category.includes(query);
      });
    }

    return result;
  }, [policies, selectedCategory, searchQuery]);

  const totalPages = Math.ceil(filteredPolicies.length / CARDS_PER_PAGE);
  const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
  const visiblePolicies = filteredPolicies.slice(startIndex, startIndex + CARDS_PER_PAGE);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
    setCurrentPage(1);
  };

  const style = {
    controls: {
      display: "flex", flexDirection: "row", flexWrap: "nonwrap",
      gap: "12px", alignItems: "flex-end", justifyContent: "fles-end", marginTop: "0",
    },
    searchWrapper: { flex: "1 1 260px", minWidth: "200px" },
    searchInput: {
      width: "100%", padding: "10px 14px", fontSize: "14px",
      border: "1px solid #d1d5db", borderRadius: "8px", outline: "none",
      boxSizing: "border-box", backgroundColor: "#fff", color: "#111827",
    },
  };

  if (isLoading) return <div className="listing-empty">Loading policies...</div>;
  if (error) return <div className="listing-empty">{error}</div>;

  return (
    <div className="listing-page">
      <div className="listing-header">
        <h1 className="listing-title">Insurance Plans</h1>

        <div style={style.controls}>
          <div style={style.searchWrapper}>
            <input
              type="text" style={style.searchInput} placeholder="search policies.."
              value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <div className="listing-filter">
            <label htmlFor="category-filter" className="listing-filter-label">Filter by Category</label>
            <select
              id="category-filter" className="listing-filter-select"
              value={selectedCategory} onChange={handleCategoryChange}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {visiblePolicies.length === 0 ? (
        <p className="listing-empty">No policies found in this category.</p>
      ) : (
        <div className="insurance-grid">
          {visiblePolicies.map((policy) => {
            const logoSrc = getPolicyLogo(policy);
            return (
              <Link 
                to={`/policy/${policy.id}`} 
                state={{ page: currentPage }} 
                key={policy.id} 
                className="insurance-card"
              >
                {logoSrc && (
                  <div className="insurance-card-logo-container">
                    <img src={logoSrc} alt={`${policy.name} logo`} className="insurance-card-logo" />
                  </div>
                )}
                <h3 className="insurance-card-name">{policy.name}</h3>
                <p className="insurance-card-category">{policy.category}</p>
                
                {role === "agent" ? (
                  <span className="insurance-section-count">(API connection needed)</span>
                ) : (
                  <span className="insurance-card-know-more">Know more</span>
                )}
              </Link>
            );
          })}
        </div>
      )}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}