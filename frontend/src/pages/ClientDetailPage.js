import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { POLICIES } from "../data/policies";
import { getPolicyClientById } from "../data/policyExtras";
import { useAuth } from "../context/AuthContext";
import { useChatPanel } from "../context/ChatPanelContext";
import { FiArrowLeft, FiUser, FiMail, FiPhone, FiMapPin, FiMessageCircle } from "react-icons/fi";

export default function ClientDetailPage() {
  const { policyId, clientId } = useParams();
  const { role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { openChat } = useChatPanel();

  const handleBack = () => {
    if (location.key !== "default") {
      navigate(-1);
    } else {
      navigate("/home");
    }
  };

  const policy = POLICIES.find((p) => p.id === policyId);

  const isAgentRole =
    role === "super_agent" ||
    role === "captive_agent" ||
    role === "independent_agent" ||
    role === "admin";

  if (!isAgentRole) {
    return (
      <div className="policy-detail">
        <h1>Access restricted</h1>
        <p>Only agents can view client details.</p>
        <Link to="/home" className="policy-detail-back">
          <FiArrowLeft /> Back to plans
        </Link>
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="policy-detail">
        <h1>Policy not found</h1>
        <Link to="/" className="policy-detail-back">
          ← Back to plans
        </Link>
      </div>
    );
  }

  const client = getPolicyClientById(policy, clientId);

  if (!client) {
    return (
      <div className="policy-detail">
        <h1>Client not found</h1>
        <Link
          to={`/policy/${policy.id}/clients`}
          className="policy-detail-back"
        >
          ← Back to clients
        </Link>
      </div>
    );
  }

  const handleChatNow = () => {
    openChat(policy.id, client.id);
  };

  return (
    <div className="policy-detail">
      <button
        onClick={handleBack}
        className="policy-detail-back"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        ← Back
      </button>

      <header className="client-detail-header">
        <div className="client-detail-avatar">
          {client.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <div className="client-detail-header-text">
          <h1 className="client-detail-name">{client.name}</h1>
          <span
            className={
              client.status === "Active"
                ? "client-status client-status-active"
                : "client-status client-status-expired"
            }
          >
            {client.status}
          </span>
          <p className="client-detail-policy-name">
            {policy.category} · {policy.name}
          </p>
        </div>

        {isAgentRole && (
          <button
            type="button"
            onClick={handleChatNow}
            aria-label={`Chat with ${client.name}`}
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              borderRadius: "var(--radius-md, 8px)",
              color: "#000000",
              border: "1px solid #003366",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: "pointer",
              flexShrink: 0,
              transition: "opacity 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = 0.9)}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = 1)}
          >
            <FiMessageCircle />
            Chat now
          </button>
        )}
      </header>

      <section className="policy-section">
        <h2 className="policy-section-title">Contact Information</h2>
        <div className="client-info-grid">
          <div className="client-info-item">
            <FiMail className="client-info-icon" />
            <div>
              <span className="client-info-label">Email</span>
              <span className="client-info-value">
                {client.email || "—"}
              </span>
            </div>
          </div>

          <div className="client-info-item">
            <FiPhone className="client-info-icon" />
            <div>
              <span className="client-info-label">Phone</span>
              <span className="client-info-value">
                {client.phone || "—"}
              </span>
            </div>
          </div>

          <div className="client-info-item">
            <FiMapPin className="client-info-icon" />
            <div>
              <span className="client-info-label">City</span>
              <span className="client-info-value">
                {client.city || "—"}
              </span>
            </div>
          </div>

          <div className="client-info-item">
            <FiUser className="client-info-icon" />
            <div>
              <span className="client-info-label">Age</span>
              <span className="client-info-value">
                {client.age ?? "—"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="policy-section">
        <h2 className="policy-section-title">Policy Information</h2>
        <div className="client-info-grid">
          <div className="client-info-item">
            <div>
              <span className="client-info-label">Policy Number</span>
              <span className="client-info-value">
                {client.policyNumber || "—"}
              </span>
            </div>
          </div>

          <div className="client-info-item">
            <div>
              <span className="client-info-label">Premium</span>
              <span className="client-info-value">
                {client.premium || "—"}
              </span>
            </div>
          </div>

          <div className="client-info-item">
            <div>
              <span className="client-info-label">Start Date</span>
              <span className="client-info-value">
                {client.startDate || "—"}
              </span>
            </div>
          </div>

          <div className="client-info-item">
            <div>
              <span className="client-info-label">Renewal Date</span>
              <span className="client-info-value">
                {client.renewalDate || "—"}
              </span>
            </div>
          </div>

          <div className="client-info-item">
            <div>
              <span className="client-info-label">Policy Name</span>
              <span className="client-info-value">
                {policy.name || "—"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {client.nominees?.length > 0 && (
        <section className="policy-section">
          <h2 className="policy-section-title">
            Nominees
            <span className="policy-section-count">
              {" "}
              ({client.nominees.length})
            </span>
          </h2>
          <ul className="client-nominees-list">
            {client.nominees.map((nominee, i) => (
              <li key={i} className="client-nominee-item">
                <div className="client-nominee-avatar">
                  {nominee.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="client-nominee-info">
                  <span className="client-nominee-name">{nominee.name}</span>
                  <span className="client-nominee-relation">{nominee.relation}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}