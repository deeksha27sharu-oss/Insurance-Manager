export function validateUserPayload({ name, email, phone, password, requirePassword = true }) {
  const errors = {};

  if (!name || !name.trim()) {
    errors.name = "Full name is required.";
  } else if (name.trim().length < 5) {
    errors.name = "Name must be at least 5 characters.";
  } else if (!/^[a-zA-Z\s.]+$/.test(name.trim())) {
    errors.name = "Name can only contain letters, spaces, and dots.";
  }

  if (!email || !email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!phone || !phone.trim()) {
    errors.phone = "Mobile number is required.";
  } else if (!/^[6-9]\d{9}$/.test(phone.trim())) {
    errors.phone = "Enter a valid 10-digit Indian mobile number.";
  }

  if (requirePassword) {
    if (!password) {
      errors.password = "Password is required.";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    } else if (!/[A-Z]/.test(password)) {
      errors.password = "Password must contain an uppercase letter.";
    } else if (!/[a-z]/.test(password)) {
      errors.password = "Password must contain a lowercase letter.";
    } else if (!/\d/.test(password)) {
      errors.password = "Password must contain a number.";
    } else if (!/[@.#$!%*?&]/.test(password)) {
      errors.password = "Password must contain a special character (@, #, $, etc).";
    }
  }

  return errors;
}