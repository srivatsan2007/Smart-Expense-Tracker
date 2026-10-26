import { useEffect, useState, useMemo } from 'react';
import Layout from '../components/Layout.jsx';
import PageHeader from '../components/PageHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { notify } from '../components/Toast.jsx';
import { formatINR } from '../utils/formatters.js';
import { getAuthHeaders } from '../hooks/useAuth.js';
import {
  Wallet,
  Plus,
  Trash2,
  CalendarCheck,
  TrendingUp,
  IndianRupee,
  AlertCircle
} from '../components/Icons.jsx';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const emptyForm = () => ({
  amount: '',
  month: MONTHS[new Date().getMonth()],
  year: new Date().getFullYear()
});

export default function Salary() {
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const fetchSalaries = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/salaries', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSalaries(Array.isArray(data) ? data : []);
      } else {
        notify('Failed to load salary history', 'error');
      }
    } catch (error) {
      console.error('Error fetching salaries:', error);
      notify('Network error loading salaries', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalaries();
  }, []);

  const stats = useMemo(() => {
    const total = salaries.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
    const count = salaries.length;
    const avg = count > 0 ? total / count : 0;
    const max = count > 0 ? Math.max(...salaries.map((s) => Number(s.amount) || 0)) : 0;
    return { total, count, avg, max };
  }, [salaries]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) {
      notify('Please enter a valid salary amount', 'warning');
      return;
    }
    if (!form.month) {
      notify('Please select a month', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/salaries', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          amount: Number(form.amount),
          month: form.month,
          year: Number(form.year)
        })
      });

      if (res.ok) {
        notify('Salary recorded successfully!', 'success');
        setForm(emptyForm());
        setIsAddOpen(false);
        fetchSalaries();
      } else {
        const err = await res.json().catch(() => ({}));
        notify(err.message || 'Failed to record salary', 'error');
      }
    } catch (error) {
      console.error('Error adding salary:', error);
      notify('Error saving salary record', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/salaries/${deleteId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        notify('Salary record deleted successfully', 'success');
        setDeleteId(null);
        fetchSalaries();
      } else {
        notify('Failed to delete salary record', 'error');
      }
    } catch (err) {
      console.error('Error deleting salary:', err);
      notify('Network error deleting record', 'error');
    }
  };

  return (
    <Layout title="Salary - RupeeRise" active="salary">
      <PageHeader
        title="Salary & Income Management"
        subtitle="Track recurring earnings, view monthly income history, and optimize your savings"
        action={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setForm(emptyForm());
              setIsAddOpen(true);
            }}
          >
            <Plus size={18} />
            <span>Record Income</span>
          </button>
        }
      />

      {/* Stats Overview */}
      <div className="stats-grid">
        <StatCard
          label="Total Income Recorded"
          value={formatINR(stats.total)}
          sub="Cumulative tracked income"
          icon={<Wallet size={22} />}
          badge="Lifetime"
          variant="success"
        />
        <StatCard
          label="Average Monthly Income"
          value={formatINR(stats.avg)}
          sub={stats.count > 0 ? `Across ${stats.count} recorded months` : 'No data yet'}
          icon={<TrendingUp size={22} />}
          badge="Monthly Avg"
          variant="primary"
        />
        <StatCard
          label="Peak Monthly Earning"
          value={formatINR(stats.max)}
          sub="Highest monthly credit"
          icon={<IndianRupee size={22} />}
          badge="High Mark"
          variant="default"
        />
        <StatCard
          label="Pay Records"
          value={`${stats.count} ${stats.count === 1 ? 'Month' : 'Months'}`}
          sub="Documented income entries"
          icon={<CalendarCheck size={22} />}
          badge="Entries"
          variant="default"
        />
      </div>

      {/* Main Income History Table */}
      <div className="glass-card" style={{ marginTop: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Income History</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Chronological log of verified salary payments
            </p>
          </div>
          {salaries.length > 0 && (
            <span className="badge badge-primary" style={{ padding: '6px 12px' }}>
              {salaries.length} {salaries.length === 1 ? 'Record' : 'Records'}
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 12px auto' }}></div>
            <p>Loading salary history...</p>
          </div>
        ) : salaries.length === 0 ? (
          <EmptyState
            icon={<Wallet size={36} />}
            title="No Salary Records Yet"
            description="Recording your monthly income allows Smart Tracker to accurately compute your monthly savings rate, remaining cashflow, and net balance."
            actionLabel="Record First Income"
            onAction={() => {
              setForm(emptyForm());
              setIsAddOpen(true);
            }}
          />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Month</th>
                  <th>Year</th>
                  <th>Amount</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {salaries.map((s) => (
                  <tr key={s._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: 'rgba(16, 185, 129, 0.1)',
                            color: 'var(--success-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <IndianRupee size={18} />
                        </div>
                        <div>
                          <span style={{ fontWeight: 600 }}>{s.month} {s.year}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-default">{s.month}</span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                      {s.year}
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '1rem',
                          color: 'var(--success-color)'
                        }}
                      >
                        +{formatINR(s.amount)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => setDeleteId(s._id)}
                        className="btn btn-secondary btn-icon"
                        title="Delete record"
                        style={{
                          color: 'var(--danger-color)',
                          borderColor: 'rgba(239, 68, 68, 0.25)',
                          background: 'rgba(239, 68, 68, 0.05)'
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Salary Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Record Monthly Income"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              Monthly Salary / Income Amount (₹) <span style={{ color: 'var(--danger-color)' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                className="form-control"
                placeholder="e.g. 75000"
                required
                min="1"
                step="0.01"
                value={form.amount}
                onChange={set('amount')}
                autoFocus
              />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Net take-home pay or credited salary for the selected month.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">
                Month <span style={{ color: 'var(--danger-color)' }}>*</span>
              </label>
              <select
                className="form-control"
                required
                value={form.month}
                onChange={set('month')}
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Year <span style={{ color: 'var(--danger-color)' }}>*</span>
              </label>
              <input
                type="number"
                className="form-control"
                required
                min="2000"
                max="2100"
                value={form.year}
                onChange={set('year')}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setIsAddOpen(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1.5 }}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Save Income Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Salary Record"
      >
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--danger-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}
          >
            <AlertCircle size={28} />
          </div>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 8 }}>
            Are you sure you want to delete this record?
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 24, lineHeight: 1.5 }}>
            This will permanently remove this income entry from your records and will update your dashboard's balance and savings rate calculations.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setDeleteId(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              style={{ flex: 1 }}
              onClick={confirmDelete}
            >
              Delete Record
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
