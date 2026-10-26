import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
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
} from '../components/Icons.jsx';

const CATEGORIES = [
  'Medical', 'Petrol', 'Grocery', 'Milk', 'Education', 'Home Tax',
  'Electricity', 'Water Bill', 'Internet', 'Rent', 'EMI', 'Shopping',
  'Entertainment', 'Travel', 'Others',
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
  };
};

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form & Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // null for new, string id for editing
  const [form, setForm] = useState(initialForm());

  // Delete confirmation
  const [deleteId, setDeleteId] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedMethod, setSelectedMethod] = useState('ALL');
  const [sortBy, setSortBy] = useState('date-desc'); // date-desc | date-asc | amount-desc | amount-asc

  const fetchExpenses = async () => {
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

  const openAddModal = () => {
    setEditingId(null);
    setForm({
      amount: '',
      category: 'Grocery',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'UPI',
      description: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (exp) => {
    setEditingId(exp._id);
    setForm({
      amount: exp.amount,
      category: exp.category || 'Grocery',
      date: exp.date ? new Date(exp.date).toISOString().split('T')[0] : '',
      paymentMethod: exp.paymentMethod || 'UPI',
      description: exp.description || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        // Edit expense
        const res = await fetch(`/api/expenses/${editingId}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(form),
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
          body: JSON.stringify(form),
        });
        if (res.ok) {
          notify('Expense logged successfully!');
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

  const totalFiltered = filteredExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const avgFiltered = filteredExpenses.length > 0 ? totalFiltered / filteredExpenses.length : 0;

  return (
    <Layout title="Expenses - RupeeRise">
      <div className="dashboard-grid">
        <PageHeader
          title="Expenses & Transactions"
          description="Track, filter, and manage your day-to-day spending."
          actions={
            <div style={{ display: 'flex', gap: 10 }}>
              <Link to="/reports" className="btn btn-secondary">
                <Camera size={18} />
                <span>Scan Receipt</span>
              </Link>
              <button className="btn btn-primary" onClick={openAddModal}>
                <Plus size={18} />
                <span>Add Expense</span>
              </button>
            </div>
          }
        />

        {/* Filter Summary Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div className="glass-card" style={{ padding: '16px 20px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              FILTERED TOTAL
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--danger-color)', marginTop: 4 }}>
              {formatINR(totalFiltered)}
            </div>
          </div>
          <div className="glass-card" style={{ padding: '16px 20px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              TOTAL TRANSACTIONS
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-color)', marginTop: 4 }}>
              {filteredExpenses.length}
            </div>
          </div>
          <div className="glass-card" style={{ padding: '16px 20px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              AVERAGE TICKET
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary-color)', marginTop: 4 }}>
              {formatINR(avgFiltered)}
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search
                size={18}
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                className="form-control"
                placeholder="Search by description or category..."
                style={{ paddingLeft: 38 }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Category Filter */}
            <div style={{ minWidth: 160 }}>
              <select
                className="form-control"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="ALL">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method Filter */}
            <div style={{ minWidth: 150 }}>
              <select
                className="form-control"
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

            {/* Sort Dropdown */}
            <div style={{ minWidth: 160 }}>
              <select
                className="form-control"
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

        {/* Transactions Table */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          {filteredExpenses.length === 0 ? (
            <div style={{ padding: 32 }}>
              <EmptyState
                icon={Receipt}
                title="No expenses match your filter"
                description={expenses.length === 0 ? 'Start by logging your first expense!' : 'Try clearing your search query or category filters.'}
                action={
                  expenses.length === 0 && (
                    <button className="btn btn-primary" onClick={openAddModal}>
                      <Plus size={16} /> Log Expense
                    </button>
                  )
                }
              />
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Payment Method</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th style={{ textAlign: 'center', width: 90 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((exp) => {
                    const catColor = CATEGORY_COLORS[exp.category] || 'var(--primary-color)';
                    return (
                      <tr key={exp._id}>
                        <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {formatDate(exp.date)}
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              backgroundColor: `${catColor}15`,
                              color: catColor,
                              border: `1px solid ${catColor}30`,
                            }}
                          >
                            {exp.category}
                          </span>
                        </td>
                        <td style={{ fontWeight: 500 }}>
                          {exp.description || <span style={{ color: 'var(--text-muted)' }}>-</span>}
                        </td>
                        <td>
                          <span className="badge badge-neutral">
                            <CreditCard size={12} /> {exp.paymentMethod || 'Cash'}
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
                            title="Edit Expense"
                          >
                            <Edit2 size={16} color="var(--primary-color)" />
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: 6, minHeight: 0 }}
                            onClick={() => setDeleteId(exp._id)}
                            title="Delete Expense"
                          >
                            <Trash2 size={16} color="var(--danger-color)" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Expense Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Expense' : 'Log New Expense'}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="0.00"
              className="form-control"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Category</label>
            <select
              className="form-control"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              required
              className="form-control"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Payment Method</label>
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
            <label>Description (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Flight ticket to Mumbai"
              className="form-control"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              {editingId ? 'Save Changes' : 'Record Expense'}
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
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Confirm Deletion"
        maxWidth={420}
      >
        <p style={{ marginBottom: 20 }}>
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
    </Layout>
  );
}
