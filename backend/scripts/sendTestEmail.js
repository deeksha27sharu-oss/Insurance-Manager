// Usage: node scripts/sendTestEmail.js you@example.com
import "dotenv/config";
import { sendEmail } from "../services/emailService.js";
import { emailTemplates } from "../services/emailTemplates.js";

const to = process.argv[2] || process.env.GMAIL_USER;
const result = await sendEmail({ to, ...emailTemplates.welcome({ name: "Test User" }) });
console.log(result);
