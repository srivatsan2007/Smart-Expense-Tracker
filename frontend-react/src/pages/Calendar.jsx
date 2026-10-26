import { useState, useEffect, useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { notify } from '../components/Toast.jsx';
import { getAuthHeaders } from '../hooks/useAuth.js';
import { formatINR, formatDate, CATEGORY_COLORS } from '../utils/formatters.js';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Receipt,
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Filter,
  Search,
  ArrowRight,
  IndianRupee,
  RefreshCw,
  Edit2
} from '../components/Icons.jsx';
import '../css/calendar.css';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function FinancialCalendar() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const highlightBillId = searchParams.get('highlightBill');

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week' | 'agenda'
  const [filterType, setFilterType] = useState('all'); // 'all' | 'bills_unpaid' | 'bills_paid' | 'expenses' | 'overdue'
  const [searchQuery, setSearchQuery] = useState('');

  const [bills, setBills] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Mark as paid modal
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedBillToPay, setSelectedBillToPay] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    paymentMethod: 'UPI',
    paymentReference: '',
    createExpense: true
  });
  const [processingPayment, setProcessingPayment] = useState(false);

  // Quick Add Modal
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false);
  const [addType, setAddType] = useState('expense'); // 'expense' | 'bill'
  const [quickExpenseForm, setQuickExpenseForm] = useState({
    amount: '',
    category: 'Grocery',
    paymentMethod: 'UPI',
    description: ''
  });
  const [quickBillForm, setQuickBillForm] = useState({
    billName: '',
    amount: '',
    category: 'Utilities',
    recurring: 'monthly'
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();
      const [expRes, billRes] = await Promise.all([
        fetch('/api/expenses', { headers }),
        fetch('/api/bills', { headers })
      ]);

      if (expRes.ok) setExpenses(await expRes.json());
      if (billRes.ok) setBills(await billRes.json());
    } catch (err) {
      console.error('Error fetching calendar data:', err);
      notify('Failed to load financial records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // If a highlight bill is specified in query string, select its due date
  useEffect(() => {
    if (highlightBillId && bills.length > 0) {
      const targetBill = bills.find(b => b._id === highlightBillId);
      if (targetBill && targetBill.dueDate) {
        const d = new Date(targetBill.dueDate);
        setCurrentDate(d);
        setSelectedDate(d);
      }
    }
  }, [highlightBillId, bills]);

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Helper to get payment status for a bill
  const getBillStatus = (bill) => {
    if (bill.status === 'paid') return 'completed';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(bill.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((dueDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'overdue';
    if (diffDays <= 3) return 'due_soon';
    return 'upcoming';
  };

  // Group events by YYYY-MM-DD
  const eventsByDate = useMemo(() => {
    const map = {};

    const addEvent = (dateStr, event) => {
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(event);
    };

    // Add Expenses
    expenses.forEach(exp => {
      if (!exp.date) return;
      const d = new Date(exp.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      addEvent(key, {
        id: exp._id,
        type: 'expense',
        title: exp.description || exp.category || 'Expense',
        category: exp.category || 'Other',
        amount: Number(exp.amount || 0),
        date: d,
        paymentMethod: exp.paymentMethod || 'Cash',
        isBillPayment: Boolean(exp.isBillPayment),
        raw: exp
      });
    });

    // Add Bills
    bills.forEach(bill => {
      if (!bill.dueDate) return;
      const d = new Date(bill.dueDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const status = getBillStatus(bill);

      addEvent(key, {
        id: bill._id,
        type: 'bill',
        title: bill.billName,
        category: bill.category || 'Utilities',
        amount: Number(bill.amount || 0),
        date: d,
        dueDate: d,
        status, // 'completed' | 'overdue' | 'due_soon' | 'upcoming'
        paidDate: bill.paidDate,
        recurring: bill.recurring,
        raw: bill
      });
    });

    return map;
  }, [expenses, bills]);

  // Compute month cells
  const monthCells = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const cells = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const dateObj = new Date(year, month - 1, d);
      const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      cells.push({
        date: dateObj,
        dayNumber: d,
        isCurrentMonth: false,
        key,
        events: eventsByDate[key] || []
      });
    }

    // Current month days
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({
        date: dateObj,
        dayNumber: day,
        isCurrentMonth: true,
        key,
        events: eventsByDate[key] || []
      });
    }

    // Next month padding to fill complete weeks (multiples of 7)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const dateObj = new Date(year, month + 1, i);
      const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      cells.push({
        date: dateObj,
        dayNumber: i,
        isCurrentMonth: false,
        key,
        events: eventsByDate[key] || []
      });
    }

    return cells;
  }, [year, month, eventsByDate]);

  // Navigation handlers
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  // Selected date key
  const selectedDateKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
  const rawDayEvents = eventsByDate[selectedDateKey] || [];

  // Filter items based on active chip and search query
  const filterEvent = (item) => {
    // Search query check
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchCat = item.category?.toLowerCase().includes(q);
      if (!matchTitle && !matchCat) return false;
    }

    // Type filter
    if (filterType === 'expenses') return item.type === 'expense';
    if (filterType === 'bills_unpaid') return item.type === 'bill' && item.status !== 'completed';
    if (filterType === 'bills_paid') return item.type === 'bill' && item.status === 'completed';
    if (filterType === 'overdue') return item.type === 'bill' && item.status === 'overdue';

    return true;
  };

  const selectedDayItems = rawDayEvents.filter(filterEvent);

  // Selected day totals
  const daySummary = useMemo(() => {
    let totalExp = 0;
    let totalBillsDue = 0;
    let totalBillsPaid = 0;

    rawDayEvents.forEach(e => {
      if (e.type === 'expense') {
        totalExp += e.amount;
      } else if (e.type === 'bill') {
        if (e.status === 'completed') totalBillsPaid += e.amount;
        else totalBillsDue += e.amount;
      }
    });

    return { totalExp, totalBillsDue, totalBillsPaid };
  }, [rawDayEvents]);

  // Handle Mark as Paid
  const handleOpenPayModal = (bill) => {
    setSelectedBillToPay(bill);
    setPaymentForm({
      paymentMethod: 'UPI',
      paymentReference: '',
      createExpense: true
    });
    setPayModalOpen(true);
  };

  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    if (!selectedBillToPay) return;

    try {
      setProcessingPayment(true);
      const res = await fetch(`/api/bills/${selectedBillToPay.id || selectedBillToPay._id}/pay`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          paymentMethod: paymentForm.paymentMethod,
          paymentReference: paymentForm.paymentReference,
          createExpense: paymentForm.createExpense,
          paidDate: new Date().toISOString()
        })
      });

      if (res.ok) {
        notify(`Bill "${selectedBillToPay.title || selectedBillToPay.billName}" marked as paid!`);
        setPayModalOpen(false);
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        notify(err.message || 'Failed to update payment status', 'error');
      }
    } catch (err) {
      console.error(err);
      notify('An error occurred during payment confirmation', 'error');
    } finally {
      setProcessingPayment(false);
    }
  };

  // Handle Payment Reversal
  const handleReversePayment = async (bill) => {
    if (!window.confirm(`Reverse payment for "${bill.title || bill.billName}"? This will restore it as an unpaid bill.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/bills/${bill.id || bill._id}/unpay`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });

      if (res.ok) {
        notify('Payment reversed successfully! Bill is now pending.');
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        notify(err.message || 'Failed to reverse payment', 'error');
      }
    } catch {
      notify('Error reversing payment', 'error');
    }
  };

  // Quick Add Item Handlers
  const handleCreateQuickItem = async (e) => {
    e.preventDefault();
    const formattedDate = selectedDate.toISOString().split('T')[0];

    try {
      if (addType === 'expense') {
        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            amount: Number(quickExpenseForm.amount),
            category: quickExpenseForm.category,
            paymentMethod: quickExpenseForm.paymentMethod,
            description: quickExpenseForm.description,
            date: formattedDate
          })
        });

        if (res.ok) {
          notify('Expense logged on calendar!');
          setQuickAddModalOpen(false);
          setQuickExpenseForm({ amount: '', category: 'Grocery', paymentMethod: 'UPI', description: '' });
          fetchData();
        } else {
          notify('Failed to add expense', 'error');
        }
      } else {
        const res = await fetch('/api/bills', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            billName: quickBillForm.billName,
            amount: Number(quickBillForm.amount),
            dueDate: formattedDate,
            category: quickBillForm.category,
            recurring: quickBillForm.recurring
          })
        });

        if (res.ok) {
          notify('Bill reminder added to calendar!');
          setQuickAddModalOpen(false);
          setQuickBillForm({ billName: '', amount: '', category: 'Utilities', recurring: 'monthly' });
          fetchData();
        } else {
          notify('Failed to add bill', 'error');
        }
      }
    } catch {
      notify('Error creating transaction', 'error');
    }
  };

  // Agenda View: list all items in the month
  const agendaItemsByDate = useMemo(() => {
    const list = [];
    const keys = Object.keys(eventsByDate).sort();

    keys.forEach(k => {
      const d = new Date(k);
      // Filter to current selected month in agenda mode
      if (d.getFullYear() === year && d.getMonth() === month) {
        const filtered = (eventsByDate[k] || []).filter(filterEvent);
        if (filtered.length > 0) {
          list.push({
            dateKey: k,
            date: d,
            items: filtered
          });
        }
      }
    });

    return list;
  }, [eventsByDate, year, month, filterType, searchQuery]);

  // Today check helper
  const isToday = (d) => {
    const t = new Date();
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
  };

  const isSelected = (d) => {
    return d.getDate() === selectedDate.getDate() && d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear();
  };

  return (
    <Layout title="Automatic Financial Calendar - RupeeRise" active="calendar">
      <div className="calendar-page-grid">
        {/* Page Header */}
        <PageHeader
          title="Automatic Financial Calendar"
          subtitle="Real-time schedule of recorded expenses, upcoming bills, payment due dates, and completed settlements."
          actions={
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setAddType('expense');
                  setQuickAddModalOpen(true);
                }}
              >
                <Plus size={18} />
                <span>Add Record</span>
              </button>
            </div>
          }
        />

        {/* Top Controls Bar: Month Nav + View Toggles */}
        <div className="glass-card calendar-top-bar">
          <div className="calendar-nav-controls">
            <button className="btn btn-secondary" onClick={goToToday} style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
              Today
            </button>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-ghost" onClick={prevMonth} aria-label="Previous Month" style={{ padding: '6px 10px' }}>
                <ChevronLeft size={18} />
              </button>
              <button className="btn btn-ghost" onClick={nextMonth} aria-label="Next Month" style={{ padding: '6px 10px' }}>
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="calendar-month-title">
              {MONTH_NAMES[month]} {year}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* View Mode Toggle */}
            <div className="calendar-view-toggle">
              <button
                className={`calendar-view-btn ${viewMode === 'month' ? 'active' : ''}`}
                onClick={() => setViewMode('month')}
              >
                Month Grid
              </button>
              <button
                className={`calendar-view-btn ${viewMode === 'agenda' ? 'active' : ''}`}
                onClick={() => setViewMode('agenda')}
              >
                Agenda List
              </button>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="calendar-filters-bar">
          <div className="calendar-filter-chips">
            <button
              className={`calendar-filter-chip ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              All Items
            </button>
            <button
              className={`calendar-filter-chip ${filterType === 'bills_unpaid' ? 'active' : ''}`}
              onClick={() => setFilterType('bills_unpaid')}
            >
              Unpaid Bills
            </button>
            <button
              className={`calendar-filter-chip ${filterType === 'overdue' ? 'active' : ''}`}
              onClick={() => setFilterType('overdue')}
            >
              Overdue
            </button>
            <button
              className={`calendar-filter-chip ${filterType === 'bills_paid' ? 'active' : ''}`}
              onClick={() => setFilterType('bills_paid')}
            >
              Completed Payments
            </button>
            <button
              className={`calendar-filter-chip ${filterType === 'expenses' ? 'active' : ''}`}
              onClick={() => setFilterType('expenses')}
            >
              Expenses Only
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 220 }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type="text"
                placeholder="Search bill or category..."
                className="form-control"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ padding: '6px 12px 6px 32px', fontSize: '0.82rem' }}
              />
              <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                <Search size={14} />
              </div>
            </div>
          </div>
        </div>

        {/* Calendar Layout: Grid on left, Details Panel on right */}
        {viewMode === 'month' ? (
          <div className="calendar-layout-container">
            {/* Left: Month Calendar */}
            <div className="calendar-grid-card">
              {/* Day of Week Headers */}
              <div className="calendar-weekdays-header">
                {DAY_NAMES.map(day => (
                  <div key={day}>{day}</div>
                ))}
              </div>

              {/* Month Grid Cells */}
              <div className="calendar-month-grid">
                {monthCells.map((cell) => {
                  const todayClass = isToday(cell.date) ? 'today' : '';
                  const selectedClass = isSelected(cell.date) ? 'selected' : '';
                  const otherMonthClass = !cell.isCurrentMonth ? 'other-month' : '';

                  const filteredCellEvents = cell.events.filter(filterEvent);
                  const billsCount = filteredCellEvents.filter(e => e.type === 'bill').length;
                  const expCount = filteredCellEvents.filter(e => e.type === 'expense').length;

                  return (
                    <div
                      key={cell.key}
                      className={`calendar-day-cell ${todayClass} ${selectedClass} ${otherMonthClass}`}
                      onClick={() => setSelectedDate(cell.date)}
                    >
                      <div className="calendar-day-header">
                        <span className="day-number-badge">
                          {cell.dayNumber}
                        </span>
                        {filteredCellEvents.length > 0 && (
                          <span className="day-total-badge">
                            {filteredCellEvents.length} item{filteredCellEvents.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {/* Event Chips Preview (up to 3 items) */}
                      <div className="calendar-cell-items">
                        {filteredCellEvents.slice(0, 3).map((item) => {
                          if (item.type === 'bill') {
                            const chipClass =
                              item.status === 'completed'
                                ? 'calendar-chip-bill-completed'
                                : item.status === 'overdue'
                                ? 'calendar-chip-bill-overdue'
                                : item.status === 'due_soon'
                                ? 'calendar-chip-bill-soon'
                                : 'calendar-chip-bill-upcoming';

                            return (
                              <div key={item.id} className={`calendar-chip ${chipClass}`} title={`${item.title} (${formatINR(item.amount)})`}>
                                <span>{item.title}</span>
                              </div>
                            );
                          } else {
                            return (
                              <div key={item.id} className="calendar-chip calendar-chip-expense" title={`${item.title} (${formatINR(item.amount)})`}>
                                <span>-{formatINR(item.amount)}</span>
                              </div>
                            );
                          }
                        })}

                        {filteredCellEvents.length > 3 && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, paddingLeft: 4 }}>
                            +{filteredCellEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Selected Day Detail Panel */}
            <div className="calendar-day-panel">
              <div className="day-panel-header">
                <h4 className="day-panel-title">
                  {formatDate(selectedDate)}
                </h4>
                <div className="day-panel-summary-row">
                  <span>Day Commitments</span>
                  <span style={{ fontWeight: 700, color: daySummary.totalBillsDue > 0 ? 'var(--danger-color)' : 'var(--text-color)' }}>
                    Bills Due: {formatINR(daySummary.totalBillsDue)}
                  </span>
                </div>
                {daySummary.totalExp > 0 && (
                  <div className="day-panel-summary-row" style={{ marginTop: 2 }}>
                    <span>Expenses Recorded</span>
                    <span style={{ fontWeight: 600, color: 'var(--danger-color)' }}>
                      -{formatINR(daySummary.totalExp)}
                    </span>
                  </div>
                )}
                {daySummary.totalBillsPaid > 0 && (
                  <div className="day-panel-summary-row" style={{ marginTop: 2 }}>
                    <span>Completed Settlements</span>
                    <span style={{ fontWeight: 600, color: 'var(--success-color)' }}>
                      {formatINR(daySummary.totalBillsPaid)}
                    </span>
                  </div>
                )}
              </div>

              {/* Day Items List */}
              <div className="day-panel-items">
                {selectedDayItems.length === 0 ? (
                  <EmptyState
                    icon={CalendarIcon}
                    title="No activity on this date"
                    description="No expenses or bill due dates recorded for this day."
                  />
                ) : (
                  selectedDayItems.map((item) => (
                    <div key={item.id} className="day-item-card">
                      <div className="day-item-header">
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background:
                                  item.type === 'expense'
                                    ? '#64748B'
                                    : item.status === 'completed'
                                    ? 'var(--success-color)'
                                    : item.status === 'overdue'
                                    ? 'var(--danger-color)'
                                    : item.status === 'due_soon'
                                    ? '#F59E0B'
                                    : 'var(--primary-color)'
                              }}
                            />
                            <span className="day-item-name">{item.title}</span>
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            {item.category} • {item.type === 'bill' ? 'Bill Due Date' : `Paid via ${item.paymentMethod}`}
                          </div>
                        </div>

                        <div
                          className="day-item-amount"
                          style={{
                            color: item.type === 'expense'
                              ? 'var(--danger-color)'
                              : item.status === 'completed'
                              ? 'var(--success-color)'
                              : 'var(--text-color)'
                          }}
                        >
                          {item.type === 'expense' ? `-${formatINR(item.amount)}` : formatINR(item.amount)}
                        </div>
                      </div>

                      {/* Footer & Actions for Bills */}
                      {item.type === 'bill' && (
                        <div className="day-item-footer">
                          <div>
                            <span
                              className={`badge ${
                                item.status === 'completed'
                                  ? 'badge-success'
                                  : item.status === 'overdue'
                                  ? 'badge-danger'
                                  : item.status === 'due_soon'
                                  ? 'badge-warning'
                                  : 'badge-neutral'
                              }`}
                              style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                            >
                              {item.status === 'completed'
                                ? 'Completed'
                                : item.status === 'overdue'
                                ? 'Overdue'
                                : item.status === 'due_soon'
                                ? 'Due Soon'
                                : 'Upcoming'}
                            </span>
                            {item.recurring && item.recurring !== 'none' && (
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 6 }}>
                                ({item.recurring})
                              </span>
                            )}
                          </div>

                          {/* Mark as paid / Reverse button */}
                          {item.status === 'completed' ? (
                            <button
                              className="btn btn-ghost"
                              style={{ padding: '2px 8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}
                              onClick={() => handleReversePayment(item)}
                              title="Reverse payment confirmation"
                            >
                              <RefreshCw size={12} /> Reverse
                            </button>
                          ) : (
                            <button
                              className="btn btn-primary"
                              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              onClick={() => handleOpenPayModal(item)}
                            >
                              <CheckCircle2 size={13} /> Mark as Paid
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Add item on selected day shortcut */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem' }}
                  onClick={() => setQuickAddModalOpen(true)}
                >
                  <Plus size={15} /> Add Entry for this Date
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Agenda / List View */
          <div className="calendar-agenda-container">
            {agendaItemsByDate.length === 0 ? (
              <EmptyState
                icon={CalendarIcon}
                title="No calendar records"
                description={`No bills or expenses found for ${MONTH_NAMES[month]} ${year} matching your filters.`}
              />
            ) : (
              agendaItemsByDate.map(group => (
                <div key={group.dateKey} className="agenda-date-group">
                  <div className="agenda-date-header">
                    <span>{formatDate(group.date)}</span>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      {group.items.length} transaction(s)
                    </span>
                  </div>

                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {group.items.map(item => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: 8,
                          background: 'var(--bg-main)',
                          border: '1px solid var(--border-color)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {item.type === 'bill' ? (
                            <CalendarCheck size={18} color="var(--primary-color)" />
                          ) : (
                            <Receipt size={18} color="#64748B" />
                          )}
                          <div>
                            <strong style={{ fontSize: '0.88rem', color: 'var(--text-color)' }}>
                              {item.title}
                            </strong>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              {item.category} • {item.type === 'bill' ? `Status: ${item.status}` : `Method: ${item.paymentMethod}`}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: '0.95rem',
                              color: item.type === 'expense'
                                ? 'var(--danger-color)'
                                : item.status === 'completed'
                                ? 'var(--success-color)'
                                : 'var(--text-color)'
                            }}
                          >
                            {item.type === 'expense' ? `-${formatINR(item.amount)}` : formatINR(item.amount)}
                          </span>

                          {item.type === 'bill' && item.status !== 'completed' && (
                            <button
                              className="btn btn-primary"
                              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              onClick={() => handleOpenPayModal(item)}
                            >
                              Pay Now
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Mark as Paid Confirmation Modal */}
      <Modal
        isOpen={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        title="Confirm Bill Payment"
      >
        {selectedBillToPay && (
          <form onSubmit={handleConfirmPayment}>
            <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg-main)', border: '1px solid var(--border-color)', marginBottom: 16 }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Bill Details</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-color)', marginTop: 2 }}>
                {selectedBillToPay.title || selectedBillToPay.billName}
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-color)', marginTop: 4 }}>
                {formatINR(selectedBillToPay.amount)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Due Date: {formatDate(selectedBillToPay.date || selectedBillToPay.dueDate)}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <select
                className="form-control"
                value={paymentForm.paymentMethod}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
              >
                <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                <option value="Net Banking">Net Banking</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Cash">Cash</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Payment Reference / Transaction ID (Optional)</label>
              <input
                type="text"
                placeholder="e.g. UPI Ref 3241098..."
                className="form-control"
                value={paymentForm.paymentReference}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentReference: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0' }}>
              <input
                type="checkbox"
                id="createExpCheck"
                checked={paymentForm.createExpense}
                onChange={(e) => setPaymentForm({ ...paymentForm, createExpense: e.target.checked })}
              />
              <label htmlFor="createExpCheck" style={{ fontSize: '0.85rem', color: 'var(--text-color)', cursor: 'pointer', margin: 0 }}>
                Also record as an expense transaction in spending history
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                disabled={processingPayment}
              >
                {processingPayment ? 'Confirming...' : 'Confirm Payment'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPayModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Quick Add Entry Modal for Selected Date */}
      <Modal
        isOpen={quickAddModalOpen}
        onClose={() => setQuickAddModalOpen(false)}
        title={`Add Entry for ${formatDate(selectedDate)}`}
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            className={`btn ${addType === 'expense' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, justifyContent: 'center', fontSize: '0.85rem' }}
            onClick={() => setAddType('expense')}
          >
            <Receipt size={16} /> Expense
          </button>
          <button
            type="button"
            className={`btn ${addType === 'bill' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, justifyContent: 'center', fontSize: '0.85rem' }}
            onClick={() => setAddType('bill')}
          >
            <CalendarCheck size={16} /> Bill Reminder
          </button>
        </div>

        <form onSubmit={handleCreateQuickItem}>
          {addType === 'expense' ? (
            <>
              <div className="form-group">
                <label className="form-label">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 750"
                  className="form-control"
                  value={quickExpenseForm.amount}
                  onChange={(e) => setQuickExpenseForm({ ...quickExpenseForm, amount: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-control"
                  value={quickExpenseForm.category}
                  onChange={(e) => setQuickExpenseForm({ ...quickExpenseForm, category: e.target.value })}
                >
                  <option value="Grocery">Grocery</option>
                  <option value="Medical">Medical</option>
                  <option value="Petrol">Petrol</option>
                  <option value="Electricity">Electricity</option>
                  <option value="Internet">Internet</option>
                  <option value="Rent">Rent</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Dining">Dining</option>
                  <option value="Travel">Travel</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly milk and dairy"
                  className="form-control"
                  value={quickExpenseForm.description}
                  onChange={(e) => setQuickExpenseForm({ ...quickExpenseForm, description: e.target.value })}
                />
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Bill Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electricity Bill"
                  className="form-control"
                  value={quickBillForm.billName}
                  onChange={(e) => setQuickBillForm({ ...quickBillForm, billName: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 1450"
                  className="form-control"
                  value={quickBillForm.amount}
                  onChange={(e) => setQuickBillForm({ ...quickBillForm, amount: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-control"
                  value={quickBillForm.category}
                  onChange={(e) => setQuickBillForm({ ...quickBillForm, category: e.target.value })}
                >
                  <option value="Utilities">Utilities</option>
                  <option value="Internet/Phone">Internet/Phone</option>
                  <option value="Rent/Mortgage">Rent/Mortgage</option>
                  <option value="Insurance">Insurance</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Subscriptions">Subscriptions</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Recurrence Cycle</label>
                <select
                  className="form-control"
                  value={quickBillForm.recurring}
                  onChange={(e) => setQuickBillForm({ ...quickBillForm, recurring: e.target.value })}
                >
                  <option value="none">One-time (No Recurring)</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              Save Entry
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setQuickAddModalOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
