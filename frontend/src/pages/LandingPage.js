import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getPolicyLogo } from "../utils/companyLogos";
import { apiGet } from "../api/client";
import { FiLogIn, FiUserPlus } from "react-icons/fi";

const CARDS_PER_PAGE = 8;

export default function LandingPage() {
  const [policies, setPolicies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadPolicies() {
      try {
        const res = await apiGet("/policies/public"); 
        setPolicies(res.policies || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadPolicies();
  }, []);

  const totalPages = Math.ceil(policies.length / CARDS_PER_PAGE);
  const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
  const visiblePolicies = policies.slice(startIndex, startIndex + CARDS_PER_PAGE);

  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (isLoading) return <div className="listing-empty">Loading plans...</div>;

  return (
    <div className="listing-page" style={{ paddingTop: 0, height: "auto", minHeight: "100vh", overflowY: "auto" }}>
      <div className="listing-header" style={{ marginBottom: 0 }}>
        <h2 className="listing-title" style={{ fontSize: "1.5rem" }}>Insurance Plans</h2>
      </div>

      <div className="insurance-grid" style={{ marginBottom: "20px" }}>
        {visiblePolicies.map((policy) => {
          const logoSrc = getPolicyLogo(policy);
          return (
            <div
              key={policy.id}
              onClick={() => navigate(`/policy/${policy.id}`)}
              className="insurance-card"
            >
              {logoSrc && (
                <div className="insurance-card-logo-container">
                  <img src={logoSrc} alt={`${policy.name} logo`} className="insurance-card-logo" />
                </div>
              )}
              <h3 className="insurance-card-name">{policy.name}</h3>
              <p className="insurance-card-category">{policy.category}</p>
              <span className="insurance-card-know-more">
                View Details
              </span>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="pagination" style={{ marginBottom: "40px" }}>
          <button className="pagination-btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
            Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              className={page === currentPage ? "pagination-btn pagination-btn-active" : "pagination-btn"}
              onClick={() => goToPage(page)}
            >
              {page}
            </button>
          ))}
          <button className="pagination-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}