import { google } from "googleapis";
import MailComposer from "nodemailer/lib/mail-composer/index.js";

let gmailClient = null;

function isEnabled() {
  return String(process.env.EMAIL_ENABLED).toLowerCase() === "true";
}

function getGmail() {
  if (gmailClient) return gmailClient;

  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) return null;

  const oauth2 = new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI || "http://localhost:3333/oauth2callback"
  );
  oauth2.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
  gmailClient = google.gmail({ version: "v1", auth: oauth2 });
  return gmailClient;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function htmlToText(html = "") {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h\d|tr|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildRawMessage({ to, subject, html, text }) {
  const fromName = process.env.EMAIL_FROM_NAME || "Insurance Manager";
  const mail = new MailComposer({
    from: { name: fromName, address: process.env.GMAIL_USER },
    to,
    subject, 
    text: text || htmlToText(html),
    html,
  });

  return new Promise((resolve, reject) => {
    mail.compile().build((err, message) => {
      if (err) return reject(err);
      resolve(
        message
          .toString("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "")
      );
    });
  });
}

 //sendmail
export async function sendEmail({ to, subject, html, text }) {
  if (!to) return { skipped: true, reason: "no recipient" };

  if (!isEnabled()) {
    console.log(`[email] disabled (EMAIL_ENABLED!=true). Would send "${subject}" to ${to}`);
    return { skipped: true, reason: "disabled" };
  }

  const gmail = getGmail();
  if (!gmail || !process.env.GMAIL_USER) {
    console.warn("[email] Gmail credentials missing; skipping send.");
    return { skipped: true, reason: "missing credentials" };
  }

  const raw = await buildRawMessage({ to, subject, html, text });

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data } = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw },
      });
      console.log(`[email] sent "${subject}" -> ${to} (id: ${data.id})`);
      return { sent: true, id: data.id };
    } catch (err) {
      lastErr = err;
      const status = err?.code || err?.response?.status;
      const transient = status === 429 || (status >= 500 && status < 600);
      if (!transient || attempt === 3) break;
      await sleep(1000 * 2 ** (attempt - 1));
    }
  }

  const d = lastErr?.response?.data;
  const reason = d
    ? JSON.stringify(d)
    : lastErr?.message;
  throw new Error(`Gmail send failed: ${reason}`);
}

export function queueEmail(to, template) {
  if (!to || !template) return;
  sendEmail({ to, ...template }).catch((err) =>
    console.error(`[email] failed to send "${template.subject}" to ${to}:`, err.message)
  );
}
