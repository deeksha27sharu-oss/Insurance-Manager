import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const required =["MONGO_URI", "JWT_SECRET", "EXTERNAL_API_URL"];
const missing = required.filter((k)=>!process.env[k]);

if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  console.error("Check backend/.env");
  process.exit(1);
}

if(!process.env.PORT){
  console.log("PORT is not set. Defaulting to 5000");
}

console.log("Environment loaded:", {
  hasMongoUri: !!process.env.MONGO_URI,
  hasJwtSecret: !!process.env.JWT_SECRET,
  port: process.env.PORT || 5000,
});

if (String(process.env.EMAIL_ENABLED).toLowerCase() === "true") {
  const missingMail = ["GMAIL_USER", "GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN"]
    .filter((k) => !process.env[k]);
  if (missingMail.length) console.warn(`EMAIL_ENABLED is true but missing: ${missingMail.join(", ")}`);
}
