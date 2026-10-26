import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout.jsx';
import PageHeader from '../components/PageHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { notify } from '../components/Toast.jsx';
import { getAuthHeaders } from '../hooks/useAuth.js';
import { formatINR, formatDate } from '../utils/formatters.js';
import {
  CalendarCheck,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Trash2,
  Edit2,
  Check,
  CreditCard,
  RefreshCw,
} from '../components/Icons.jsx';

const CATEGORIES = [
  'Utilities', 'Internet/Phone', 'Rent/Mortgage', 'Insurance',
  'Credit Card', 'Subscriptions', 'Other',
];

const RECURRING_OPTIONS = [
  ['none', 'One-time Bill (No Recurring)'],
  ['weekly', 'Weekly'],
  ['monthly', 'Monthly'],
  ['yearly', 'Yearly'],
];

const emptyBillForm = {
  billName: '',
  amount: '',
  dueDate: new Date().toISOString().split('T')[0],
  category: 'Utilities',
  recurring: 'monthly',
};

export default function Bills() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyBillForm);

  // Confirmation modals
  const [deleteId, setDeleteId] = useState(null);
  const [payId, setPayId] = useState(null);

  // Filter
  const [filterTab, setFilterTab] = useState('all'); // all | pending | paid

  const fetchBills = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/bills', { headers: getAuthHeaders() });
      if (res.ok) {
        const list = await res.json();
        list.sort((a, b) => {
          if (a.status === 'pending' && b.status === 'paid') return -1;
          if (a.status === 'paid' && b.status === 'pending') return 1;
          return new Date(a.dueDate) - new Date(b.dueDate);
        });
        setBills(list);
      }
    } catch {
      notify('Error loading bills', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  // Compute bill summary stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats = useMemo(() => {
    let totalPending = 0;
    let dueSoonCount = 0;
    let overdueCount = 0;
    let paidThisMonth = 0;

    const currMonth = today.getMonth();
    const currYear = today.getFullYear();

    bills.forEach((b) => {
      const amt = Number(b.amount || 0);
      if (b.status === 'paid') {
        const pDate = new Date(b.paidDate || b.dueDate);
        if (pDate.getMonth() === currMonth && pDate.getFullYear() === currYear) {
          paidThisMonth += amt;
        }
      } else {
        totalPending += amt;
        const due = new Date(b.dueDate);
        due.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) overdueCount++;
        else if (diffDays <= 3) dueSoonCount++;
      }
    });

    return { totalPending, dueSoonCount, overdueCount, paidThisMonth };
  }, [bills]);

  const openAddModal = () => {
    setEditingId(null);
    setForm(emptyBillForm);
    setModalOpen(true);
  };

  const openEditModal = (b) => {
    setEditingId(b._id);
    setForm({
      billName: b.billName || '',
      amount: b.amount || '',
      dueDate: b.dueDate ? new Date(b.dueDate).toISOString().split('T')[0] : '',
      category: b.category || 'Utilities',
      recurring: b.recurring || 'none',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        const res = await fetch(`/api/bills/${editingId}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(form),
        });
        if (res.ok) {
          notify('Bill updated successfully!');
          setModalOpen(false);
          fetchBills();
        } else {
          notify('Failed to update bill', 'error');
        }
      } else {
        const res = await fetch('/api/bills', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(form),
        });
        if (res.ok) {
          notify('Bill reminder created!');
          setModalOpen(false);
          fetchBills();
        } else {
          notify('Failed to add bill', 'error');
        }
      }
    } catch {
      notify('An error occurred', 'error');
    }
  };

  const handleMarkAsPaid = async () => {
    if (!payId) return;
    try {
      const res = await fetch(`/api/bills/${payId}/pay`, {
        method: 'PUT',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        notify('Bill marked as paid! Next recurring bill created if applicable.');
        setPayId(null);
        fetchBills();
      } else {
        notify('Failed to mark as paid', 'error');
      }
    } catch {
      notify('An error occurred', 'error');
    }
  };

  const handleUnmarkPaid = async (id) => {
    if (!window.confirm('Reverse this payment? The bill will be restored to pending status.')) return;
    try {
      const res = await fetch(`/api/bills/${id}/unpay`, {
        method: 'PUT',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        notify('Payment reversed successfully! Bill restored to pending.');
        fetchBills();
      } else {
        notify('Failed to reverse payment', 'error');
      }
    } catch {
      notify('An error occurred', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/bills/${deleteId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        notify('Bill deleted');
        setDeleteId(null);
        fetchBills();
      } else {
        notify('Failed to delete bill', 'error');
      }
    } catch {
      notify('Error deleting bill', 'error');
    }
  };

  const filteredBills = bills.filter((b) => {
    if (filterTab === 'pending') return b.status !== 'paid';
    if (filterTab === 'paid') return b.status === 'paid';
    return true;
  });

  return (
    <Layout title="Bills - RupeeRise">
      <div className="dashboard-grid">
        <PageHeader
          title="Bill Reminders"
          description="Never miss a payment with automated schedules and due date tracking."
          actions={
            <button className="btn btn-primary" onClick={openAddModal}>
              <Plus size={18} />
              <span>Add Bill</span>
            </button>
          }
        />

        {/* Summary Stat Cards */}
        <div className="stat-grid">
          <StatCard
            title="Total Pending Bills"
            value={formatINR(stats.totalPending)}
            icon={CalendarCheck}
            iconColor="var(--primary-color)"
            iconBg="var(--primary-light)"
            badgeText={`${bills.filter((b) => b.status !== 'paid').length} Unpaid`}
            badgeType="primary"
          />

          <StatCard
            title="Due Soon (≤ 3 Days)"
            value={stats.dueSoonCount}
            icon={Clock}
            iconColor="#B45309"
            iconBg="rgba(245, 158, 11, 0.1)"
            badgeText={stats.dueSoonCount > 0 ? 'Action Needed' : 'No Immediate Bills'}
            badgeType={stats.dueSoonCount > 0 ? 'warning' : 'neutral'}
          />

          <StatCard
            title="Overdue Bills"
            value={stats.overdueCount}
            icon={AlertTriangle}
            iconColor="#EF4444"
            iconBg="rgba(239, 68, 68, 0.1)"
            badgeText={stats.overdueCount > 0 ? 'Urgent Attention' : 'Zero Overdue'}
            badgeType={stats.overdueCount > 0 ? 'danger' : 'success'}
          />

          <StatCard
            title="Paid This Month"
            value={formatINR(stats.paidThisMonth)}
            icon={CheckCircle2}
            iconColor="#10B981"
            iconBg="rgba(16, 185, 129, 0.1)"
            badgeText="Completed"
            badgeType="success"
          />
        </div>

        {/* Tab Filters */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {[
            { id: 'all', label: `All Bills (${bills.length})` },
            { id: 'pending', label: `Pending (${bills.filter((b) => b.status !== 'paid').length})` },
            { id: 'paid', label: `Paid (${bills.filter((b) => b.status === 'paid').length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`btn ${filterTab === tab.id ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              onClick={() => setFilterTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Bills Table */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          {filteredBills.length === 0 ? (
            <div style={{ padding: 32 }}>
              <EmptyState
                icon={CalendarCheck}
                title="No bills found"
                description={bills.length === 0 ? 'Add your recurring utility, rent, or subscription bills.' : 'No bills in this tab.'}
                action={
                  bills.length === 0 && (
                    <button className="btn btn-primary" onClick={openAddModal}>
                      <Plus size={16} /> Add First Bill
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
                    <th>Status</th>
                    <th>Bill Name</th>
                    <th>Due Date</th>
                    <th>Category</th>
                    <th>Recurring</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th style={{ textAlign: 'center', width: 140 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBills.map((bill) => {
                    const due = new Date(bill.dueDate);
                    due.setHours(0, 0, 0, 0);
                    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

                    let statusBadge;
                    if (bill.status === 'paid') {
                      statusBadge = <span className="badge badge-success">Paid</span>;
                    } else if (diffDays < 0) {
                      statusBadge = <span className="badge badge-danger">Overdue ({Math.abs(diffDays)}d)</span>;
                    } else if (diffDays === 0) {
                      statusBadge = <span className="badge badge-warning">Due Today</span>;
                    } else if (diffDays <= 3) {
                      statusBadge = <span className="badge badge-warning">Due Soon ({diffDays}d)</span>;
                    } else {
                      statusBadge = <span className="badge badge-primary">Pending ({diffDays}d)</span>;
                    }

                    return (
                      <tr key={bill._id} style={bill.status === 'paid' ? { opacity: 0.65 } : undefined}>
                        <td>{statusBadge}</td>
                        <td style={{ fontWeight: 600 }}>{bill.billName}</td>
                        <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {formatDate(bill.dueDate)}
                        </td>
                        <td>
                          <span className="badge badge-neutral">{bill.category}</span>
                        </td>
                        <td style={{ textTransform: 'capitalize' }}>
                          <span className="badge badge-neutral">{bill.recurring}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-color)', whiteSpace: 'nowrap' }}>
                          {formatINR(bill.amount)}
                        </td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {bill.status !== 'paid' ? (
                            <button
                              className="btn btn-success"
                              style={{ padding: '5px 10px', fontSize: '0.75rem', marginRight: 6, minHeight: 0 }}
                              onClick={() => setPayId(bill._id)}
                              title="Mark Bill as Paid"
                            >
                              <Check size={14} /> Pay
                            </button>
                          ) : (
                            <button
                              className="btn btn-ghost"
                              style={{ padding: '5px 8px', fontSize: '0.72rem', marginRight: 6, minHeight: 0, color: 'var(--text-muted)' }}
                              onClick={() => handleUnmarkPaid(bill._id)}
                              title="Reverse Payment"
                            >
                              <RefreshCw size={13} /> Reverse
                            </button>
                          )}
                          <button
                            className="btn btn-ghost"
                            style={{ padding: 6, minHeight: 0 }}
                            onClick={() => openEditModal(bill)}
                            title="Edit Bill"
                          >
                            <Edit2 size={16} color="var(--primary-color)" />
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: 6, minHeight: 0 }}
                            onClick={() => setDeleteId(bill._id)}
                            title="Delete Bill"
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

      {/* Add / Edit Bill Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Bill' : 'Add New Bill Reminder'}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Bill Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Electricity Bill"
              className="form-control"
              value={form.billName}
              onChange={(e) => setForm({ ...form, billName: e.target.value })}
            />
          </div>

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
            <label>Due Date</label>
            <input
              type="date"
              required
              className="form-control"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Category</label>
            <select
              className="form-control"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Recurring Frequency</label>
            <select
              className="form-control"
              value={form.recurring}
              onChange={(e) => setForm({ ...form, recurring: e.target.value })}
            >
              {RECURRING_OPTIONS.map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              {editingId ? 'Save Changes' : 'Save Bill'}
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

      {/* Confirm Mark as Paid Dialog */}
      <Modal
        isOpen={!!payId}
        onClose={() => setPayId(null)}
        title="Confirm Payment"
        maxWidth={440}
      >
        <p style={{ marginBottom: 20 }}>
          Mark this bill as paid? If it is a recurring bill (e.g. monthly), the next billing occurrence will automatically be scheduled.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={() => setPayId(null)}>
            Cancel
          </button>
          <button className="btn btn-success" onClick={handleMarkAsPaid}>
            Confirm Paid
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Bill"
        maxWidth={420}
      >
        <p style={{ marginBottom: 20 }}>
          Are you sure you want to delete this bill reminder?
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </Modal>
    </Layout>
  );
}
