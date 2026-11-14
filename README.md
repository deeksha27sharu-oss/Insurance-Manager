Insurance Manager

A full-stack insurance platform built with the MERN stack (React, Node.js/Express, MongoDB). Customers can browse and purchase policies, agents earn commissions, users can file claims, and multi-role approval workflows update in real time. 

The platform features secure JWT authentication, role-based access control (RBAC), real-time WebSocket updates, third-party API integration, and event-driven email automation using the Gmail API.

Key Features

-Policy Marketplace: Browse categories, view policies, and purchase coverage.
- Multi-Role Approval Workflow: Purchases flow through a technical review process before being handed off to a relationship agent.
- Automated Agent Assignment: Work is automatically assigned to the least-loaded agent, preferring agents on the same team.
- Commission System: Earn commissions based on policy category or custom agent rates, with a 3% override for Super Agents.
- Claims Management: Users can file claims, which are validated against the remaining coverage limit before acceptance.
- Real-Time Updates: Socket.IO pushes live status changes to user and role-specific dashboards.
- Email Automation: Event-driven email notifications sent via the Gmail API.
- Third-Party API: Merges local policies with data from an external insurance API.

Tech Stack

| Layer | Technology |
| :--- | :--- |
| Frontend | React, Context API, Hooks, React Router |
| Backend | Node.js, Express (REST API, ES Modules) |
| Database | MongoDB with Mongoose |
| Real-Time | Socket.IO (JWT-authenticated) |
| Auth | JWT Access & Refresh tokens, bcrypt |
| Integrations | Gmail API (OAuth2), External Insurance API (Axios) |

Roles & Permissions

The system implements Role-Based Access Control (RBAC) across 7 distinct roles:

| Role | Responsibility |
| :--- | :--- |
| `admin` | Full access, commission payouts, system management |
| `super_agent` | Team lead; earns a 3% override on team commissions |
| `captive_agent` | Sells policies, earns standard commissions |
| `independent_agent` | External agent with core selling capabilities |
| `technical_agent` | Reviews and approves/rejects policy purchases |
| `relationship_agent` | Handles post-approval customer relations |
| `user` | Buys policies, files claims, views personal dashboard |

Architecture & Workflows

Backend Structure (Layered)
- `models/`: Mongoose schemas
- `controllers/`: Request handlers
- `routes/`: Express routers
- `middleware/`: `requireAuth`, `requireRole` route protection
- `services/`: Email, commission, and auto-assignment logic
- `utils/`: Helpers (tokens, formatting)

Policy Purchase Workflow
1. User purchases policy.
2. Status: `Pending Technical Review`.
3. Technical Agent reviews → `Approved` or `Rejected`.
4. If approved, auto-assigned to a `Relationship Agent`.

Commission System
- Calculated per policy category or by custom agent rate.
- Super Agents receive a 3% team override.
- Admins can process bulk or per-policy payouts with an audit trail.

Email Automation (Gmail API)

The platform uses the **Gmail API** with OAuth2 (least-privilege `gmail.send` scope) for reliable email delivery.

- **Event Triggers:** Signup, purchase, approval/rejection, claim filed/reviewed, commission paid, agent creation.
- **Non-Blocking:** Sent "fire and forget" so email failures never break the main HTTP request.
- **Resilient:** Implements retry with exponential backoff for rate limits and server errors.
- **Scheduled Jobs:** Daily renewal reminders with a DB flag to prevent duplicate sends.
- **Secure:** HTML templates escape user input to prevent injection; secrets live in environment variables; toggleable via `EMAIL_ENABLED` feature flag.

Real-Time Architecture

Socket.IO connections are authenticated via JWT at the handshake. Clients join rooms by `user ID` and `role`. When a state change occurs (e.g., a policy is approved), the affected user and agents receive an instant dashboard update without needing to refresh.

Getting Started

Prerequisites
- Node.js (v18+)
- MongoDB (local or Atlas)
- Google Cloud Project (for Gmail API credentials)

1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/insurance-manager.git
cd insurance-manager
```

2. Install Dependencies
```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

3. Environment Variables

Create a `.env` file in the `server/` directory and add the following:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=your_mongodb_connection_string

# JWT Secrets
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret

# Gmail API Configuration
EMAIL_ENABLED=true
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REFRESH_TOKEN=your_refresh_token
GMAIL_SENDER_EMAIL=your_email@gmail.com

# External API
EXTERNAL_API_URL=your_external_api_url
EXTERNAL_API_KEY=your_external_api_key
```

Create a `.env` file in the `client/` directory:

```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

4. Run the Application

Open two terminals:

**Terminal 1 (Backend):**
```bash
cd server
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd client
npm start
```

The app will be available at `http://localhost:3000`.

Security Highlights
- **Auth:** Passwords hashed with `bcrypt` and hidden from API responses.
- **Tokens:** Short-lived JWT access tokens paired with a secure refresh flow.
- **Route Protection:** Every route is guarded by `requireAuth` and `requireRole` middleware.
- **WebSockets:** Socket connections are authenticated using the JWT.
- **OAuth Scopes:** Gmail integration strictly uses the `gmail.send` scope.
- **Data Sanitization:** Email templates escape user input to prevent HTML injection.
- **Secrets Management:** All sensitive keys are kept in `.env` files and excluded from version control.

Contributing
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

