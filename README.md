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
<img src="https://via.placeholder.com/800x400.png?text=Dashboard+Screenshot+Here" width="800" alt="Dashboard View">

### Mobile Responsive Design
<img src="https://via.placeholder.com/300x600.png?text=Mobile+View+Here" width="300" alt="Mobile View">

### Premium PDF Generation
<img src="https://via.placeholder.com/800x400.png?text=PDF+Invoice+Screenshot+Here" width="800" alt="PDF Invoice">

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
