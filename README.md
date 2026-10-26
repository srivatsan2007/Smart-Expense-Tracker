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
- **📄 Audit-Ready PDF & Excel Reports**: Cryptographically signed statements with QR verification and date range filtering.
- **🔗 Encrypted QR Split Receipts**: Real-time digital receipts verified by cloud Firestore.
- **🔒 Secure Authentication**: Robust JWT auth with Administrator controls and User profiles.

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

## 👨‍💻 Author
**Srivatsan R**
- GitHub: [@srivatsan2007](https://github.com/srivatsan2007)
