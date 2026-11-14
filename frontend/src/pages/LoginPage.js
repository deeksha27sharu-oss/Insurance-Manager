import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FiShield, FiMail, FiLock, FiEye, FiEyeOff } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { apiPost } from "../api/client";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword]= useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const data = await apiPost("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });

      login(
        data.customer.role, 
        {
          userId: data.customer._id,
          name: data.customer.name,
          username: data.customer.email,
        }, 
        data.token
      );

      navigate("/home", { replace: true });
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <FiShield className="login-brand-icon" />
          <h1 className="login-title">Insurance Portal</h1>
        </div>

        <p className="login-subtitle">Sign in to continue</p>

        <div className="login-field">
          <label htmlFor="email" className="login-label">Email</label>
          <div className="login-input-wrap">
            <FiMail className="login-input-icon" />
            <input
              id="email"
              type="email"
              className="login-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div className="login-field">
          <label htmlFor="password" className="login-label">Password</label>
          <div className="login-input-wrap" style={{position: "relative"}}>
            <FiLock className="login-input-icon" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className="login-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type= "button"
              onClick={()=> setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "12px",
                background: "none",
                border: "none",
                color: "#6b7230",
                cursor: "pointer",
                fontSize: "1.2rem",
                display: "flex",
                alignItems: "center",
              }}
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
        </div>

        {error && <p className="login-error">{error}</p>}

        <button type="submit" className="login-btn" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign In"}
        </button>

        <p className="login-subtitle" style={{ marginTop: 10 }}>
          New user? <Link to="/signup" className="login-link">Sign Up</Link>
        </p>
      </form>
    </div>
  );
}