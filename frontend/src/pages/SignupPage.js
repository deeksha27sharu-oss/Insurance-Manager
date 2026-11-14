import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiShield, FiUser, FiMail, FiPhone, FiLock, FiEye, FiEyeOff } from "react-icons/fi";
import { apiPost } from "../api/client";
import { useAuth } from "../context/AuthContext";

const initialForm = {
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
};

export default function SignupPage() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [form, setForm] = useState(initialForm);
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [serverError, setServerError] = useState("");
    const [showPassword, setShowPassword]= useState(false);
    const [showConfirmPassword, setShowConfirmPassword]= useState(false);

    const validateField = (name, value, allvalues) => {
        switch (name) {
            case "name": {
                if (!value.trim()) return "Full name is required.";
                if (value.trim().length < 2) return "Name must be at least 2 characters.";
                if (value.trim().length > 30) return "Name can be only least 30 characters.";
                if (!/^[a-zA-Z\s.]+$/.test(value.trim()))
                    return "Name can only contain letter, spaces and dots.";
                return "";
            }
            case "email": {
                if (!value.trim()) return "Email is required.";
                if (!/^\S+@\S+\.\S+$/.test(value.trim()))
                    return "Enter a valid email address.";
                return "";
            }
            case "phone": {
                if (!value.trim()) return "Mobile number is required.";
                if (!/^[6-9]\d{9}$/.test(value.trim()))
                    return "Enter a valid 10 digit Indian mobile number.";
                return "";
            }
            case "password": {
                if (!value) return "Password is required.";
                if (value.length < 8) return "Password must be at least 8 characters.";
                if (!/[A-Z]/.test(value)) return "Password must contain at least one Uppercase letter(A-Z).";
                if (!/[a-z]/.test(value)) return "Password must contain atleast one lowercase letter(a-z).";
                if (!/\d/.test(value)) return "Password must contain at least one number(0-9).";
                if (!/[@.#$!%*?&]/.test(value)) return "Password must contain atleast one special character(!, @, #, %, &,...)."
                return "";
            }
            case "confirmPassword": {
                if (!value) return "Please confirm your password.";
                if (value !== allvalues.password) return "Passwords do not match.";
                return "";
            }
            default:
                return "";
        }
    };
    const handleChange = (e) => {
        const { name, value } = e.target;

        let nextValue = value;
        if (name === "phone") {
            nextValue = value.replace(/\D/g, "").slice(0, 10);
        }

        const nextForm = { ...form, [name]: nextValue };
        setForm(nextForm);

        if (touched[name]) {
            setErrors((prev) => ({
                ...prev,
                [name]: validateField(name, value, nextForm),
            }));
        }
        if (name === "password" && touched.confirmPassword) {
            setErrors((prev) => ({
                ...prev,
                confirmPassword: validateField(
                    "confirmPassword",
                    nextForm.confirmPassword,
                    nextForm
                ),
            }));
        }

        if (serverError) setServerError("");
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        setTouched((prev) => ({ ...prev, [name]: true }));
        setErrors((prev) => ({
            ...prev,
            [name]: validateField(name, value, form),
        }));
    };

    const validateAll = () => {
        const newErrors = {};
        for (const key of Object.keys(form)) {
            newErrors[key] = validateField(key, form[key], form);
        }
        setErrors(newErrors);
        return Object.values(newErrors).every((msg) => !msg);
    };

    const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    const allTouched = Object.keys(form).reduce((acc, k) => ({ ...acc, [k]: true }), {});
    setTouched(allTouched);

    if (!validateAll()) return;
    setIsSubmitting(true);

    try {
        const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        password: form.password,
        };

        const data = await apiPost("/auth/signup", payload);

        login("user", {
        userId: data.customer._id,
        name: data.customer.name,
        username: data.customer.email,
        }, data.token); 

        navigate("/login", { replace: true });
    } catch (err) {
        console.log("Signup error:", err);
        setServerError(err.message || "Something went wrong");
    } finally {
        setIsSubmitting(false);
    }
    };

    const showError = (name) => touched[name] && errors[name];

    return (
        <div className="login-page">
            <form className="login-card" onSubmit={handleSubmit} noValidate>
                <div className="login-brand">
                    <FiShield className="login-brand-icon" />
                    <h1 className="login-title">Create account</h1>
                </div>
                <p className="login-subtitle">
                    Sign up as a user explore insurance plans
                </p>

                <div className="login-field">
                    <label className="login-label" htmlFor="name">Full Name</label>
                    <div className="login-input-wrap">
                        <FiUser className="login-input-icon" />
                        <input
                            id="name"
                            name="name"
                            type="text"
                            className={`login-input ${showError("name") ? "login-input-error" : ""}`}
                            placeholder="Your full name"
                            value={form.name}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            autoComplete="name"
                        />
                    </div>
                    {showError("name") && <p className="login-error">{errors.name}</p>}
                </div>

                <div className="login-field">
                    <label className="login-label" htmlFor="email">Email</label>
                    <div className="login-input-wrap">
                        <FiMail className="login-input-icon" />
                        <input
                            id="email"
                            name="email"
                            type="email"
                            className={`login-input ${showError("email") ? "login-input-error" : ""}`}
                            placeholder="you@example.com"
                            value={form.email}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            autoComplete="email"
                        />
                    </div>
                    {showError("email") && <p className="login-error">{errors.email}</p>}
                </div>

                <div className="login-field">
                    <label className="login-label" htmlFor="phone">Mobile Number</label>
                    <div className="login-input-wrap">
                        <FiPhone className="login-input-icon" />
                        <input
                            id="phone"
                            name="phone"
                            type="tel"
                            inputMode="numeric"
                            maxLength={10}
                            className={`login-input ${showError("phone") ? "login-input-error" : ""}`}
                            placeholder="10 digit mobile"
                            value={form.phone}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            autoComplete="phone"
                        />
                    </div>
                    {showError("phone") && <p className="login-error">{errors.phone}</p>}
                </div>

                <div className="login-field">
                    <label className="login-label" htmlFor="password">Password</label>
                    <div className="login-input-wrap" style={{position:"relative"}}>
                        <FiLock className="login-input-icon" />
                        <input
                            id="password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            className={`login-input ${showError("password") ? "login-input-error" : ""}`}
                            placeholder="Enetr a new password"
                            value={form.password}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            autoComplete="new-password"
                        />
                        <button
                            type="button"
                            onClick={()=> setShowPassword(!showPassword)}
                            style={{
                                position: "absolute",
                                right: "12px",
                                background: "none",
                                border: "none",
                                color: "#6b7280",
                                cursor: "pointer",
                                fontSize: "1.2rem",
                                display: "flex",
                                alignItems: "center"
                            }}
                        >
                            {showPassword ? <FiEyeOff /> : <FiEye />}
                        </button>
                    </div>
                    {showError("password") && <p className="login-error">{errors.password}</p>}
                </div>

                <div className="login-field">
                    <label className="login-label" htmlFor="confirmPassword">
                        Confirm Password
                    </label>
                    <div className="login-input-wrap" style={{position: "relative"}}>
                        <FiLock className="login-input-icon" />
                        <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            className={`login-input ${showError("confirmPassword") ? "login-input-error" : ""}`}
                            placeholder="Re-enter password"
                            value={form.confirmPassword}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            autoComplete="new-password"
                        />
                        <button
                            type="button"
                            onClick={()=> setShowConfirmPassword(!showConfirmPassword)}
                            style={{
                                position: "absolute",
                                right: "12px",
                                background: "none",
                                border: "none",
                                color: "#6b7280",
                                cursor: "pointer",
                                fontSize: "1.2rem",
                                display: "flex",
                                alignItems: "center"
                            }}
                        >
                            {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                        </button>
                    </div>
                    {showError("confirmPassword") && (
                        <p className="login-error">{errors.confirmPassword}</p>
                    )}
                </div>

                {serverError && <p className="login-error">{serverError}</p>}

                <button type="submit" className="submit-btn" disabled={isSubmitting}>
                    {isSubmitting ? "creating account.." : "create account"}
                </button>

                <p className="login-subtitle" style={{ marginTop: 4 }}>
                    Already have an account?{" "}
                    <Link to="/login" className="login-link">
                        Log in
                    </Link>
                </p>
            </form>
        </div>
    )
};