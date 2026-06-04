# 🚀 Smart Expense Tracker

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-Backend-green.svg)
![Firebase](https://img.shields.io/badge/Firebase-Database-orange.svg)
![Status](https://img.shields.io/badge/Status-Live_on_Render-brightgreen.svg)

A modern, responsive, mobile-first full-stack web application for tracking daily expenses, managing monthly salaries, and tracking savings goals. Featuring AI-powered OCR receipt scanning, dynamic PDF report generation, and real-time budget alerts.

---

## ✨ Features

- **📱 Mobile-First Fintech UI**: Glassmorphism design, fully responsive layout mimicking native applications.
- **📊 Interactive Dashboard**: Real-time charts (Chart.js) for expense visualization and category breakdowns.
- **📸 Smart Receipt Scanner**: AI-powered OCR to instantly extract amounts and dates from receipt images.
- **📄 Premium PDF Reports**: Client-side generation of high-quality, professional financial invoices with QR verification.
- **💳 Bill Reminders**: Keep track of recurring and upcoming bills so you never miss a payment.
- **🎯 Savings Goals**: Track progress against financial targets with dynamic progress bars.
- **🔒 Secure Authentication**: Powered by Firebase Auth for safe, encrypted user access.

---

## 📸 Screenshots

*(Replace the placeholder image links below by dragging and dropping your own screenshots into GitHub's editor)*

### Dashboard Overview
<img width="3839" height="1649" alt="Screenshot 2026-06-04 113503" src="https://github.com/user-attachments/assets/205febd6-d522-402a-a883-b2876021bc14" />
<img width="3839" height="1660" alt="Screenshot 2026-06-04 113442" src="https://github.com/user-attachments/assets/c398fe96-b15a-44fb-a60e-aa142bd0452d" />


### Expense 
<img width="3839" height="1649" alt="Screenshot 2026-06-04 113503" src="https://github.com/user-attachments/assets/62bc34f9-58f9-479e-a4a3-a9e9617f00f5" />


### Salary 
<img width="3839" height="1661" alt="Screenshot 2026-06-04 113511" src="https://github.com/user-attachments/assets/1a87c610-6d04-45f1-b217-dde01e5b55e5" />

### Reports
<img width="3839" height="1665" alt="Screenshot 2026-06-04 113558" src="https://github.com/user-attachments/assets/2f9a0c1b-738e-4a50-bc55-180b059c5989" />
<img width="3839" height="1663" alt="Screenshot 2026-06-04 113541" src="https://github.com/user-attachments/assets/99b663f3-7d9c-441f-8eda-3bcb5268a45f" />
<img width="3839" height="1639" alt="Screenshot 2026-06-04 113527" src="https://github.com/user-attachments/assets/13a70fd3-5fad-4adf-baac-940cc0b97c17" />


---

## 🛠️ Technology Stack

**Frontend:**
- HTML5 & CSS3 (Fluid Typography, CSS Grid, Flexbox)
- Vanilla JavaScript (ES6+)
- **jsPDF & jsPDF-AutoTable** (for PDF rendering)
- **Chart.js** (for Data Visualization)
- **QRCode.js** (for verification links)

**Backend:**
- **Node.js** & **Express.js** (REST API)
- **Firebase Admin SDK** (Firestore Database connection)
- **Multer** (for OCR image uploads)
- **Tesseract.js** (for Optical Character Recognition)

**Deployment:**
- Hosted securely on **Render** (Node Web Service)

---

## 🚀 Local Development Setup

Follow these steps to run the project locally on your machine.

### Prerequisites
- Node.js installed (v16+)
- A Firebase project with a `firebaseServiceAccountKey.json` file.

### 1. Clone the Repository
```bash
git clone https://github.com/srivatsan2007/Smart-Expense-Tracker.git
cd Smart-Expense-Tracker
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory and add your secrets:
```env
JWT_SECRET=your_super_secret_key
```

Add your Firebase Admin SDK credentials to `backend/firebaseServiceAccountKey.json`.

### 4. Start the Server
```bash
npm start
```
The app will be available at `http://localhost:5000`.

---

## 👨‍💻 Author
**Srivatsan** 
- GitHub: [@srivatsan2007](https://github.com/srivatsan2007)
