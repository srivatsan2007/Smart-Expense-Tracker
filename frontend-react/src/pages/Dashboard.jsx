import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import PageHeader from '../components/PageHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import SafeToSpendCard from '../components/SafeToSpendCard.jsx';
import ChartCanvas from '../components/ChartCanvas.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { notify } from '../components/Toast.jsx';
import { getAuthHeaders } from '../hooks/useAuth.js';
import { formatINR, formatDate, CATEGORY_COLORS } from '../utils/formatters.js';
import {
  Wallet,
  Receipt,
  PiggyBank,
  TrendingUp,
  Plus,
  CalendarCheck,
  FileText,
  AlertTriangle,
  Clock,
  ArrowRight,
  Sparkles,
} from '../components/Icons.jsx';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const EXPENSE_CATEGORIES = [
  'Medical', 'Petrol', 'Grocery', 'Milk', 'Education', 'Home Tax',
  'Electricity', 'Water Bill', 'Internet', 'Rent', 'EMI', 'Shopping',
  'Entertainment', 'Travel', 'Others',
];

const PAYMENT_METHODS = ['Cash', 'Credit Card', 'Debit Card', 'UPI', 'Net Banking'];

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [bills, setBills] = useState([]);
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [budget, setBudget] = useState(null);
  const [timeRange, setTimeRange] = useState('all'); // all | 6m | 3m
  const [customBalance, setCustomBalance] = useState(() => {
    const saved = localStorage.getItem('rupeerise_custom_balance');
    return saved !== null && saved !== '' ? Number(saved) : null;
  });


  // Quick Action Modal states
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);

  // Quick form states
  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    category: 'Grocery',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'UPI',
    description: '',
  });

  const [billForm, setBillForm] = useState({
    billName: '',
    amount: '',
    dueDate: new Date().toISOString().split('T')[0],
    category: 'Utilities',
    recurring: 'monthly',
  });

  const [salaryForm, setSalaryForm] = useState({
    amount: '',
    month: MONTH_NAMES[new Date().getMonth()],
    year: new Date().getFullYear(),
  });

  const user = JSON.parse(localStorage.getItem('user') || 'null');

  const fetchData = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();
      const currMonth = MONTH_NAMES[new Date().getMonth()];
      const currYear = new Date().getFullYear();

      const [expRes, salRes, billRes, budRes, savRes] = await Promise.all([
        fetch('/api/expenses', { headers }),
        fetch('/api/salaries', { headers }),
        fetch('/api/bills', { headers }),
        fetch(`/api/budget?month=${currMonth}&year=${currYear}`, { headers }),
        fetch('/api/savings', { headers }),
      ]);

      if (expRes.ok) setExpenses(await expRes.json());
      if (salRes.ok) setSalaries(await salRes.json());
      if (billRes.ok) setBills(await billRes.json());
      if (budRes.ok) setBudget(await budRes.json());
      if (savRes.ok) setSavingsGoals(await savRes.json());
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      notify('Could not load some dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOverrideBalance = (newBalance) => {
    setCustomBalance(newBalance);
    if (newBalance === null) {
      localStorage.removeItem('rupeerise_custom_balance');
      notify('Available balance reset to recorded total');
    } else {
      localStorage.setItem('rupeerise_custom_balance', String(newBalance));
      notify(`Available balance updated to ₹${Number(newBalance).toLocaleString('en-IN')}`);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Totals & Metrics
  const totalSal = salaries.reduce((acc, s) => acc + Number(s.amount || 0), 0);
  const totalExp = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const balance = totalSal - totalExp;
  const savingsRate = totalSal > 0 ? (((totalSal - totalExp) / totalSal) * 100).toFixed(1) : null;

  // Current Month budget metrics
  const currMonthNum = new Date().getMonth();
  const currYear = new Date().getFullYear();
  const thisMonthExpenses = expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getMonth() === currMonthNum && d.getFullYear() === currYear;
  });
  const thisMonthSpent = thisMonthExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const monthlyBudgetLimit = budget?.monthlyLimit ? Number(budget.monthlyLimit) : 0;
  const budgetUsagePercent = monthlyBudgetLimit > 0 ? (thisMonthSpent / monthlyBudgetLimit) * 100 : 0;

  // Bill alerts logic
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const billStats = useMemo(() => {
    const upcoming = [];
    const paid = [];
    const alerts = [];

    bills.forEach((bill) => {
      if (bill.status === 'paid') {
        paid.push(bill);
        return;
      }
      const dueDate = new Date(bill.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
      upcoming.push({ ...bill, diffDays });

      const name = `${bill.billName} (${formatINR(bill.amount)})`;
      if (diffDays < 0) {
        alerts.push({
          type: 'overdue',
          text: `${name} is overdue by ${Math.abs(diffDays)} day(s)!`,
        });
      } else if (diffDays === 0) {
        alerts.push({
          type: 'today',
          text: `${name} is due today!`,
        });
      } else if (diffDays <= 3) {
        alerts.push({
          type: 'soon',
          text: `${name} is due in ${diffDays} day(s).`,
        });
      }
    });

    upcoming.sort((a, b) => a.diffDays - b.diffDays);
    paid.sort((a, b) => new Date(b.paidDate || 0) - new Date(a.paidDate || 0));

    return {
      upcoming: upcoming.slice(0, 5),
      paid: paid.slice(0, 5),
      alerts,
    };
  }, [bills]);

  // Chart: Category Donut
  const categoryChartConfig = useMemo(() => {
    const byCategory = {};
    expenses.forEach((e) => {
      const cat = e.category || 'Other';
      byCategory[cat] = (byCategory[cat] || 0) + Number(e.amount || 0);
    });

    const labels = Object.keys(byCategory);
    const data = Object.values(byCategory);
    const colors = labels.map((c) => CATEGORY_COLORS[c] || '#64748B');

    return {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: 'var(--card-bg)',
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 16,
              color: 'var(--text-secondary)',
              font: { family: 'Inter', size: 12 },
            },
          },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.label}: ${formatINR(context.raw)}`,
            },
          },
        },
      },
    };
  }, [expenses]);

  // Chart: Monthly Spending Bar
  const monthlyChartConfig = useMemo(() => {
    const byMonth = {};
    const sorted = [...expenses].sort((a, b) => new Date(a.date) - new Date(b.date));

    sorted.forEach((e) => {
      const d = new Date(e.date);
      const key = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      byMonth[key] = (byMonth[key] || 0) + Number(e.amount || 0);
    });

    let keys = Object.keys(byMonth);
    if (timeRange === '3m') keys = keys.slice(-3);
    else if (timeRange === '6m') keys = keys.slice(-6);

    const values = keys.map((k) => byMonth[k]);

    return {
      type: 'bar',
      data: {
        labels: keys,
        datasets: [
          {
            label: 'Expenses',
            data: values,
            backgroundColor: 'rgba(53, 94, 59, 0.85)',
            hoverBackgroundColor: '#355E3B',
            borderRadius: 8,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => ` Spent: ${formatINR(context.raw)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: 'var(--text-secondary)', font: { family: 'Inter', size: 12 } },
          },
          y: {
            grid: { color: 'rgba(224, 232, 220, 0.7)' },
            ticks: {
              color: 'var(--text-secondary)',
              font: { family: 'Inter', size: 12 },
              callback: (val) => `₹${val}`,
            },
          },
        },
      },
    };
  }, [expenses, timeRange]);

  // Quick Action Handlers
  const handleAddExpense = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(expenseForm),
      });
      if (res.ok) {
        notify('Expense added successfully!');
        setExpenseModalOpen(false);
        setExpenseForm({
          amount: '',
          category: 'Grocery',
          date: new Date().toISOString().split('T')[0],
          paymentMethod: 'UPI',
          description: '',
        });
        fetchData();
      } else {
        const err = await res.json();
        notify(err.message || 'Failed to add expense', 'error');
      }
    } catch {
      notify('An error occurred while adding expense', 'error');
    }
  };

  const handleAddBill = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(billForm),
      });
      if (res.ok) {
        notify('Bill reminder created!');
        setBillModalOpen(false);
        setBillForm({
          billName: '',
          amount: '',
          dueDate: new Date().toISOString().split('T')[0],
          category: 'Utilities',
          recurring: 'monthly',
        });
        fetchData();
      } else {
        notify('Failed to add bill reminder', 'error');
      }
    } catch {
      notify('An error occurred', 'error');
    }
  };

  const handleAddSalary = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/salaries', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(salaryForm),
      });
      if (res.ok) {
        notify('Salary income recorded!');
        setSalaryModalOpen(false);
        fetchData();
      } else {
        notify('Failed to record salary', 'error');
      }
    } catch {
      notify('An error occurred', 'error');
    }
  };

  return (
    <Layout title="Dashboard - RupeeRise">
      <div className="dashboard-grid">
        {/* Header with welcome and quick actions */}
        <PageHeader
          title={user?.name ? `Welcome back, ${user.name}` : 'Financial Dashboard'}
          description="Real-time financial summary, monthly cash flow, and bill reminders."
          actions={
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-primary"
                onClick={() => setExpenseModalOpen(true)}
              >
                <Plus size={18} />
                <span>Add Expense</span>
              </button>
            </div>
          }
        />

        {/* Bill Alerts Banner */}
        {billStats.alerts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {billStats.alerts.map((alert, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  background:
                    alert.type === 'overdue'
                      ? 'var(--danger-light)'
                      : 'var(--warning-light)',
                  color:
                    alert.type === 'overdue'
                      ? 'var(--danger-color)'
                      : '#B45309',
                  border: `1px solid ${
                    alert.type === 'overdue'
                      ? 'var(--danger-border)'
                      : 'var(--warning-border)'
                  }`,
                  fontSize: '0.9rem',
                  fontWeight: 500,
                }}
              >
                <AlertTriangle size={18} />
                <span>{alert.text}</span>
                <Link
                  to="/bills"
                  style={{
                    marginLeft: 'auto',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    textDecoration: 'underline',
                    color: 'inherit',
                  }}
                >
                  Pay Now
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Top Stat Cards */}
        <div className="stat-grid">
          <StatCard
            title="Total Income"
            value={formatINR(totalSal)}
            icon={Wallet}
            iconColor="var(--success-color)"
            iconBg="var(--success-light)"
            badgeText={salaries.length > 0 ? `${salaries.length} Records` : 'No salary added'}
            badgeType={salaries.length > 0 ? 'success' : 'neutral'}
          />

          <StatCard
            title="Total Expenses"
            value={formatINR(totalExp)}
            icon={Receipt}
            iconColor="var(--danger-color)"
            iconBg="var(--danger-light)"
            badgeText={`${expenses.length} Transactions`}
            badgeType="neutral"
          />

          <StatCard
            title="Remaining Balance"
            value={formatINR(balance)}
            icon={PiggyBank}
            iconColor={balance >= 0 ? 'var(--primary-color)' : 'var(--danger-color)'}
            iconBg={balance >= 0 ? 'var(--primary-light)' : 'var(--danger-light)'}
            badgeText={balance >= 0 ? 'Surplus' : 'Deficit'}
            badgeType={balance >= 0 ? 'primary' : 'danger'}
          />

          <StatCard
            title="Savings Rate"
            value={savingsRate !== null ? `${savingsRate}%` : 'N/A'}
            icon={TrendingUp}
            iconColor="var(--primary-color)"
            iconBg="var(--primary-light)"
            subtitle={totalSal > 0 ? 'Of total recorded income' : 'Record salary to calculate'}
            badgeText={savingsRate !== null && Number(savingsRate) > 20 ? 'Healthy' : undefined}
            badgeType="success"
          />
        </div>

        {/* Safe-to-Spend Real-time Financial Commitment Calculator */}
        <SafeToSpendCard
          availableBalance={balance}
          bills={bills}
          expenses={expenses}
          savingsGoals={savingsGoals}
          budget={budget}
          customBalance={customBalance}
          onOverrideBalance={handleOverrideBalance}
        />

        {/* Quick Actions Bar */}
        <div className="quick-actions-bar">
          <span className="quick-actions-label">
            <Sparkles size={16} color="var(--primary-color)" /> Quick Actions:
          </span>
          <button className="btn btn-secondary" onClick={() => setExpenseModalOpen(true)}>
            <Plus size={16} /> New Expense
          </button>
          <button className="btn btn-secondary" onClick={() => setBillModalOpen(true)}>
            <CalendarCheck size={16} /> Add Bill
          </button>
          <button className="btn btn-secondary" onClick={() => setSalaryModalOpen(true)}>
            <Wallet size={16} /> Record Salary
          </button>
          <Link to="/reports" className="btn btn-ghost" style={{ marginLeft: 'auto' }}>
            <FileText size={16} /> Generate Report
          </Link>
        </div>

        {/* Budget Progress Banner (if monthly budget is set) */}
        {monthlyBudgetLimit > 0 && (
          <div className="budget-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0 }}>
                  Monthly Budget — {MONTH_NAMES[currMonthNum]} {currYear}
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
                  Spent {formatINR(thisMonthSpent)} of {formatINR(monthlyBudgetLimit)} limit
                </p>
              </div>
              <span
                className={`badge ${
                  budgetUsagePercent >= 100
                    ? 'badge-danger'
                    : budgetUsagePercent >= 80
                    ? 'badge-warning'
                    : 'badge-success'
                }`}
              >
                {budgetUsagePercent.toFixed(1)}% Used
              </span>
            </div>

            <div className="budget-progress-bar-bg">
              <div
                className="budget-progress-bar-fill"
                style={{
                  width: `${Math.min(budgetUsagePercent, 100)}%`,
                  background:
                    budgetUsagePercent >= 100
                      ? 'var(--danger-color)'
                      : budgetUsagePercent >= 80
                      ? 'var(--warning-color)'
                      : 'var(--success-color)',
                }}
              />
            </div>
          </div>
        )}

        {/* Charts Grid */}
        <div className="charts-grid">
          {/* Monthly Spending Bar Chart */}
          <div className="glass-card chart-card">
            <div className="chart-header">
              <div>
                <h3>Monthly Spending Trend</h3>
                <p style={{ margin: 0, fontSize: '0.8rem' }}>Expense history over time</p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['all', '6m', '3m'].map((range) => (
                  <button
                    key={range}
                    className={`btn ${timeRange === range ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ padding: '4px 10px', fontSize: '0.75rem', minHeight: 0 }}
                    onClick={() => setTimeRange(range)}
                  >
                    {range.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="chart-canvas-wrapper">
              {expenses.length > 0 ? (
                <ChartCanvas config={monthlyChartConfig} />
              ) : (
                <EmptyState
                  title="No monthly data"
                  description="Add your first expense to visualize spending trends."
                />
              )}
            </div>
          </div>

          {/* Category Donut Chart */}
          <div className="glass-card chart-card">
            <div className="chart-header">
              <div>
                <h3>Expenses by Category</h3>
                <p style={{ margin: 0, fontSize: '0.8rem' }}>Distribution of expenses</p>
              </div>
            </div>

            <div className="chart-canvas-wrapper">
              {expenses.length > 0 ? (
                <ChartCanvas config={categoryChartConfig} />
              ) : (
                <EmptyState
                  title="No expenses categorized"
                  description="Categorize expenses to see your spending breakdown."
                />
              )}
            </div>
          </div>
        </div>

        {/* Widgets: Upcoming Bills & Recent Transactions */}
        <div className="widgets-grid">
          {/* Upcoming Bills Widget */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3>Upcoming Bills</h3>
                <p style={{ margin: 0, fontSize: '0.8rem' }}>Unpaid bills due soon</p>
              </div>
              <Link to="/bills" className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>
                View All <ArrowRight size={14} />
              </Link>
            </div>

            <div>
              {billStats.upcoming.length === 0 ? (
                <EmptyState
                  icon={CalendarCheck}
                  title="All caught up!"
                  description="No pending bills at the moment."
                />
              ) : (
                billStats.upcoming.map((b) => (
                  <div key={b._id} className="widget-item">
                    <div>
                      <div className="widget-item-title">{b.billName}</div>
                      <div className="widget-item-sub">
                        <span
                          style={{
                            color: b.diffDays < 0 ? 'var(--danger-color)' : b.diffDays === 0 ? '#B45309' : 'inherit',
                            fontWeight: b.diffDays <= 0 ? 600 : 400,
                          }}
                        >
                          {b.diffDays < 0 ? `Overdue by ${Math.abs(b.diffDays)}d` : b.diffDays === 0 ? 'Due Today' : `Due in ${b.diffDays}d`}
                        </span>{' '}
                        • {b.category}
                      </div>
                    </div>
                    <div className="widget-item-amount">{formatINR(b.amount)}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Expenses Widget */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3>Recent Expenses</h3>
                <p style={{ margin: 0, fontSize: '0.8rem' }}>Latest recorded transactions</p>
              </div>
              <Link to="/expenses" className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>
                View All <ArrowRight size={14} />
              </Link>
            </div>

            <div>
              {expenses.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="No expenses logged"
                  description="Log your daily expenses to see transaction activity here."
                />
              ) : (
                expenses.slice(0, 5).map((exp) => (
                  <div key={exp._id} className="widget-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: `${CATEGORY_COLORS[exp.category] || '#64748B'}18`,
                          color: CATEGORY_COLORS[exp.category] || 'var(--primary-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                        }}
                      >
                        {(exp.category || 'O')[0]}
                      </div>
                      <div>
                        <div className="widget-item-title">{exp.category}</div>
                        <div className="widget-item-sub">
                          {formatDate(exp.date)} {exp.description ? `• ${exp.description}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="widget-item-amount" style={{ color: 'var(--danger-color)' }}>
                      -{formatINR(exp.amount)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Add Expense Modal */}
      <Modal
        isOpen={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        title="Add New Expense"
      >
        <form onSubmit={handleAddExpense}>
          <div className="form-group">
            <label>Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="e.g. 450.00"
              className="form-control"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Category</label>
            <select
              className="form-control"
              value={expenseForm.category}
              onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
            >
              {EXPENSE_CATEGORIES.map((cat) => (
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
              value={expenseForm.date}
              onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Payment Method</label>
            <select
              className="form-control"
              value={expenseForm.paymentMethod}
              onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })}
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
              placeholder="e.g. Weekly family groceries"
              className="form-control"
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              Save Expense
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setExpenseModalOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Add Bill Modal */}
      <Modal
        isOpen={billModalOpen}
        onClose={() => setBillModalOpen(false)}
        title="Add Bill Reminder"
      >
        <form onSubmit={handleAddBill}>
          <div className="form-group">
            <label>Bill Name</label>
            <input
              type="text"
              required
              placeholder="e.g. WiFi Fiber Internet"
              className="form-control"
              value={billForm.billName}
              onChange={(e) => setBillForm({ ...billForm, billName: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="e.g. 999.00"
              className="form-control"
              value={billForm.amount}
              onChange={(e) => setBillForm({ ...billForm, amount: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Due Date</label>
            <input
              type="date"
              required
              className="form-control"
              value={billForm.dueDate}
              onChange={(e) => setBillForm({ ...billForm, dueDate: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Recurring Cycle</label>
            <select
              className="form-control"
              value={billForm.recurring}
              onChange={(e) => setBillForm({ ...billForm, recurring: e.target.value })}
            >
              <option value="none">One-time (No recurring)</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              Create Bill Reminder
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setBillModalOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Record Salary Modal */}
      <Modal
        isOpen={salaryModalOpen}
        onClose={() => setSalaryModalOpen(false)}
        title="Record Monthly Salary"
      >
        <form onSubmit={handleAddSalary}>
          <div className="form-group">
            <label>Salary Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="e.g. 75000.00"
              className="form-control"
              value={salaryForm.amount}
              onChange={(e) => setSalaryForm({ ...salaryForm, amount: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Month</label>
            <select
              className="form-control"
              value={salaryForm.month}
              onChange={(e) => setSalaryForm({ ...salaryForm, month: e.target.value })}
            >
              {MONTH_NAMES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Year</label>
            <input
              type="number"
              required
              min="2000"
              max="2100"
              className="form-control"
              value={salaryForm.year}
              onChange={(e) => setSalaryForm({ ...salaryForm, year: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              Save Salary
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSalaryModalOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
