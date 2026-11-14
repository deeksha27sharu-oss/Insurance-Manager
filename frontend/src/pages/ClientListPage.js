import { useParams, Link } from "react-router-dom";
import { POLICIES } from "../data/policies";
import { getPolicyClients } from "../data/policyExtras";
import { useAuth } from "../context/AuthContext";

export default function ClientsListPage() {
  const { policyId } = useParams();
  const { role } = useAuth();

  const policy = POLICIES.find((p) => p.id === policyId);

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
        <Link to={`/policy/${policy.id}`} className="policy-detail-back">
          ← Back to policy
        </Link>
      </div>
    );
  }

  const clients = getPolicyClients(policy);

  return (
    <div className="policy-detail">
      <Link to={`/policy/${policy.id}`} className="policy-detail-back">
        ← Back to {policy.name}
      </Link>

      <section className="policy-section">
        <h2 className="policy-section-title">
          Clients — {policy.name}
          <span className="policy-section-count"> ({clients.length})</span>
        </h2>

        {clients.length === 0 ? (
          <p className="policy-section-empty">
            No clients associated with this policy yet.
          </p>
        ) : (
          <ul className="policy-clients-list">
            {clients.map((client) => (
              <li key={client.id} className="policy-client-item">
                <Link
                  to={`/policy/${policy.id}/client/${client.id}`}
                  className="policy-client-link"
                >
                  <span className="policy-client-name">{client.name}</span>
                  {client.email && (
                    <span className="policy-client-email">{client.email}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}