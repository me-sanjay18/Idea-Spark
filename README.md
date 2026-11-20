# IdeaSpark — Idea Sharing & Collaboration Platform

> **"Don't Just Have an Idea. Build It Together."**

IdeaSpark is a full-stack SaaS platform where innovators, students, software developers, designers, and startup founders share ideas with practical intellectual-property safeguards, discover high-impact concepts, and form real execution teams inside private workspaces.

---

## Key Features

1. **Authentication & Account Security**
   - Registration & login with `bcryptjs` password hashing (cost 12) and HTTP-only JWT session cookies.
   - Double-submit HMAC CSRF token verification (`X-CSRF-Token`), login & reset rate limiting, and session invalidation (`tokenVersion`) on password changes or moderation actions.
   - Email verification, forgot/reset password via Nodemailer (with automatic dev preview links when SMTP is not configured), and optional GitHub OAuth 2.0.
   - Rich builder profiles (avatar upload via Cloudinary or local fallback, skills, interests, bio, GitHub/LinkedIn/portfolio links), user blocking, security activity log, and permanent account deletion.

2. **Idea Publishing & Multi-Tier Privacy**
   - **Public**: Discoverable in Explore feeds; confidential sections can still be locked behind an NDA acknowledgement.
   - **Unlisted**: Hidden from public feeds and search; accessible only via a rotatable `shareToken` link.
   - **Private**: Strictly restricted to the creator, accepted team collaborators, and explicitly authorized users.
   - Immutable `ideaCode` (`ISP-XXXXXXXX`), original creation timestamps, full `editHistory`, `ownershipHistory`, and `AuditLog` entries.

3. **Confidentiality & NDA Records**
   - Creators can require a versioned Confidentiality / NDA acknowledgement—and optionally upload a custom NDA PDF—before revealing `proposedSolution`, `detailedDescription`, and protected attachments.
   - Records `Agreement` version, signer legal name, user ID, idea ID, hashed IP, user agent, and timestamp.
   - *Legal transparency*: IdeaSpark clearly communicates that in-app checkboxes and timestamps provide practical access control and auditability, whereas formal legal IP protection depends on applicable law and executed agreements.

4. **Discovery, Upvotes & Bookmarks**
   - Search by title/keywords, filter by category, required skill, and project stage (`concept`, `validation`, `prototype`, `mvp`, `launched`), and sort by `newest`, `popular`, or `collaborative`.

5. **Collaboration System & Private Workspaces**
   - Applicants submit their desired role, skills, relevant experience, contribution plan, and confidentiality commitment.
   - Accepting a collaborator automatically provisions a **Collaboration Workspace** with team member role management, progress milestones, standup updates, and a private team group chat.

6. **Real-Time Messaging & Notifications (Socket.IO)**
   - Live 1:1 and team group conversations with typing indicators, message timestamps, and read receipts.
   - Strict anti-spam boundary: strangers cannot cold-message members of private projects.
   - Real-time notification dropdown and dedicated `/notifications` center.

7. **Reporting, Moderation & Admin Dashboard**
   - Report copied/stolen ideas or abusive accounts with supporting evidence links.
   - Role-gated `/admin` console to monitor platform statistics, review reports, remove violating content, suspend/ban/activate users, manage categories, and audit moderation logs.

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19 (Vite 6), Tailwind CSS v4, React Router DOM v7, Axios, Lucide React, React Hook Form, Socket.IO Client |
| **Backend** | Node.js, Express.js, REST API, Socket.IO, JSON Web Tokens (HTTP-only cookies), Zod, Helmet, Express Rate Limit, Multer |
| **Database** | MongoDB + Mongoose ODM (with automatic `mongodb-memory-server` fallback for zero-config local evaluation & tests) |
| **Integrations** | Cloudinary (uploads), Nodemailer (email verification & password reset), GitHub OAuth 2.0 |

---

## Project Setup Instructions

### Prerequisites
- **Node.js** `>= 18.0.0` and **npm**
- **MongoDB** (local `mongod` or MongoDB Atlas URI). *Note: In development mode, if local MongoDB is not running, the backend automatically boots an in-memory MongoDB instance seeded with sample categories and demo accounts so you can evaluate the platform immediately.*

### 1. Clone & Install Dependencies

```bash
# Install backend packages
npm install --prefix backend

# Install frontend packages
npm install --prefix frontend
```

### 2. Environment Configuration

Copy `.env.example` in both `backend/` and `frontend/` and customize values as needed:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Never commit real `.env` files or production secrets.

### 3. Database Setup & Seeding

- **Local MongoDB or Atlas**: Set `MONGO_URI` in `backend/.env` (for example `mongodb://127.0.0.1:27017/ideaspark` or `mongodb+srv://...`).
- **Seed Default Categories & Demo Accounts** (optional):
  ```bash
  npm run seed
  ```

### 4. Start Development Servers

Open two terminals from the project root:

```bash
# Terminal 1 — Start Backend API & Socket.IO (http://localhost:5000)
npm run dev:backend

# Terminal 2 — Start Frontend Vite Dev Server (http://localhost:5173)
npm run dev:frontend
```

Open `http://localhost:5173` in your browser.

---

## Automated Tests

Run the backend security, authentication, privacy, collaboration, and admin RBAC test suite:

```bash
npm test
```

Covered test suites (`backend/tests/`):
- `auth.test.js` — Registration, HTTP-only cookies, email verification, CSRF token enforcement, NoSQL injection prevention, password reset & session revocation.
- `ideas.security.test.js` — Private idea isolation, unlisted `shareToken` enforcement, NDA redaction & unlocking, ownership edit/delete permissions, and audit history.
- `collaborations.test.js` — Collaboration request flow, automatic workspace & team chat creation, milestone tracking, and stranger DM blocking.
- `admin.test.js` — Admin RBAC enforcement, frontend role-spoofing prevention, report resolution, content removal, user suspension, and category CRUD.

---

## REST API Overview

| Module | Base Path | Key Endpoints |
| :--- | :--- | :--- |
| **Auth** | `/api/auth` | `POST /register`, `POST /login`, `POST /logout`, `GET /me`, `POST /verify-email`, `POST /resend-verification`, `POST /forgot-password`, `POST /reset-password`, `POST /change-password`, `GET /github` |
| **Users** | `/api/users` | `GET /dashboard`, `GET /profile/:idOrUsername`, `PATCH /me`, `POST /me/avatar`, `GET /me/security`, `POST /:id/block`, `DELETE /:id/block`, `DELETE /me` |
| **Ideas** | `/api/ideas` | `GET /landing`, `GET /categories`, `GET /`, `GET /mine`, `POST /`, `POST /upload`, `GET /:id`, `PUT /:id`, `PATCH /:id/access`, `DELETE /:id`, `POST /:id/nda`, `GET /:id/records`, `POST /:id/vote` |
| **Collaborations** | `/api/collaborations` | `GET /requests`, `POST /requests`, `PATCH /requests/:requestId/respond`, `PATCH /requests/:requestId/withdraw`, `GET /`, `GET /:id`, `POST /:id/milestones`, `PATCH /:id/milestones/:milestoneId`, `POST /:id/updates`, `PATCH /:id/members/:memberUserId` |
| **Messages** | `/api/messages` | `GET /conversations`, `POST /conversations/direct`, `GET /conversations/:conversationId/messages`, `POST /conversations/:conversationId/messages`, `PATCH /conversations/:conversationId/read` |
| **Notifications** | `/api/notifications` | `GET /`, `PATCH /read-all`, `PATCH /:id/read`, `DELETE /:id` |
| **Bookmarks** | `/api/bookmarks` | `GET /`, `POST /:ideaId`, `DELETE /:ideaId` |
| **Reports** | `/api/reports` | `POST /`, `GET /mine` |
| **Admin** | `/api/admin` | `GET /overview`, `GET /users`, `PATCH /users/:userId/status`, `GET /reports`, `PATCH /reports/:reportId`, `DELETE /ideas/:ideaId`, `GET /categories`, `POST /categories`, `GET /logs` |

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for full cloud deployment instructions.

