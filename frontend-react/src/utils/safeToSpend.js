/**
 * Safe-to-Spend Calculation Engine for RupeeRise
 *
 * Formula:
 * Estimated Safe-to-Spend =
 *   Current Available Balance
 *   - Unpaid Commitments Due Within the Planning Period
 *   - Essential Expenses Not Yet Accounted For
 *   - Planned Savings Not Yet Reserved
 */

/**
 * Estimates the user's next salary date based on historical salary entries or standard month-end/1st
 * @param {Array} salaries - List of user's salary records
 * @param {Date} [referenceDate] - Current reference date
 * @returns {Date} Estimated next salary date
 */
export function estimateNextSalaryDate(salaries = [], referenceDate = new Date()) {
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  // If user provided a salary with a specific day or we default to the 1st of next month
  // Most Indian salary cycles are 1st or last day of month (or 25th-30th)
  const nextMonthFirst = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
  return nextMonthFirst;
}

/**
 * Determines the end date for a given planning period
 * @param {string} period - 'payday' | 'month' | '7days' | '30days'
 * @param {Date} [nextPayday] - Next salary date
 * @param {Date} [referenceDate] - Reference date
 * @returns {Date}
 */
export function getPeriodEndDate(period, nextPayday, referenceDate = new Date()) {
  const ref = new Date(referenceDate);
  ref.setHours(23, 59, 59, 999);

  switch (period) {
    case '7days': {
      const d = new Date(ref);
      d.setDate(d.getDate() + 7);
      return d;
    }
    case '30days': {
      const d = new Date(ref);
      d.setDate(d.getDate() + 30);
      return d;
    }
    case 'payday': {
      if (nextPayday && nextPayday > ref) {
        const d = new Date(nextPayday);
        d.setHours(23, 59, 59, 999);
        return d;
      }
      // Fallback to end of month if payday not in future
      return new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
    }
    case 'month':
    default: {
      // Last day of current month
      return new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
    }
  }
}

/**
 * Centralized Safe-to-Spend calculator
 *
 * @param {Object} params
 * @param {number} params.availableBalance - Confirmed or calculated current balance (Salaries - Expenses)
 * @param {Array} params.bills - All recorded bills
 * @param {Array} params.expenses - All recorded expenses
 * @param {Array} [params.savingsGoals] - User's savings goals
 * @param {Object} [params.budget] - Current month's budget configuration
 * @param {string} [params.planningPeriod='payday'] - 'payday' | 'month' | '7days' | '30days'
 * @param {Date} [params.customNextPayday] - Optional user-configured payday
 * @param {Date} [params.referenceDate] - Reference date (defaults to today)
 * @returns {Object} Safe-to-spend breakdown and status
 */
export function calculateSafeToSpend({
  availableBalance = 0,
  bills = [],
  expenses = [],
  savingsGoals = [],
  budget = null,
  planningPeriod = 'payday',
  customNextPayday = null,
  referenceDate = new Date(),
} = {}) {
  const refDate = new Date(referenceDate);
  refDate.setHours(0, 0, 0, 0);

  const nextPayday = customNextPayday ? new Date(customNextPayday) : estimateNextSalaryDate([], refDate);
  const periodEndDate = getPeriodEndDate(planningPeriod, nextPayday, refDate);

  // 1. Calculate Unpaid Commitments due within the planning period
  // Rule: NEVER subtract a bill that is already marked 'paid'
  const unpaidBillsDue = bills.filter((b) => {
    if (b.status === 'paid') return false; // Already paid!
    if (!b.dueDate) return false;
    const due = new Date(b.dueDate);
    due.setHours(0, 0, 0, 0);
    // Include overdue bills and bills due up to the period end date
    return due <= periodEndDate;
  });

  const unpaidCommitments = unpaidBillsDue.reduce((sum, b) => sum + Number(b.amount || 0), 0);

  // 2. Calculate Essential Expenses Not Yet Accounted For
  // If the user has a monthly budget, calculate remaining essential allowance
  let essentialExpensesRemaining = 0;
  if (budget && Number(budget.monthlyLimit) > 0) {
    const monthlyLimit = Number(budget.monthlyLimit);
    const currMonth = refDate.getMonth();
    const currYear = refDate.getFullYear();

    const thisMonthSpent = expenses
      .filter((e) => {
        const d = new Date(e.date);
        return d.getMonth() === currMonth && d.getFullYear() === currYear;
      })
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const remainingBudget = Math.max(0, monthlyLimit - thisMonthSpent);
    // Essential portion roughly estimated or prorated for the remaining days
    const daysInMonth = new Date(currYear, currMonth + 1, 0).getDate();
    const dayOfMonth = refDate.getDate();
    const daysLeftInMonth = Math.max(1, daysInMonth - dayOfMonth + 1);

    const periodDays = Math.max(1, Math.ceil((periodEndDate - refDate) / (1000 * 60 * 60 * 24)));
    const ratio = Math.min(1, periodDays / daysLeftInMonth);

    // Essential buffer is remaining budget minus unpaid commitments already counted
    essentialExpensesRemaining = Math.max(0, (remainingBudget * ratio) - unpaidCommitments);
  }

  // 3. Calculate Planned Savings Not Yet Reserved
  // User's active savings goals remaining contribution needed for this month/period
  let plannedSavingsNotReserved = 0;
  if (Array.isArray(savingsGoals) && savingsGoals.length > 0) {
    savingsGoals.forEach((goal) => {
      const target = Number(goal.targetAmount || 0);
      const current = Number(goal.currentAmount || 0);
      const remainingTarget = Math.max(0, target - current);

      if (remainingTarget > 0) {
        // If there's a target date, distribute evenly, otherwise reserve 10% or modest planned chunk
        if (goal.targetDate) {
          const tDate = new Date(goal.targetDate);
          const monthsLeft = Math.max(1, (tDate.getFullYear() - refDate.getFullYear()) * 12 + (tDate.getMonth() - refDate.getMonth()));
          plannedSavingsNotReserved += remainingTarget / monthsLeft;
        } else {
          // Default monthly contribution target (5% of remaining target or up to ₹2,000)
          plannedSavingsNotReserved += Math.min(remainingTarget * 0.05, 2000);
        }
      }
    });
  }

  // Round planned savings for clean figures
  plannedSavingsNotReserved = Math.round(plannedSavingsNotReserved);
  essentialExpensesRemaining = Math.round(essentialExpensesRemaining);

  // 4. Calculate Final Safe-to-Spend
  // Formula: Current Balance - Unpaid Bills - Essential Expenses - Planned Savings
  const totalDeductions = unpaidCommitments + essentialExpensesRemaining + plannedSavingsNotReserved;
  const safeToSpend = availableBalance - totalDeductions;
  const isDeficit = safeToSpend < 0;
  const deficitAmount = isDeficit ? Math.abs(safeToSpend) : 0;

  // Days in horizon
  const daysInHorizon = Math.max(1, Math.ceil((periodEndDate - refDate) / (1000 * 60 * 60 * 24)));
  const dailySafeToSpend = isDeficit ? 0 : Math.floor(safeToSpend / daysInHorizon);

  // Human-readable labels
  const periodLabels = {
    payday: 'Until Next Salary',
    month: 'Rest of the Month',
    '7days': 'Next 7 Days',
    '30days': 'Next 30 Days',
  };

  const periodLabel = periodLabels[planningPeriod] || 'Planning Period';

  // Warnings & explanations
  let warning = null;
  if (isDeficit) {
    warning = `Warning: Your upcoming commitments and planned savings exceed your available balance by ₹${deficitAmount.toLocaleString('en-IN')}.`;
  } else if (safeToSpend < 1000 && safeToSpend > 0) {
    warning = 'Caution: You have a tight safe-to-spend margin. Prioritize essential expenses only.';
  }

  const explanation = isDeficit
    ? `You have ₹${availableBalance.toLocaleString('en-IN')} available, but ₹${totalDeductions.toLocaleString('en-IN')} is committed for bills and essential expenses.`
    : `Your estimated safe-to-spend amount is ₹${Math.floor(safeToSpend).toLocaleString('en-IN')} ${periodLabel.toLowerCase()} (approx. ₹${dailySafeToSpend.toLocaleString('en-IN')}/day).`;

  return {
    availableBalance,
    unpaidCommitments,
    unpaidBillsDue,
    unpaidBillsCount: unpaidBillsDue.length,
    essentialExpensesRemaining,
    plannedSavingsNotReserved,
    totalDeductions,
    safeToSpend: Math.round(safeToSpend),
    dailySafeToSpend,
    isDeficit,
    deficitAmount: Math.round(deficitAmount),
    planningPeriod,
    periodLabel,
    periodEndDate,
    daysInHorizon,
    nextPayday,
    warning,
    explanation,
  };
}
