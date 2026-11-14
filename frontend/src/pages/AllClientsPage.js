import { useState, useRef, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FiSearch, FiX } from "react-icons/fi";
import { apiGet } from "../api/client.js";

const ROWS_PER_BATCH = 7;

export default function AllClientsPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [query, setQuery] = useState("");
  const [debounceQuery, setDebounceQuery] = useState("");

  const [policyData, setPolicyData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const fetchedOnce = useRef(false);

  const handleBack = () => {
    if (location.key !== "default") navigate(-1);
    else navigate("/home");
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebounceQuery(query), 500);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (fetchedOnce.current) return;
    fetchedOnce.current = true;

    let cancelled = false;

    async function loadClients() {
      setIsLoading(true);
      setLoadError("");
      try {
        const data = await apiGet("/clients");
        if (cancelled) return;

        const rows = Array.isArray(data) ? data : (data && data.rows) || [];
        setPolicyData(rows);
      } catch (err) {
        if (cancelled) return;
        console.error("/clients error:", err);
        setLoadError("Failed to load clients. Please try again.");
        setPolicyData([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadClients();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const q = debounceQuery.trim().toLowerCase();
    if (!q) return policyData;

    return policyData.filter(({ policy, client }) => {
      return (
        client?.name?.toLowerCase().includes(q) ||
        client?.email?.toLowerCase().includes(q) ||
        client?.policyNumber?.toLowerCase().includes(q) ||
        client?.city?.toLowerCase().includes(q) ||
        policy?.name?.toLowerCase().includes(q) ||
        policy?.category?.toLowerCase().includes(q)
      );
    });
  }, [policyData, debounceQuery]);

  const [visibleCount, setVisibleCount] = useState(ROWS_PER_BATCH);
  const sentinelRef = useRef(null);

  useEffect(() => {
    setVisibleCount(ROWS_PER_BATCH);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [debounceQuery]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    if (visibleCount >= filteredRows.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) =>
            Math.min(c + ROWS_PER_BATCH, filteredRows.length)
          );
        }
      },
      { root: null, rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, filteredRows.length]);

  const isAgentLike =
    role === "admin" ||
    role === "super_agent" ||
    role === "captive_agent" ||
    role === "independent_agent";

  if (!isAgentLike) {
    return (
      <div className="policy-detail">
        <button
          onClick={handleBack}
          className="policy-detail-back"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          ← Back
        </button>
      </div>
    );
  }

  const visibleRows = filteredRows.slice(0, visibleCount);

  return (
    <div className="policy-detail">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={handleBack}
          className="policy-detail-back"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            marginBottom: 0,
          }}
        >
          ← Back
        </button>

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            height: "40px",
            padding: "0 12px",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            background: "#fff",
            width: "360px",
            maxWidth: "100%",
          }}
        >
          <FiSearch
            style={{
              color: "#6b7280",
              fontSize: "1rem",
              flexShrink: 0,
              marginRight: "8px",
              marginLeft: "4px",
            }}
          />
          <input
            type="text"
            placeholder="Search by name,email,phone,policy.."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: "0.95rem",
              color: "var(--color-text)",
              minWidth: 0,
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              style={{
                flexShrink: 0,
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6b7280",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              <FiX />
            </button>
          )}
        </div>
      </div>

      <section className="policy-section-client">
        <h2 className="policy-section-title">
          All Clients
          <span className="policy-section-count"> ({filteredRows.length})</span>
        </h2>

        {isLoading ? (
          <p className="policy-section-empty">Loading Clients..</p>
        ) : loadError ? (
          <p className="policy-section-empty">{loadError}</p>
        ) : filteredRows.length === 0 ? (
          <p className="policy-section-empty">
            {query ? `No clients match "${query}".` : "No clients found."}
          </p>
        ) : (
          <div className="all-clients-table">
            <div className="all-clients-table-head">
              <span>S.No</span>
              <span>Name</span>
              <span>Email</span>
              <span>Policy</span>
            </div>
            <ul className="all-clients-table-body">
              {visibleRows.map(({ policy, client }, index) => (
                <li key={`${policy.id}-${client.id}`}>
                  <Link
                    to={`/policy/${policy.id}/client/${client.id}`}
                    className="all-clients-row"
                  >
                    <span className="all-clients-sno">{index + 1}</span>
                    <span className="all-clients-name">{client.name}</span>
                    <span className="all-clients-email">
                      {client.email || "—"}
                    </span>
                    <span className="all-clients-policy">{policy.name}</span>
                  </Link>
                </li>
              ))}
            </ul>

            {visibleCount < filteredRows.length && (
              <div ref={sentinelRef} className="scroll-sentinel" />
            )}
          </div>
        )}
      </section>
    </div>
  );
}