const APP_NAME = "Insurance Manager";

const esc = (v = "") =>
  String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const roleLabel = (role = "") => role.replace(/_/g, " ");

function layout({ title, intro, rows = [], note = "", ctaLabel, ctaPath }) {
  const base = process.env.FRONTEND_URL || "http://localhost:3000";
  const rowsHtml = rows.length
    ? `<table style="width:100%;border-collapse:collapse;margin:16px 0;">${rows
        .map(
          ([k, v]) => `<tr>
            <td style="padding:8px 0;color:#6b7280;font-size:14px;width:40%;">${esc(k)}</td>
            <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${esc(v)}</td>
          </tr>`
        )
        .join("")}</table>`
    : "";
  const cta =
    ctaLabel && ctaPath
      ? `<p style="margin:24px 0;"><a href="${esc(base + ctaPath)}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px;">${esc(ctaLabel)}</a></p>`
      : "";

  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;">
    <div style="background:#1e3a8a;color:#fff;padding:16px 24px;font-size:18px;font-weight:700;">${APP_NAME}</div>
    <div style="padding:24px;">
      <h2 style="margin:0 0 12px;color:#111827;font-size:20px;">${esc(title)}</h2>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0;">${intro}</p>
      ${rowsHtml}
      ${note ? `<p style="color:#374151;font-size:14px;line-height:1.6;">${note}</p>` : ""}
      ${cta}
    </div>
    <div style="padding:16px 24px;background:#f9fafb;color:#9ca3af;font-size:12px;">
      This is an automated message from ${APP_NAME}. Please do not reply.
    </div>
  </div></body></html>`;
}

export const emailTemplates = {
  welcome: ({ name }) => ({
    subject: `Welcome to ${APP_NAME}`,
    html: layout({
      title: `Welcome, ${name}!`,
      intro: `Your account has been created successfully. You can now browse policies, buy coverage and track your claims.`,
      ctaLabel: "Go to dashboard",
      ctaPath: "/",
    }),
  }),

  agentWelcome: ({ name, role }) => ({
    subject: `Your ${APP_NAME} ${roleLabel(role)} account is ready`,
    html: layout({
      title: `Welcome aboard, ${name}`,
      intro: `An administrator has created a <b>${esc(roleLabel(role))}</b> account for you.`,
      note: `Use the credentials shared with you by your administrator to sign in, and change your password after first login.`,
      ctaLabel: "Sign in",
      ctaPath: "/login",
    }),
  }),

  policyPurchased: ({ name, policyName, category, startDate, renewalDate }) => ({
    subject: `Policy purchase received: ${policyName}`,
    html: layout({
      title: "Purchase received",
      intro: `Hi ${esc(name)}, thanks for purchasing <b>${esc(policyName)}</b>. It is now pending technical review — we'll email you as soon as a decision is made.`,
      rows: [
        ["Policy", policyName],
        ["Category", category],
        ["Start date", fmtDate(startDate)],
        ["Renewal date", fmtDate(renewalDate)],
      ],
      ctaLabel: "View my policies",
      ctaPath: "/",
    }),
  }),

  reviewAssigned: ({ agentName, policyName, clientName }) => ({
    subject: `New policy awaiting your review: ${policyName}`,
    html: layout({
      title: "New review assigned",
      intro: `Hi ${esc(agentName)}, a new policy has been assigned to you for technical review.`,
      rows: [
        ["Policy", policyName],
        ["Client", clientName],
      ],
      ctaLabel: "Open reviews",
      ctaPath: "/",
    }),
  }),

  policyApproved: ({ name, policyName, notes }) => ({
    subject: `Your policy has been approved: ${policyName}`,
    html: layout({
      title: "Policy approved 🎉",
      intro: `Hi ${esc(name)}, your policy <b>${esc(policyName)}</b> has been approved and is now active.`,
      rows: notes ? [["Reviewer notes", notes]] : [],
      ctaLabel: "View my policies",
      ctaPath: "/",
    }),
  }),

  policyRejected: ({ name, policyName, notes }) => ({
    subject: `Update on your policy: ${policyName}`,
    html: layout({
      title: "Policy not approved",
      intro: `Hi ${esc(name)}, unfortunately your policy <b>${esc(policyName)}</b> could not be approved.`,
      rows: [["Reason", notes]],
      note: `If you have questions, please contact your agent.`,
    }),
  }),

  claimFiled: ({ name, policyName, claimAmount, reason }) => ({
    subject: `Claim received for ${policyName}`,
    html: layout({
      title: "We've received your claim",
      intro: `Hi ${esc(name)}, your claim has been filed and is awaiting review.`,
      rows: [
        ["Policy", policyName],
        ["Claim amount", inr(claimAmount)],
        ["Reason", reason],
      ],
      ctaLabel: "Track my claims",
      ctaPath: "/",
    }),
  }),

  claimReviewed: ({ name, policyName, claimAmount, status, notes }) => ({
    subject: `Your claim was ${String(status).toLowerCase()}: ${policyName}`,
    html: layout({
      title: `Claim ${String(status).toLowerCase()}`,
      intro: `Hi ${esc(name)}, your claim on <b>${esc(policyName)}</b> has been <b>${esc(String(status).toLowerCase())}</b>.`,
      rows: [
        ["Claim amount", inr(claimAmount)],
        ["Reviewer notes", notes],
      ],
      ctaLabel: "View claim",
      ctaPath: "/",
    }),
  }),

  commissionPaid: ({ name, amount, month, policyName }) => ({
    subject: `Commission payout of ${inr(amount)} processed`,
    html: layout({
      title: "Commission paid",
      intro: `Hi ${esc(name)}, a commission payout has been processed for you.`,
      rows: [
        ["Amount", inr(amount)],
        ["Month", month],
        ...(policyName ? [["Policy", policyName]] : []),
      ],
      ctaLabel: "View earnings",
      ctaPath: "/",
    }),
  }),

  renewalReminder: ({ name, policyName, renewalDate, daysLeft }) => ({
    subject: `Renewal reminder: ${policyName} renews in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
    html: layout({
      title: "Your policy is due for renewal",
      intro: `Hi ${esc(name)}, your policy <b>${esc(policyName)}</b> renews on <b>${esc(fmtDate(renewalDate))}</b>.`,
      note: `Please make sure your details are up to date to avoid any gap in coverage.`,
      ctaLabel: "View my policies",
      ctaPath: "/",
    }),
  }),
};
