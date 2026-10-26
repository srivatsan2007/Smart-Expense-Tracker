import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

const Bills = lazy(() => import('./pages/Bills.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Expenses = lazy(() => import('./pages/Expenses.jsx'));
const Index = lazy(() => import('./pages/Index.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const QrGenerator = lazy(() => import('./pages/QrGenerator.jsx'));
const QrScanner = lazy(() => import('./pages/QrScanner.jsx'));
const Receipt = lazy(() => import('./pages/Receipt.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Salary = lazy(() => import('./pages/Salary.jsx'));
const SavingsGoals = lazy(() => import('./pages/SavingsGoals.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));

import SplashScreen from './components/SplashScreen.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

function RouteLoading() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
      }}
    >
      <div className="loading-spinner" style={{ width: 36, height: 36 }} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SplashScreen />
      <ErrorBoundary>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
          {/* Main Clean SPA Routes */}
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/bills" element={<Bills />} />
          <Route path="/salary" element={<Salary />} />
          <Route path="/savings-goals" element={<SavingsGoals />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/qr-generator" element={<QrGenerator />} />
          <Route path="/qr-scanner" element={<QrScanner />} />
          <Route path="/receipt" element={<Receipt />} />

          {/* Automatic Redirects from legacy .html URLs to modern clean SPA URLs */}
          <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
          <Route path="/admin.html" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard.html" element={<Navigate to="/dashboard" replace />} />
          <Route path="/expenses.html" element={<Navigate to="/expenses" replace />} />
          <Route path="/bills.html" element={<Navigate to="/bills" replace />} />
          <Route path="/salary.html" element={<Navigate to="/salary" replace />} />
          <Route path="/savings-goals.html" element={<Navigate to="/savings-goals" replace />} />
          <Route path="/reports.html" element={<Navigate to="/reports" replace />} />
          <Route path="/settings.html" element={<Navigate to="/settings" replace />} />
          <Route path="/index.html" element={<Navigate to="/" replace />} />
          <Route path="/login.html" element={<Navigate to="/login" replace />} />
          <Route path="/register.html" element={<Navigate to="/register" replace />} />
          <Route path="/qr-generator.html" element={<Navigate to="/qr-generator" replace />} />
          <Route path="/qr-scanner.html" element={<Navigate to="/qr-scanner" replace />} />
          <Route path="/receipt.html" element={<Navigate to="/receipt" replace />} />

          <Route path="*" element={<Index />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
