import { useEffect, useState, useMemo } from 'react';
import Layout from '../components/Layout.jsx';
import PageHeader from '../components/PageHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { notify } from '../components/Toast.jsx';
import { formatINR, formatDate } from '../utils/formatters.js';
import { getAuthHeaders } from '../hooks/useAuth.js';
import {
  Target,
  Plus,
  Trash2,
  Edit2,
  TrendingUp,
  CheckCircle2,
  CalendarCheck,
  AlertCircle,
  IndianRupee,
  Clock,
  PiggyBank,
  Home,
  Car,
  Plane,
  Laptop,
  GraduationCap,
  Heart,
  Briefcase,
  Shield,
  Coins
} from '../components/Icons.jsx';

const emptyForm = () => ({
  name: '',
  targetAmount: '',
  currentAmount: '0',
  targetDate: '',
  description: ''
});

function getGoalIcon(name = '') {
  const lower = name.toLowerCase();
  if (lower.includes('car') || lower.includes('bike') || lower.includes('vehicle') || lower.includes('auto')) {
    return <Car size={20} />;
  }
  if (lower.includes('home') || lower.includes('house') || lower.includes('flat') || lower.includes('apartment') || lower.includes('rent')) {
    return <Home size={20} />;
  }
  if (lower.includes('travel') || lower.includes('trip') || lower.includes('flight') || lower.includes('vacation') || lower.includes('tour') || lower.includes('holiday')) {
    return <Plane size={20} />;
  }
  if (lower.includes('laptop') || lower.includes('macbook') || lower.includes('phone') || lower.includes('pc') || lower.includes('tech') || lower.includes('gadget') || lower.includes('iphone')) {
    return <Laptop size={20} />;
  }
  if (lower.includes('study') || lower.includes('school') || lower.includes('college') || lower.includes('degree') || lower.includes('course') || lower.includes('education')) {
    return <GraduationCap size={20} />;
  }
  if (lower.includes('wedding') || lower.includes('marriage') || lower.includes('anniversary') || lower.includes('gift') || lower.includes('love')) {
    return <Heart size={20} />;
  }
  if (lower.includes('emergency') || lower.includes('safe') || lower.includes('insurance')) {
    return <Shield size={20} />;
  }
  if (lower.includes('business') || lower.includes('work') || lower.includes('invest') || lower.includes('startup')) {
    return <Briefcase size={20} />;
  }
  if (lower.includes('piggy') || lower.includes('saving') || lower.includes('fund') || lower.includes('wealth')) {
    return <PiggyBank size={20} />;
  }
  return <Target size={20} />;
}

function getTimeRemaining(targetDateStr) {
  if (!targetDateStr) return null;
  const target = new Date(targetDateStr);
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  const diffMs = target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      text: `${overdueDays} ${overdueDays === 1 ? 'day' : 'days'} overdue`,
      isPast: true,
      days: diffDays
    };
  }
  if (diffDays === 0) {
    return { text: 'Due today', isPast: false, days: 0 };
  }
  return {
    text: `${diffDays} ${diffDays === 1 ? 'day' : 'days'} left`,
    isPast: false,
    days: diffDays
  };
}

export default function SavingsGoals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // null for create, id for edit
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Add Contribution Modal state
  const [contributionGoal, setContributionGoal] = useState(null); // { _id, name, currentAmount, targetAmount }
  const [contribAmount, setContribAmount] = useState('');
  const [contribSubmitting, setContribSubmitting] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/savings', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setGoals(Array.isArray(data) ? data : []);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.message || 'Failed to load savings goals');
        notify('Failed to load savings goals', 'error');
      }
    } catch (err) {
      console.error('Error fetching goals:', err);
      setError('Unable to reach server. Please check your connection.');
      notify('Network error loading savings goals', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  // Summary Metrics calculated exclusively from real goal records
  const stats = useMemo(() => {
    const totalGoals = goals.length;
    const totalTarget = goals.reduce((acc, g) => acc + (Number(g.targetAmount) || 0), 0);
    const totalSaved = goals.reduce((acc, g) => acc + (Number(g.currentAmount) || 0), 0);
    const overallProgress = totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0;
    const completedGoals = goals.filter((g) => {
      const target = Number(g.targetAmount) || 0;
      const current = Number(g.currentAmount) || 0;
      return target > 0 && current >= target;
    }).length;

    return {
      totalGoals,
      totalTarget,
      totalSaved,
      overallProgress,
      completedGoals
    };
  }, [goals]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditModal = (goal) => {
    setEditingId(goal._id);
    let dateStr = '';
    if (goal.targetDate) {
      const d = new Date(goal.targetDate);
      if (!isNaN(d.getTime())) {
        dateStr = d.toISOString().split('T')[0];
      }
    }
    setForm({
      name: goal.name || '',
      targetAmount: goal.targetAmount ? String(goal.targetAmount) : '',
      currentAmount: goal.currentAmount !== undefined ? String(goal.currentAmount) : '0',
      targetDate: dateStr,
      description: goal.description || ''
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const handleFormChange = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    if (formError) setFormError('');
  };

  const handleSaveGoal = async (e) => {
    e.preventDefault();
    setFormError('');

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setFormError('Goal name is required.');
      return;
    }

    const targetNum = parseFloat(form.targetAmount);
    if (isNaN(targetNum) || targetNum <= 0) {
      setFormError('Target amount must be a positive number in INR.');
      return;
    }

    const currentNum = parseFloat(form.currentAmount || '0');
    if (isNaN(currentNum) || currentNum < 0) {
      setFormError('Saved amount cannot be negative.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: trimmedName,
        targetAmount: targetNum,
        currentAmount: currentNum,
        targetDate: form.targetDate ? form.targetDate : null,
        description: form.description ? form.description.trim() : ''
      };

      const url = editingId ? `/api/savings/${editingId}` : '/api/savings';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        notify(
          editingId ? 'Savings goal updated successfully!' : 'New savings goal created!',
          'success'
        );
        setIsFormOpen(false);
        fetchGoals();
      } else {
        const err = await res.json().catch(() => ({}));
        setFormError(err.message || 'Failed to save goal.');
        notify(err.message || 'Failed to save goal', 'error');
      }
    } catch (err) {
      console.error('Error saving goal:', err);
      setFormError('Network error while saving goal.');
      notify('Network error', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openContributionModal = (goal) => {
    setContributionGoal(goal);
    setContribAmount('');
  };

  const handleAddContribution = async (e) => {
    e.preventDefault();
    if (!contributionGoal) return;

    const addVal = parseFloat(contribAmount);
    if (isNaN(addVal) || addVal <= 0) {
      notify('Please enter a valid positive contribution amount', 'warning');
      return;
    }

    const curVal = Number(contributionGoal.currentAmount) || 0;
    const newTotal = curVal + addVal;

    setContribSubmitting(true);
    try {
      const res = await fetch(`/api/savings/${contributionGoal._id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ currentAmount: newTotal })
      });

      if (res.ok) {
        notify(`Added ${formatINR(addVal)} to "${contributionGoal.name}"!`, 'success');
        setContributionGoal(null);
        fetchGoals();
      } else {
        const err = await res.json().catch(() => ({}));
        notify(err.message || 'Failed to add contribution', 'error');
      }
    } catch (err) {
      console.error('Error adding contribution:', err);
      notify('Network error adding contribution', 'error');
    } finally {
      setContribSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/savings/${deleteId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        notify('Savings goal deleted successfully', 'success');
        setDeleteId(null);
        fetchGoals();
      } else {
        const err = await res.json().catch(() => ({}));
        notify(err.message || 'Failed to delete goal', 'error');
      }
    } catch (err) {
      console.error('Error deleting goal:', err);
      notify('Network error deleting goal', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout title="Savings Goals - RupeeRise" active="savings-goals">
      {/* Page Header */}
      <PageHeader
        title="Savings Goals"
        subtitle="Turn your plans into achievements."
        action={
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreateModal}
            style={{
              padding: '10px 20px',
              fontWeight: 600,
              fontSize: '0.92rem',
              boxShadow: '0 4px 14px rgba(53, 94, 59, 0.35)',
              gap: 8
            }}
          >
            <Plus size={18} />
            <span>Create New Goal</span>
          </button>
        }
      />

      {/* 4 Summary Cards */}
      <div className="stats-grid">
        <StatCard
          label="Total Savings Goals"
          value={stats.totalGoals}
          sub={stats.completedGoals > 0 ? `${stats.completedGoals} completed milestone${stats.completedGoals > 1 ? 's' : ''}` : 'Active financial targets'}
          icon={<Target size={22} />}
          badge="Goals"
          variant="primary"
        />
        <StatCard
          label="Total Target Amount"
          value={formatINR(stats.totalTarget)}
          sub="Combined goal ambitions"
          icon={<Coins size={22} />}
          badge="Target"
          variant="default"
        />
        <StatCard
          label="Total Amount Saved"
          value={formatINR(stats.totalSaved)}
          sub={stats.totalTarget > 0 ? `${formatINR(Math.max(0, stats.totalTarget - stats.totalSaved))} remaining to target` : 'Accumulated deposits'}
          icon={<IndianRupee size={22} />}
          badge="Saved"
          variant="success"
        />
        <StatCard
          label="Overall Savings Progress"
          value={`${stats.overallProgress.toFixed(1)}%`}
          sub={
            <div style={{ marginTop: 6 }}>
              <div
                style={{
                  height: 6,
                  borderRadius: 999,
                  background: 'var(--border-color)',
                  overflow: 'hidden',
                  width: '100%'
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${stats.overallProgress}%`,
                    background: stats.overallProgress >= 100 ? 'var(--success-color)' : 'var(--primary-color)',
                    borderRadius: 999,
                    transition: 'width 0.4s ease'
                  }}
                />
              </div>
            </div>
          }
          icon={<TrendingUp size={22} />}
          badge="Overall"
          variant={stats.overallProgress >= 100 ? 'success' : 'default'}
        />
      </div>

      {/* Main Content Area */}
      <div style={{ marginTop: 28 }}>
        {loading ? (
          <div
            className="glass-card"
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: 'var(--text-muted)'
            }}
          >
            <div className="loading-spinner" style={{ margin: '0 auto 16px auto' }} />
            <p style={{ fontWeight: 500 }}>Loading your savings goals...</p>
          </div>
        ) : error ? (
          <div
            className="glass-card"
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              borderColor: 'rgba(239, 68, 68, 0.3)'
            }}
          >
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
                margin: '0 auto 14px auto'
              }}
            >
              <AlertCircle size={26} />
            </div>
            <h4 style={{ fontWeight: 600, marginBottom: 8 }}>Unable to load savings goals</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 20 }}>
              {error}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={fetchGoals}
            >
              Try Again
            </button>
          </div>
        ) : goals.length === 0 ? (
          <div className="glass-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
            <EmptyState
              icon={<PiggyBank size={42} />}
              title="Start building your savings"
              description="Create your first savings target to track your progress, build financial discipline, and turn your dreams into reality."
              actionLabel="Create Your First Goal"
              onAction={openCreateModal}
            />
          </div>
        ) : (
          /* Responsive Goal Cards Grid */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 22,
              alignItems: 'stretch'
            }}
          >
            {goals.map((goal) => {
              const current = Number(goal.currentAmount) || 0;
              const target = Number(goal.targetAmount) || 0;
              // Guard against divide-by-zero or negative target
              const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;
              const exactPercent = target > 0 ? (current / target) * 100 : 0;
              const isCompleted = target > 0 && current >= target;
              const remaining = Math.max(0, target - current);
              const timeInfo = getTimeRemaining(goal.targetDate);

              return (
                <div
                  key={goal._id}
                  className="glass-card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    borderColor: isCompleted ? 'rgba(61, 139, 80, 0.45)' : 'var(--card-border)',
                    boxShadow: isCompleted
                      ? '0 4px 16px rgba(61, 139, 80, 0.08)'
                      : '0 4px 16px rgba(53, 94, 59, 0.06)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    overflow: 'hidden'
                  }}
                >
                  {/* Top Status Accent Bar */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      background: isCompleted
                        ? 'var(--success-color)'
                        : 'linear-gradient(90deg, var(--color-primary), var(--color-accent))'
                    }}
                  />

                  <div>
                    {/* Header Row: Icon, Title & Action Menu */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 12,
                        marginBottom: 14
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: isCompleted
                              ? 'var(--success-light)'
                              : 'var(--primary-light)',
                            color: isCompleted ? 'var(--success-color)' : 'var(--primary-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          {getGoalIcon(goal.name)}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <h4
                              style={{
                                fontSize: '1.08rem',
                                fontWeight: 700,
                                margin: 0,
                                color: 'var(--text-color)',
                                letterSpacing: '-0.01em'
                              }}
                            >
                              {goal.name}
                            </h4>
                            {isCompleted && (
                              <span
                                className="badge badge-success"
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '2px 8px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                <CheckCircle2 size={12} />
                                <span>Achieved</span>
                              </span>
                            )}
                          </div>
                          {goal.description && (
                            <p
                              style={{
                                fontSize: '0.82rem',
                                color: 'var(--text-muted)',
                                margin: '3px 0 0 0',
                                lineHeight: 1.4,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}
                            >
                              {goal.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Edit & Delete Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          type="button"
                          onClick={() => openEditModal(goal)}
                          className="btn btn-secondary btn-icon"
                          title="Edit Goal"
                          style={{ padding: 6, color: 'var(--text-secondary)' }}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(goal._id)}
                          className="btn btn-secondary btn-icon"
                          title="Delete Goal"
                          style={{
                            padding: 6,
                            color: 'var(--danger-color)',
                            borderColor: 'rgba(239, 68, 68, 0.25)',
                            background: 'rgba(239, 68, 68, 0.05)'
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Financial Figures */}
                    <div
                      style={{
                        padding: '14px 16px',
                        background: 'var(--bg-main)',
                        borderRadius: 12,
                        border: '1px solid var(--border-color)',
                        margin: '14px 0 12px 0'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          marginBottom: 4
                        }}
                      >
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          Saved Amount
                        </span>
                        <span
                          style={{
                            fontSize: '1.2rem',
                            fontWeight: 700,
                            color: isCompleted ? 'var(--success-color)' : 'var(--primary-color)'
                          }}
                        >
                          {formatINR(current)}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                          paddingTop: 6,
                          borderTop: '1px dashed var(--border-color)'
                        }}
                      >
                        <span>Target: <strong style={{ color: 'var(--text-color)' }}>{formatINR(target)}</strong></span>
                        <span>
                          {isCompleted ? (
                            <strong style={{ color: 'var(--success-color)' }}>100% Funded</strong>
                          ) : (
                            <>Remaining: <strong style={{ color: 'var(--text-color)' }}>{formatINR(remaining)}</strong></>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar & Percentage */}
                    <div style={{ marginBottom: 14 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.8rem',
                          marginBottom: 6
                        }}
                      >
                        <span style={{ color: 'var(--text-muted)' }}>Progress</span>
                        <strong
                          style={{
                            color: isCompleted ? 'var(--success-color)' : 'var(--primary-color)',
                            fontWeight: 700
                          }}
                        >
                          {exactPercent.toFixed(1)}%
                        </strong>
                      </div>

                      <div
                        style={{
                          height: 8,
                          borderRadius: 999,
                          background: 'var(--color-accent, #DDF2C1)',
                          overflow: 'hidden'
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${percentage}%`,
                            background: isCompleted
                              ? 'var(--success-color)'
                              : 'var(--primary-color)',
                            borderRadius: 999,
                            transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                          }}
                        />
                      </div>
                    </div>

                    {/* Target Date & Countdown Pill */}
                    {goal.targetDate && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)',
                          marginBottom: 16
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={13} />
                          <span>Target: {formatDate(goal.targetDate)}</span>
                        </div>
                        {timeInfo && (
                          <span
                            className={
                              isCompleted
                                ? 'badge badge-success'
                                : timeInfo.isPast
                                ? 'badge badge-danger'
                                : timeInfo.days <= 14
                                ? 'badge badge-warning'
                                : 'badge badge-default'
                            }
                            style={{ fontSize: '0.74rem', padding: '2px 8px' }}
                          >
                            {isCompleted ? 'Goal Met' : timeInfo.text}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Bottom: Add Contribution Action */}
                  <div
                    style={{
                      paddingTop: 12,
                      borderTop: '1px solid var(--border-color)',
                      marginTop: 6
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => openContributionModal(goal)}
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        gap: 8,
                        fontSize: '0.88rem',
                        padding: '9px 14px',
                        background: 'var(--bg-main)',
                        fontWeight: 600
                      }}
                    >
                      <Plus size={16} />
                      <span>Add Contribution</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Goal Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingId ? 'Edit Savings Goal' : 'Create New Savings Goal'}
      >
        <form onSubmit={handleSaveGoal}>
          {formError && (
            <div
              className="error-msg"
              style={{
                display: 'flex',
                marginBottom: 16,
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: 'var(--danger-color)',
                fontSize: '0.88rem',
                alignItems: 'center',
                gap: 8
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{formError}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              Goal Name <span style={{ color: 'var(--danger-color)' }}>*</span>
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Emergency Fund, Laptop, Summer Vacation"
              required
              value={form.name}
              onChange={handleFormChange('name')}
              autoFocus
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">
                Target Amount (₹) <span style={{ color: 'var(--danger-color)' }}>*</span>
              </label>
              <input
                type="number"
                className="form-control"
                placeholder="e.g. 50000"
                required
                min="1"
                step="0.01"
                value={form.targetAmount}
                onChange={handleFormChange('targetAmount')}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                {editingId ? 'Current Saved (₹)' : 'Initial Saved (₹)'}
              </label>
              <input
                type="number"
                className="form-control"
                placeholder="0"
                min="0"
                step="0.01"
                value={form.currentAmount}
                onChange={handleFormChange('currentAmount')}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Target Completion Date (Optional)</label>
            <input
              type="date"
              className="form-control"
              value={form.targetDate}
              onChange={handleFormChange('targetDate')}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Optional Description</label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="e.g. Dedicated monthly allocations to cover 6 months of expenses"
              value={form.description}
              onChange={handleFormChange('description')}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => setIsFormOpen(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1.5, justifyContent: 'center' }}
              disabled={submitting}
            >
              {submitting
                ? 'Saving...'
                : editingId
                ? 'Save Changes'
                : 'Create Goal'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Contribution Modal */}
      <Modal
        isOpen={!!contributionGoal}
        onClose={() => setContributionGoal(null)}
        title={contributionGoal ? `Add Contribution — ${contributionGoal.name}` : 'Add Contribution'}
      >
        {contributionGoal && (
          <form onSubmit={handleAddContribution}>
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                background: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                marginBottom: 20
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Current Saved:</span>
                <strong>{formatINR(contributionGoal.currentAmount || 0)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 10 }}>
                <span style={{ color: 'var(--text-muted)' }}>Target:</span>
                <strong>{formatINR(contributionGoal.targetAmount || 0)}</strong>
              </div>

              {/* Progress preview */}
              {contribAmount && parseFloat(contribAmount) > 0 && (
                <div
                  style={{
                    paddingTop: 8,
                    borderTop: '1px dashed var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.85rem',
                    color: 'var(--success-color)'
                  }}
                >
                  <span>New Total:</span>
                  <strong>
                    {formatINR((Number(contributionGoal.currentAmount) || 0) + parseFloat(contribAmount))}
                  </strong>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">
                Deposit / Contribution Amount (₹) <span style={{ color: 'var(--danger-color)' }}>*</span>
              </label>
              <input
                type="number"
                className="form-control"
                placeholder="e.g. 2000"
                required
                min="1"
                step="0.01"
                value={contribAmount}
                onChange={(e) => setContribAmount(e.target.value)}
                autoFocus
              />
            </div>

            {/* Quick add chips */}
            <div style={{ marginBottom: 22 }}>
              <span
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                  display: 'block',
                  marginBottom: 8
                }}
              >
                Quick Add Amounts:
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[500, 1000, 2500, 5000, 10000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      padding: '5px 12px',
                      fontSize: '0.82rem',
                      fontWeight: 600
                    }}
                    onClick={() => {
                      const cur = parseFloat(contribAmount) || 0;
                      setContribAmount(String(cur + val));
                    }}
                  >
                    +{formatINR(val)}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setContributionGoal(null)}
                disabled={contribSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1.5, justifyContent: 'center' }}
                disabled={contribSubmitting}
              >
                {contribSubmitting ? 'Recording Deposit...' : 'Confirm Contribution'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Savings Goal"
      >
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.12)',
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
            Are you sure you want to delete this goal?
          </h4>
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.88rem',
              marginBottom: 24,
              lineHeight: 1.5
            }}
          >
            This goal and its tracking progress will be permanently erased. Existing expense records and income history will remain unaffected.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => setDeleteId(null)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              style={{ flex: 1.3, justifyContent: 'center' }}
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Goal'}
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
