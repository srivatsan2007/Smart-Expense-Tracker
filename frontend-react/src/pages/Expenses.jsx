import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import AuthPromptModal from '../components/AuthPromptModal.jsx';
import { notify } from '../components/Toast.jsx';
import { getAuthHeaders } from '../hooks/useAuth.js';
import { formatINR, formatDate, CATEGORY_COLORS } from '../utils/formatters.js';
import {
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Camera,
  ArrowUpDown,
  Receipt,
  CreditCard,
  CalendarCheck,
  Calendar,
  Sparkles,
  UserPlus,
  LogIn
} from '../components/Icons.jsx';

const DAILY_CATEGORIES = [
  'Grocery', 'Petrol', 'Milk', 'Medical', 'Shopping',
  'Entertainment', 'Travel', 'Others'
];

const MONTHLY_CATEGORIES = [
  'Rent', 'EMI', 'Electricity', 'Water Bill', 'Internet',
  'Education', 'Home Tax', 'Insurance', 'Subscriptions', 'Others'
];

const ALL_CATEGORIES = [
  'Medical', 'Petrol', 'Grocery', 'Milk', 'Education', 'Home Tax',
  'Electricity', 'Water Bill', 'Internet', 'Rent', 'EMI', 'Shopping',
  'Entertainment', 'Travel', 'Insurance', 'Subscriptions', 'Others',
];

const PAYMENT_METHODS = ['Cash', 'Credit Card', 'Debit Card', 'UPI', 'Net Banking'];

const initialForm = () => {
  const p = new URLSearchParams(window.location.search);
  const ocrAmount = localStorage.getItem('ocr_amount') || '';
  const ocrDate = localStorage.getItem('ocr_date') || '';
  if (ocrAmount) localStorage.removeItem('ocr_amount');
  if (ocrDate) localStorage.removeItem('ocr_date');
  return {
    amount: p.get('amount') || ocrAmount,
    category: p.get('category') || 'Grocery',
    date: p.get('date') || ocrDate || new Date().toISOString().split('T')[0],
    paymentMethod: 'UPI',
    description: p.get('description') || '',
    expenseType: 'daily', // 'daily' or 'monthly'
    isMonthly: false
  };
};

export default function Expenses() {
  const navigate = useNavigate();
  const isLoggedIn = Boolean(localStorage.getItem('token'));

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  // View Mode: 'both' (two-side dual view), 'daily', or 'monthly'
  const [viewMode, setViewMode] = useState('both');

  // Form & Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm());

  // Delete confirmation
  const [deleteId, setDeleteId] = useState(null);

  // Auth prompt modal state for guests
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [authPromptAction, setAuthPromptAction] = useState('add an expense');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedMethod, setSelectedMethod] = useState('ALL');
  const [sortBy, setSortBy] = useState('date-desc');

  const fetchExpenses = async () => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/expenses', { headers: getAuthHeaders() });
      if (res.ok) {
        setExpenses(await res.json());
      } else {
        notify('Failed to load expenses', 'error');
      }
    } catch {
      notify('Network error loading expenses', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const openAddDailyModal = () => {
    if (!isLoggedIn) {
      setAuthPromptAction('log daily expenses');
      setAuthPromptOpen(true);
      return;
    }
    setEditingId(null);
    setForm({
      amount: '',
      category: 'Grocery',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'UPI',
      description: '',
      expenseType: 'daily',
      isMonthly: false
    });
    setModalOpen(true);
  };

  const openAddMonthlyModal = () => {
    if (!isLoggedIn) {
      setAuthPromptAction('record monthly recurring expenses');
      setAuthPromptOpen(true);
      return;
    }
    setEditingId(null);
    setForm({
      amount: '',
      category: 'Rent',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'UPI',
      description: '',
      expenseType: 'monthly',
      isMonthly: true
    });
    setModalOpen(true);
  };

  const openEditModal = (exp) => {
    if (!isLoggedIn) {
      setAuthPromptAction('edit this expense');
      setAuthPromptOpen(true);
      return;
    }
    const isM = exp.expenseType === 'monthly' || exp.isMonthly === true;
    setEditingId(exp._id);
    setForm({
      amount: exp.amount,
      category: exp.category || 'Grocery',
      date: exp.date ? new Date(exp.date).toISOString().split('T')[0] : '',
      paymentMethod: exp.paymentMethod || 'UPI',
      description: exp.description || '',
      expenseType: isM ? 'monthly' : 'daily',
      isMonthly: isM
    });
    setModalOpen(true);
  };

  const promptDelete = (id) => {
    if (!isLoggedIn) {
      setAuthPromptAction('delete an expense');
      setAuthPromptOpen(true);
      return;
    }
    setDeleteId(id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoggedIn) {
      setModalOpen(false);
      setAuthPromptOpen(true);
      return;
    }

    try {
      const payload = {
        ...form,
        isMonthly: form.expenseType === 'monthly'
      };

      if (editingId) {
        // Edit expense
        const res = await fetch(`/api/expenses/${editingId}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          notify('Expense updated successfully!');
          setModalOpen(false);
          fetchExpenses();
        } else {
          notify('Failed to update expense', 'error');
        }
      } else {
        // Create expense
        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const saved = await res.json().catch(() => ({}));
          notify(saved.archivedMonth
            ? 'Saved to your Monthly History (it belongs to a past month)'
            : form.expenseType === 'monthly' ? 'Monthly expense recorded!' : 'Daily expense logged successfully!');
          setModalOpen(false);
          fetchExpenses();
        } else {
          notify('Failed to add expense', 'error');
        }
      }
    } catch {
      notify('An error occurred', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/expenses/${deleteId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        notify('Expense deleted');
        setDeleteId(null);
        fetchExpenses();
      } else {
        notify('Failed to delete expense', 'error');
      }
    } catch {
      notify('Error deleting expense', 'error');
    }
  };

  // Filtered & Sorted list
  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((e) => {
        const matchesCat = selectedCategory === 'ALL' || e.category === selectedCategory;
        const matchesMethod = selectedMethod === 'ALL' || e.paymentMethod === selectedMethod;
        const query = searchQuery.toLowerCase().trim();
        const matchesQuery =
          !query ||
          (e.description && e.description.toLowerCase().includes(query)) ||
          (e.category && e.category.toLowerCase().includes(query)) ||
          (e.paymentMethod && e.paymentMethod.toLowerCase().includes(query));
        return matchesCat && matchesMethod && matchesQuery;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') return new Date(b.date) - new Date(a.date);
        if (sortBy === 'date-asc') return new Date(a.date) - new Date(b.date);
        if (sortBy === 'amount-desc') return Number(b.amount || 0) - Number(a.amount || 0);
        if (sortBy === 'amount-asc') return Number(a.amount || 0) - Number(b.amount || 0);
        return 0;
      });
  }, [expenses, searchQuery, selectedCategory, selectedMethod, sortBy]);

  // Split into Daily Expenses vs Monthly Expenses
  const dailyExpenses = useMemo(() => {
    return filteredExpenses.filter(e => {
      if (e.expenseType) return e.expenseType === 'daily';
      if (e.isMonthly !== undefined) return !e.isMonthly;
      return true; // Default to daily
    });
  }, [filteredExpenses]);

  const monthlyExpenses = useMemo(() => {
    return filteredExpenses.filter(e => {
      if (e.expenseType) return e.expenseType === 'monthly';
      return e.isMonthly === true;
    });
  }, [filteredExpenses]);

  const totalFiltered = filteredExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const totalDaily = dailyExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const totalMonthly = monthlyExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);

  // Helper renderer for an expense table
  const renderExpenseTable = (list, typeName, onAddClick) => {
    if (list.length === 0) {
      return (
        <div style={{ padding: '36px 20px', textAlign: 'center' }}>
          <EmptyState
            icon={Receipt}
            title={`No ${typeName.toLowerCase()} recorded`}
            description={`Log your ${typeName.toLowerCase()} details to track them separately.`}
            action={
              <button className="btn btn-primary" onClick={onAddClick} style={{ gap: 6 }}>
                <Plus size={16} />
                <span>Add {typeName}</span>
              </button>
            }
          />
        </div>
      );
    }

    return (
      <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Method</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th style={{ textAlign: 'center', width: 80 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((exp) => {
              const catColor = CATEGORY_COLORS[exp.category] || 'var(--primary-color)';
              return (
                <tr key={exp._id}>
                  <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                    {formatDate(exp.date)}
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: `${catColor}15`,
                        color: catColor,
                        border: `1px solid ${catColor}30`,
                        fontSize: '0.74rem'
                      }}
                    >
                      {exp.category}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500, fontSize: '0.85rem' }}>
                    {exp.description || <span style={{ color: 'var(--text-muted)' }}>-</span>}
                  </td>
                  <td>
                    <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                      <CreditCard size={11} /> {exp.paymentMethod || 'Cash'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger-color)', whiteSpace: 'nowrap' }}>
                    -{formatINR(exp.amount)}
                  </td>
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: 6, minHeight: 0 }}
                      onClick={() => openEditModal(exp)}
                      title="Edit"
                    >
                      <Edit2 size={15} color="var(--primary-color)" />
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: 6, minHeight: 0 }}
                      onClick={() => promptDelete(exp._id)}
                      title="Delete"
                    >
                      <Trash2 size={15} color="var(--danger-color)" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <Layout title="Expenses (Daily & Monthly) - RupeeRise">
      <div className="dashboard-grid">
        <PageHeader
          title="Expenses & Transactions"
          description="Manage your day-to-day purchases and monthly recurring commitments in dedicated views."
          actions={
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link to="/reports" className="btn btn-secondary">
                <Camera size={18} />
                <span>Scan Receipt</span>
              </Link>
              <button className="btn btn-secondary" onClick={openAddDailyModal} style={{ gap: 6 }}>
                <Plus size={16} />
                <span>+ Daily Expense</span>
              </button>
              <button className="btn btn-primary" onClick={openAddMonthlyModal} style={{ gap: 6 }}>
                <Plus size={16} />
                <span>+ Monthly Expense</span>
              </button>
            </div>
          }
        />

        {/* Guest Mode Notice Banner */}
        {!isLoggedIn && (
          <div
            style={{
              padding: '12px 18px',
              borderRadius: 12,
              background: 'rgba(53, 94, 59, 0.08)',
              border: '1px solid rgba(53, 94, 59, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'var(--color-primary, #355E3B)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <strong style={{ color: 'var(--color-forest, #1F3328)', fontSize: '0.88rem' }}>
                  Guest Explorer Mode
                </strong>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted, #5f7566)' }}>
                  Sign in or create an account to save and track your daily and monthly expenses securely.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '6px 14px', height: 'auto' }}
                onClick={() => navigate('/login')}
              >
                Sign In
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: '6px 14px', height: 'auto' }}
                onClick={() => navigate('/register')}
              >
                Create Account
              </button>
            </div>
          </div>
        )}

        {/* Top Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {/* Overall Total */}
          <div className="glass-card" style={{ padding: '16px 20px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Expenses
            </span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--danger-color)', marginTop: 4 }}>
              {formatINR(totalFiltered)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Across {filteredExpenses.length} total transaction(s)
            </div>
          </div>

          {/* Daily Expenses Side Summary */}
          <div
            className="glass-card"
            style={{
              padding: '16px 20px',
              borderLeft: '4px solid #355E3B',
              cursor: 'pointer',
              background: viewMode === 'daily' ? 'rgba(53, 94, 59, 0.05)' : 'var(--card-bg)'
            }}
            onClick={() => setViewMode(viewMode === 'daily' ? 'both' : 'daily')}
            title="Click to toggle Daily Expenses view"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-primary)', fontWeight: 700, textTransform: 'uppercase' }}>
                📅 Daily Expenses
              </span>
              <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                {dailyExpenses.length} items
              </span>
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--color-forest)', marginTop: 4 }}>
              {formatINR(totalDaily)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Day-to-day shopping, fuel & food
            </div>
          </div>

          {/* Monthly Expenses Side Summary */}
          <div
            className="glass-card"
            style={{
              padding: '16px 20px',
              borderLeft: '4px solid #3D8B50',
              cursor: 'pointer',
              background: viewMode === 'monthly' ? 'rgba(61, 139, 80, 0.05)' : 'var(--card-bg)'
            }}
            onClick={() => setViewMode(viewMode === 'monthly' ? 'both' : 'monthly')}
            title="Click to toggle Monthly Expenses view"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: '#3D8B50', fontWeight: 700, textTransform: 'uppercase' }}>
                🗓️ Monthly Expenses
              </span>
              <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                {monthlyExpenses.length} items
              </span>
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--color-forest)', marginTop: 4 }}>
              {formatINR(totalMonthly)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Rent, EMIs, utilities & subscriptions
            </div>
          </div>
        </div>

        {/* View Switcher Pill & Filters */}
        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            {/* Two-Side Segmented View Switcher */}
            <div
              style={{
                display: 'inline-flex',
                background: 'var(--bg-main, #f6faf2)',
                padding: 4,
                borderRadius: 12,
                border: '1px solid var(--border-color, #d1e2cb)',
                gap: 4
              }}
            >
              <button
                type="button"
                style={{
                  padding: '7px 14px',
                  borderRadius: 9,
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: viewMode === 'both' ? 'var(--color-primary, #355E3B)' : 'transparent',
                  color: viewMode === 'both' ? '#ffffff' : 'var(--color-forest, #1F3328)',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setViewMode('both')}
              >
                ↔️ Two-Side View
              </button>

              <button
                type="button"
                style={{
                  padding: '7px 14px',
                  borderRadius: 9,
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: viewMode === 'daily' ? 'var(--color-primary, #355E3B)' : 'transparent',
                  color: viewMode === 'daily' ? '#ffffff' : 'var(--color-forest, #1F3328)',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setViewMode('daily')}
              >
                📅 Daily Expenses ({dailyExpenses.length})
              </button>

              <button
                type="button"
                style={{
                  padding: '7px 14px',
                  borderRadius: 9,
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: viewMode === 'monthly' ? 'var(--color-primary, #355E3B)' : 'transparent',
                  color: viewMode === 'monthly' ? '#ffffff' : 'var(--color-forest, #1F3328)',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setViewMode('monthly')}
              >
                🗓️ Monthly Expenses ({monthlyExpenses.length})
              </button>
            </div>

            {/* Quick Search */}
            <div style={{ position: 'relative', minWidth: 240, flex: '1 1 200px' }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                className="form-control"
                placeholder="Search description, category..."
                style={{ paddingLeft: 36, paddingRight: 10, fontSize: '0.84rem' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Filters Row */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
            <div style={{ minWidth: 150 }}>
              <select
                className="form-control"
                style={{ fontSize: '0.82rem' }}
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="ALL">All Categories</option>
                {ALL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ minWidth: 140 }}>
              <select
                className="form-control"
                style={{ fontSize: '0.82rem' }}
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
              >
                <option value="ALL">All Methods</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ minWidth: 160 }}>
              <select
                className="form-control"
                style={{ fontSize: '0.82rem' }}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="date-desc">Date (Newest first)</option>
                <option value="date-asc">Date (Oldest first)</option>
                <option value="amount-desc">Amount (High to Low)</option>
                <option value="amount-asc">Amount (Low to High)</option>
              </select>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TWO-SIDE DUAL VIEW OR FOCUSED TABS                            */}
        {/* ------------------------------------------------------------- */}
        {viewMode === 'both' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
              gap: 20,
              alignItems: 'start'
            }}
          >
            {/* SIDE 1: DAILY EXPENSES */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '16px 20px',
                  background: 'rgba(53, 94, 59, 0.05)',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8
                }}
              >
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--color-forest)' }}>
                    📅 Daily Expenses
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Total: <strong>{formatINR(totalDaily)}</strong> ({dailyExpenses.length} items)
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '6px 12px', height: 'auto' }}
                  onClick={openAddDailyModal}
                >
                  <Plus size={14} />
                  <span>Add Daily</span>
                </button>
              </div>

              {renderExpenseTable(dailyExpenses, 'Daily Expense', openAddDailyModal)}
            </div>

            {/* SIDE 2: MONTHLY EXPENSES */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '16px 20px',
                  background: 'rgba(61, 139, 80, 0.05)',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8
                }}
              >
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--color-forest)' }}>
                    🗓️ Monthly Expenses
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Total: <strong>{formatINR(totalMonthly)}</strong> ({monthlyExpenses.length} items)
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontSize: '0.78rem', padding: '6px 12px', height: 'auto' }}
                  onClick={openAddMonthlyModal}
                >
                  <Plus size={14} />
                  <span>Add Monthly</span>
                </button>
              </div>

              {renderExpenseTable(monthlyExpenses, 'Monthly Expense', openAddMonthlyModal)}
            </div>
          </div>
        ) : viewMode === 'daily' ? (
          /* FOCUSED DAILY EXPENSES VIEW */
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '16px 20px',
                background: 'rgba(53, 94, 59, 0.05)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--color-forest)' }}>
                  📅 Daily Expenses
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Total: <strong>{formatINR(totalDaily)}</strong> ({dailyExpenses.length} items)
                </span>
              </div>
              <button className="btn btn-primary" onClick={openAddDailyModal}>
                <Plus size={16} />
                <span>Add Daily Expense</span>
              </button>
            </div>
            {renderExpenseTable(dailyExpenses, 'Daily Expense', openAddDailyModal)}
          </div>
        ) : (
          /* FOCUSED MONTHLY EXPENSES VIEW */
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '16px 20px',
                background: 'rgba(61, 139, 80, 0.05)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--color-forest)' }}>
                  🗓️ Monthly Expenses
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Total: <strong>{formatINR(totalMonthly)}</strong> ({monthlyExpenses.length} items)
                </span>
              </div>
              <button className="btn btn-primary" onClick={openAddMonthlyModal}>
                <Plus size={16} />
                <span>Add Monthly Expense</span>
              </button>
            </div>
            {renderExpenseTable(monthlyExpenses, 'Monthly Expense', openAddMonthlyModal)}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ADD / EDIT EXPENSE MODAL WITH DUAL TYPE SELECTION              */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingId
            ? form.expenseType === 'monthly' ? 'Edit Monthly Expense' : 'Edit Daily Expense'
            : form.expenseType === 'monthly' ? 'Add Monthly Expense' : 'Add Daily Expense'
        }
      >
        <form onSubmit={handleSubmit}>
          {/* Side / Type Selection Toggle */}
          <div style={{ marginBottom: 18 }}>
            <label className="form-label" style={{ marginBottom: 6, display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>
              Expense Side / Allocation
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                background: 'var(--bg-main, #f6faf2)',
                padding: 4,
                borderRadius: 10,
                border: '1px solid var(--border-color, #d1e2cb)'
              }}
            >
              <button
                type="button"
                style={{
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: form.expenseType === 'daily' ? 'var(--color-primary, #355E3B)' : 'transparent',
                  color: form.expenseType === 'daily' ? '#ffffff' : 'var(--color-forest, #1F3328)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
                onClick={() => setForm({ ...form, expenseType: 'daily', isMonthly: false, category: 'Grocery' })}
              >
                <span>📅 Daily Expense</span>
              </button>

              <button
                type="button"
                style={{
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: form.expenseType === 'monthly' ? 'var(--color-primary, #355E3B)' : 'transparent',
                  color: form.expenseType === 'monthly' ? '#ffffff' : 'var(--color-forest, #1F3328)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
                onClick={() => setForm({ ...form, expenseType: 'monthly', isMonthly: true, category: 'Rent' })}
              >
                <span>🗓️ Monthly Expense</span>
              </button>
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #5f7566)', marginTop: 4, display: 'block' }}>
              {form.expenseType === 'monthly'
                ? 'Adds to your Monthly Expenses side (Rent, EMIs, utilities & recurring budget commitments).'
                : 'Adds to your Daily Expenses side (day-to-day purchases, groceries, fuel & dining).'}
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              required
              min="0.01"
              placeholder="0.00"
              className="form-control"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Category *</label>
            <select
              className="form-control"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {form.expenseType === 'monthly' ? (
                <>
                  <optgroup label="Monthly Commitments">
                    {MONTHLY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Other Categories">
                    {DAILY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </optgroup>
                </>
              ) : (
                <>
                  <optgroup label="Daily Categories">
                    {DAILY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Monthly / Fixed Categories">
                    {MONTHLY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </optgroup>
                </>
              )}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Date *</label>
            <input
              type="date"
              required
              className="form-control"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <select
              className="form-control"
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Description (Optional)</label>
            <input
              type="text"
              placeholder={form.expenseType === 'monthly' ? 'e.g. 2BHK Apartment Rent or Jio Fiber' : 'e.g. Supermarket grocery or petrol'}
              className="form-control"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              {editingId ? 'Save Changes' : form.expenseType === 'monthly' ? 'Record Monthly Expense' : 'Record Daily Expense'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        title="Confirm Deletion"
        maxWidth={420}
      >
        <p style={{ marginBottom: 20, color: 'var(--text-color)', lineHeight: 1.5 }}>
          Are you sure you want to permanently delete this expense? This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={handleDelete}>
            Delete Expense
          </button>
        </div>
      </Modal>

      {/* Auth Prompt Modal for Guests */}
      <AuthPromptModal
        isOpen={authPromptOpen}
        onClose={() => setAuthPromptOpen(false)}
        actionName={authPromptAction}
      />
    </Layout>
  );
}
