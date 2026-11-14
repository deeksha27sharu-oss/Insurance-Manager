// One-time helper: node scripts/getGmailRefreshToken.js
import "dotenv/config";
import http from "http";
import { google } from "googleapis";

const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET } = process.env;
const REDIRECT = process.env.GMAIL_REDIRECT_URI || "http://localhost:3333/oauth2callback";

if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
  console.error("Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in backend/.env first.");
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, REDIRECT);
const url = oauth2.generateAuthUrl({
  access_type: "offline",
  prompt: "consent", 
  scope: ["https://www.googleapis.com/auth/gmail.send"],
});

const { port, pathname } = new URL(REDIRECT);

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, REDIRECT);
  if (u.pathname !== pathname) { res.writeHead(404); return res.end(); }
  const code = u.searchParams.get("code");
  if (!code) { res.writeHead(400); return res.end("Missing code"); }
  try {
    const { tokens } = await oauth2.getToken(code);
    res.end("Done! You can close this tab and return to the terminal.");
    console.log("\nAdd this to backend/.env:\n");
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    if (!tokens.refresh_token) {
      console.log("No refresh token returned. Remove the app at https://myaccount.google.com/permissions and run again.");
    }
  } catch (e) {
    res.end("Token exchange failed, see terminal.");
    console.error(e.message);
  } finally {
    server.close();
  }
});

server.listen(port, () => {
  console.log("Open this URL in your browser and approve access:\n\n" + url + "\n");
});
