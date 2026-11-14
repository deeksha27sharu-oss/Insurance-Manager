import { UserPolicy } from "../models/UserPolicy.js";
import { sendEmail } from "../services/emailService.js";
import { emailTemplates } from "../services/emailTemplates.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runRenewalReminders(daysAhead = Number(process.env.RENEWAL_REMINDER_DAYS) || 7) {
  const now = new Date();
  const until = new Date(now.getTime() + daysAhead * DAY_MS);

  const due = await UserPolicy.find({
    status: "Active",
    workflowStage: "Relationship Active",
    renewalReminderSent: { $ne: true },
    renewalDate: { $gte: now, $lte: until },
  }).populate("user", "name email");

  let sent = 0;
  for (const p of due) {
    if (!p.user?.email) continue;
    try {
      const daysLeft = Math.max(1, Math.ceil((p.renewalDate - now) / DAY_MS));
      const result = await sendEmail({
        to: p.user.email,
        ...emailTemplates.renewalReminder({
          name: p.user.name,
          policyName: p.policyName,
          renewalDate: p.renewalDate,
          daysLeft,
        }),
      });
      if (result.sent) {
        p.renewalReminderSent = true;
        await p.save();
        sent++;
      }
    } catch (err) {
      console.error(`[renewal-job] failed for policy ${p._id}:`, err.message);
    }
    await sleep(300); // gentle pacing for Gmail rate limits
  }
  console.log(`[renewal-job] checked ${due.length} policies, sent ${sent} reminders`);
}

export function startRenewalReminderJob() {
  if (String(process.env.EMAIL_ENABLED).toLowerCase() !== "true") return;
  const run = () => runRenewalReminders().catch((e) => console.error("[renewal-job] error:", e.message));
  setTimeout(run, 60 * 1000);          // 1 min after boot
  setInterval(run, DAY_MS);            // then daily
  console.log("[renewal-job] scheduled (daily)");
}
