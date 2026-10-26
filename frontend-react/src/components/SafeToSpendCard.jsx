import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatINR, formatDate } from '../utils/formatters.js';
import { calculateSafeToSpend } from '../utils/safeToSpend.js';
import {
  Shield,
  AlertTriangle,
  CalendarCheck,
  TrendingDown,
  Info,
  ChevronDown,
  ChevronUp,
  Wallet,
  ArrowRight,
  PiggyBank,
  CheckCircle2,
  Edit2
} from './Icons.jsx';

export default function SafeToSpendCard({
  availableBalance,
  bills = [],
  expenses = [],
  savingsGoals = [],
  budget = null,
  onOverrideBalance = null,
  customBalance = null
}) {
  const [planningPeriod, setPlanningPeriod] = useState('payday');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editBalanceOpen, setEditBalanceOpen] = useState(false);
  const [balanceInput, setBalanceInput] = useState('');

  // Effective balance (user override or actual recorded balance)
  const effectiveBalance = customBalance !== null && customBalance !== undefined
    ? Number(customBalance)
    : Number(availableBalance || 0);

  // Recalculate Safe-to-Spend reactively
  const calculation = useMemo(() => {
    return calculateSafeToSpend({
      availableBalance: effectiveBalance,
      bills,
      expenses,
      savingsGoals,
      budget,
      planningPeriod,
      referenceDate: new Date()
    });
  }, [effectiveBalance, bills, expenses, savingsGoals, budget, planningPeriod]);

  const {
    safeToSpend,
    dailySafeToSpend,
    unpaidCommitments,
    unpaidBillsDue,
    unpaidBillsCount,
    essentialExpensesRemaining,
    plannedSavingsNotReserved,
    isDeficit,
    deficitAmount,
    periodLabel,
    daysInHorizon,
    periodEndDate,
    warning,
    explanation
  } = calculation;

  const handleSaveBalance = (e) => {
    e.preventDefault();
    if (onOverrideBalance && balanceInput !== '') {
      onOverrideBalance(Number(balanceInput));
      setEditBalanceOpen(false);
    }
  };

  const handleResetBalance = () => {
    if (onOverrideBalance) {
      onOverrideBalance(null);
      setEditBalanceOpen(false);
    }
  };

  // Safe to spend percentage of balance (for meter)
  const spendRatio = effectiveBalance > 0
    ? Math.max(0, Math.min(100, (safeToSpend / effectiveBalance) * 100))
    : 0;

  return (
    <div
      className="glass-card safe-to-spend-card"
      style={{
        border: isDeficit
          ? '1.5px solid rgba(239, 68, 68, 0.4)'
          : '1.5px solid var(--border-color)',
        background: isDeficit
          ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.04) 0%, var(--card-bg) 100%)'
          : 'linear-gradient(135deg, rgba(53, 94, 59, 0.05) 0%, var(--card-bg) 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Top Header & Period Selector */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: isDeficit ? 'var(--danger-light)' : 'var(--primary-light)',
              color: isDeficit ? 'var(--danger-color)' : 'var(--primary-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Shield size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 700, color: 'var(--text-color)' }}>
                Safe-to-Spend Calculator
              </h3>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: isDeficit ? 'var(--danger-light)' : 'rgba(53, 94, 59, 0.12)',
                  color: isDeficit ? 'var(--danger-color)' : 'var(--primary-color)'
                }}
              >
                {isDeficit ? 'Deficit Risk' : 'Protected'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Real-time available funds after upcoming financial commitments
            </p>
          </div>
        </div>

        {/* Period Selector Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Period:
          </label>
          <select
            value={planningPeriod}
            onChange={(e) => setPlanningPeriod(e.target.value)}
            className="form-control"
            style={{
              padding: '6px 12px',
              fontSize: '0.82rem',
              borderRadius: 8,
              height: 'auto',
              minWidth: 150,
              background: 'var(--bg-main)'
            }}
          >
            <option value="payday">Until Next Salary</option>
            <option value="month">Rest of the Month</option>
            <option value="7days">Next 7 Days</option>
            <option value="30days">Next 30 Days</option>
          </select>

          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '6px 10px', fontSize: '0.78rem' }}
            onClick={() => {
              setBalanceInput(String(effectiveBalance));
              setEditBalanceOpen(!editBalanceOpen);
            }}
            title="Confirm or adjust available balance"
          >
            <Edit2 size={14} />
            <span>{customBalance !== null ? 'Adjusted' : 'Confirm Balance'}</span>
          </button>
        </div>
      </div>

      {/* Manual Balance Adjustment Panel */}
      {editBalanceOpen && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: 16,
            borderRadius: 10,
            background: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Current Available Balance (₹)
            </label>
            <input
              type="number"
              step="0.01"
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              placeholder="e.g. 35000"
              className="form-control"
              style={{ padding: '6px 10px', fontSize: '0.85rem' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              onClick={handleSaveBalance}
            >
              Update Balance
            </button>
            {customBalance !== null && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                onClick={handleResetBalance}
              >
                Reset to Recorded
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '6px 10px', fontSize: '0.8rem' }}
              onClick={() => setEditBalanceOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Warning Banner if Deficit */}
      {isDeficit && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 10,
            background: 'var(--danger-light)',
            color: 'var(--danger-color)',
            border: '1px solid var(--danger-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
            fontSize: '0.88rem',
            fontWeight: 500
          }}
        >
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <strong>Warning: Current funds may not cover upcoming commitments!</strong>
            <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: 2 }}>
              Projected deficit of <strong>{formatINR(deficitAmount)}</strong> before {periodLabel.toLowerCase()} ({formatDate(periodEndDate)}).
            </div>
          </div>
        </div>
      )}

      {/* Main Metric Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          padding: '16px 20px',
          borderRadius: 12,
          background: 'var(--bg-main)',
          border: '1px solid var(--border-color)',
          marginBottom: 16
        }}
      >
        <div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Estimated Safe-to-Spend
          </span>
          <div
            style={{
              fontSize: '2rem',
              fontWeight: 800,
              color: isDeficit ? 'var(--danger-color)' : 'var(--primary-color)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              marginTop: 4
            }}
          >
            {isDeficit ? `-${formatINR(deficitAmount)}` : formatINR(safeToSpend)}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            {isDeficit ? (
              <span style={{ color: 'var(--danger-color)', fontWeight: 600 }}>Commitments exceed available balance</span>
            ) : (
              <span>~{formatINR(dailySafeToSpend)} / day for {daysInHorizon} days</span>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Available Balance
            </span>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 2, color: 'var(--text-color)' }}>
              {formatINR(effectiveBalance)}
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {customBalance !== null ? 'Manually confirmed' : 'Salaries - Expenses'}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Unpaid Bills Due
            </span>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 2, color: 'var(--danger-color)' }}>
              -{formatINR(unpaidCommitments)}
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {unpaidBillsCount} bill(s) in horizon
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Essential Buffer
            </span>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 2, color: 'var(--warning-color)' }}>
              -{formatINR(essentialExpensesRemaining)}
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {budget ? 'From active budget' : 'No budget set'}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Planned Savings
            </span>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 2, color: 'var(--primary-color)' }}>
              -{formatINR(plannedSavingsNotReserved)}
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {savingsGoals.length} savings goal(s)
            </span>
          </div>
        </div>
      </div>

      {/* Progress & Buffer Allocation Bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
          <span>Cash Allocation Breakdown</span>
          <span>
            {isDeficit ? 'Deficit: Commitments > 100%' : `${spendRatio.toFixed(0)}% safe to spend`}
          </span>
        </div>
        <div
          style={{
            height: 10,
            borderRadius: 999,
            background: 'var(--border-color)',
            overflow: 'hidden',
            display: 'flex'
          }}
        >
          {/* Bills portion */}
          <div
            title={`Unpaid Bills: ${formatINR(unpaidCommitments)}`}
            style={{
              width: effectiveBalance > 0 ? `${Math.min(100, (unpaidCommitments / effectiveBalance) * 100)}%` : '0%',
              background: 'var(--danger-color)',
              transition: 'width 0.4s ease'
            }}
          />
          {/* Essentials portion */}
          <div
            title={`Essential Buffer: ${formatINR(essentialExpensesRemaining)}`}
            style={{
              width: effectiveBalance > 0 ? `${Math.min(100, (essentialExpensesRemaining / effectiveBalance) * 100)}%` : '0%',
              background: '#f59e0b',
              transition: 'width 0.4s ease'
            }}
          />
          {/* Savings portion */}
          <div
            title={`Planned Savings: ${formatINR(plannedSavingsNotReserved)}`}
            style={{
              width: effectiveBalance > 0 ? `${Math.min(100, (plannedSavingsNotReserved / effectiveBalance) * 100)}%` : '0%',
              background: 'rgba(53, 94, 59, 0.45)',
              transition: 'width 0.4s ease'
            }}
          />
          {/* Safe-to-spend remainder */}
          <div
            title={`Safe to Spend: ${formatINR(safeToSpend)}`}
            style={{
              width: `${spendRatio}%`,
              background: 'var(--primary-color)',
              transition: 'width 0.4s ease'
            }}
          />
        </div>
      </div>

      {/* Explanation text & Toggle for detailed bill commitments */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          fontSize: '0.82rem'
        }}
      >
        <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Info size={15} color="var(--primary-color)" />
          <span>{explanation}</span>
        </div>

        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: '4px 8px', fontSize: '0.8rem', marginLeft: 'auto' }}
          onClick={() => setDetailsOpen(!detailsOpen)}
        >
          <span>{detailsOpen ? 'Hide Commitments' : `View ${unpaidBillsCount} Due Bills`}</span>
          {detailsOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {/* Collapsible Due Bills Drawer */}
      {detailsOpen && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: '1px solid var(--border-color)',
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-color)' }}>
              Bills Due Within {periodLabel} (Ends {formatDate(periodEndDate)}):
            </span>
            <Link to="/calendar" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '0.75rem' }}>
              Open Calendar <ArrowRight size={13} />
            </Link>
          </div>

          {unpaidBillsDue.length === 0 ? (
            <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              No unpaid bills due during this period!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {unpaidBillsDue.map((b) => (
                <div
                  key={b._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.83rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CalendarCheck size={16} color="var(--primary-color)" />
                    <div>
                      <strong style={{ color: 'var(--text-color)' }}>{b.billName}</strong>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Due {formatDate(b.dueDate)} • {b.category || 'Utilities'}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 700, color: 'var(--danger-color)' }}>
                      {formatINR(b.amount)}
                    </span>
                    <div>
                      <Link
                        to="/bills"
                        style={{ fontSize: '0.72rem', color: 'var(--primary-color)', textDecoration: 'underline' }}
                      >
                        Pay Bill
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
