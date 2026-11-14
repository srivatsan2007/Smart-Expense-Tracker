# 🚀 RupeeRise — Track Smarter. Save Better. Rise Higher.

<div align="center">
  <img src="frontend-react/public/images/rupeerise-logo.png" alt="RupeeRise Logo" width="140" style="border-radius: 28px; box-shadow: 0 10px 30px rgba(16, 185, 129, 0.25);" />
  <h3>Modern Personal Finance & Expense Intelligence Dashboard</h3>
  <p><em>Track Smarter. Save Better. Rise Higher.</em></p>
</div>

---

## ✨ Features

- **📱 RupeeRise Modern Fintech UI**: Clean SaaS dashboard with primary `#477FE0` & success `#10B981` accents, light/dark themes, and responsive design.
- **⚡ Native Animated Splash Screen**: Polished branded splash screen for the web app and PWA.
- **📊 Financial Analytics Dashboard**: Real-time spending charts, category breakdown donut, savings rate calculation, and Indian Rupee (`₹`) native formatting.
- **📸 Smart AI Receipt Scanner**: AI-powered OCR (Tesseract) to auto-extract store names, amounts, and transaction dates with editable review-to-save workflow.
- **🎯 Savings Goals**: Milestone targets with live countdowns, dynamic progress bars, and one-click contribution deposits.
- **💳 Bill Tracking & Reminders**: Overdue alerts, upcoming payment countdowns, and quick "Mark as Paid" action.
- **📄 Audit-Ready PDF & Excel Reports**: Statements digitally signed with SHA-256 + an X.509 certificate, with QR verification and date range filtering.
- **🔗 Signed QR Split Receipts**: Digital receipts stored in Firestore and digitally signed on the server.
- **🔒 Secure Authentication**: Robust Firebase Auth with JWT tokens and User profiles.
- **🗓️ Monthly Reset + History**: Salary & expenses start from zero every month; past months are archived with PDF / Excel download and QR sharing.
- **🖋️ Digital Signatures & Public Verification**: Tamper-evident statements/receipts (SHA-256 digest signed with RSA-2048), verifiable by anyone at `/verify/<id>`.

---

## 🛠️ Technology Stack

**Frontend:**
- **React.js (v18)** & **Vite** (Single Page Application architecture)
- **React Router DOM** (Client-side routing with clean SPA URLs)
- **Lucide Icons** (Consistent SVG icon design system)
- **jsPDF & jsPDF-AutoTable** (for PDF statement generation)
- **Chart.js** (for financial trend charts)
- **QRCode.js & Html5Qrcode** (for QR code generation and camera scanning)

**Backend:**
- **Node.js** & **Express.js** (REST API)
- **Firebase Admin SDK** (Firestore Database connection)
- **Multer** (for OCR receipt image uploads)
- **Tesseract.js** (for Optical Character Recognition)

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/srivatsan2007/Smart-Expense-Tracker.git
cd Smart-Expense-Tracker
```

### 2. Install Dependencies
```bash
npm install
cd frontend-react && npm install && cd ..
```

### 3. Environment Setup
Create a `.env` file in the root directory:
```env
JWT_SECRET=your_super_secret_jwt_key
PORT=5000
```
Place your Firebase Admin credentials in `backend/firebaseServiceAccountKey.json`.

### 4. Run Development Servers
```bash
# Start Backend Express Server
npm start

# In another terminal, start Frontend Vite Server
cd frontend-react && npm run dev
```

---

## 🗓️ Monthly Reset & History

On the first request of a new month (IST by default) the previous month's salary and expenses are:

1. copied into `monthlyArchives/{uid}_{YYYY-MM}` (totals, category breakdown, every entry), then
2. flagged `archived: true` so the Dashboard / Salary / Expenses pages start from zero.

Nothing is deleted, so signed statements keep verifying. It runs lazily (no cron), so it works on Render's free plan where the server sleeps. The first request after you deploy archives all older data into its months.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/archives`, `GET /api/archives/:YYYY-MM` | list months / one month in full |
| `GET /api/archives/:key/pdf`, `.../excel` | downloads |
| `POST /api/archives/:key/share` `{days: 1\|7\|30, includeDetails}` | create a QR link (default: totals only) |
| `GET /api/archives/:key/shares`, `DELETE /api/archives/:key/share/:token` | list / revoke links |
| `GET /api/shared/:token` | public read-only view behind the QR (expires, rate limited) |
| `GET /api/expenses?includeArchived=true` (same for salaries) | full history for Calendar / Reports |

Config: `APP_TIMEZONE` (default `Asia/Kolkata`) decides where the month boundary falls.
Test: `npm run test:rollover` (no Firebase needed).

Add to your Firestore rules (server-only collections):

```
match /monthlyArchives/{id} { allow read, write: if false; }
match /archiveShares/{id}   { allow read, write: if false; }
match /rolloverState/{id}   { allow read, write: if false; }
```

---

## 🖋️ Digital Signatures (SHA-256 + X.509 certificate)

Statements (PDF) and QR receipts are signed **on the server**; the private key never reaches the browser or the Android app.

```
payload ──canonical JSON──▶ SHA-256 digest ──signed with RSA private key──▶ signature
                                          └─ stored in Firestore `signedDocuments` (server-only)
```

| Step | What happens |
| --- | --- |
| Create | `POST /api/sign/report` / `POST /api/sign/receipt` (login required). The server recomputes totals from Firestore, signs, and returns a Doc ID + digest. |
| Print | The PDF shows Doc ID, digest, certificate fingerprint and a QR linking to `/verify/<DocID>?h=<digest>`. |
| Verify | `GET /api/verify/:docId` (public, rate limited) re-checks hash + signature against the certificate. Returns **valid**, **hash_mismatch** (document/QR edited) or **tampered** (database edited). Only a summary is returned — no user ID, no line items. |
| Certificate | `GET /api/verify/certificate` returns the public X.509 certificate so anyone can verify independently (e.g. with `openssl`). |

### Setup

```bash
npm install
npm run gen:cert        # creates backend/certs/signing.key.pem + signing.cert.pem (git-ignored)
npm run test:signature  # 21 tests, no Firebase needed
```

For production (Render) set `SIGN_PRIVATE_KEY` and `SIGN_CERT_PEM` to the base64 values printed by `npm run gen:cert`.
Keep the key private and **back it up**: if it is replaced, previously signed documents will no longer verify.

**Algorithm:** `SIGN_ALGO=sha256` (default). `sha1` is accepted only for legacy requirements — SHA-1 is broken for collision resistance.

**Firestore rules:** clients must not read or write the signature collection:

```
match /signedDocuments/{id} { allow read, write: if false; }  // the Admin SDK bypasses rules
```

The certificate is **self-signed**: signatures are cryptographically valid, but Adobe-style tools will say "unknown issuer" until you buy a CA-issued certificate or add yours as trusted.

---

## 👨‍💻 Author
**Srivatsan R**
- GitHub: [@srivatsan2007](https://github.com/srivatsan2007)
