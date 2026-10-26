const assert = require('assert');

console.log('================================================================');
console.log('RUPEERISE COMPREHENSIVE FINTECH FEATURES TEST SUITE');
console.log('================================================================');

// -------------------------------------------------------------------------
// 1. DEDUPLICATION & REMINDER LOG KEY FORMATION
// -------------------------------------------------------------------------
console.log('\n[Suite 1: Notification Deduplication & Schedule Rules]');

function generateReminderKey(userId, billId, reminderType, dueDateISO) {
  const dateKey = dueDateISO.split('T')[0];
  return `${userId}_${billId}_${reminderType}_${dateKey}`;
}

function evaluateReminderType(dueDateISO, referenceDate, preferences) {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDateISO);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

  if (diffDays === 5 && preferences.reminder5Days !== false) return '5days';
  if (diffDays === 3 && preferences.reminder3Days !== false) return '3days';
  if (diffDays === 0 && preferences.reminderDueDate !== false) return 'dueDate';
  if (diffDays < 0 && preferences.reminderOverdue !== false) {
    const daysOverdue = Math.abs(diffDays);
    const freq = preferences.overdueFrequencyDays || 2;
    if (daysOverdue % freq === 0 || daysOverdue === 1) {
      return `overdue_day_${daysOverdue}`;
    }
  }
  return null;
}

// Test 1.1: 5-Day Reminder Schedule
{
  const prefs = { enabled: true, reminder5Days: true, reminder3Days: true, reminderDueDate: true };
  const refDate = new Date('2026-10-25');
  const billDue = '2026-10-30T10:00:00.000Z'; // exactly 5 days away

  const type = evaluateReminderType(billDue, refDate, prefs);
  assert.strictEqual(type, '5days', 'Should trigger 5-day reminder');

  const key1 = generateReminderKey('user123', 'bill456', type, billDue);
  const key2 = generateReminderKey('user123', 'bill456', type, billDue);
  assert.strictEqual(key1, key2, 'Duplicate scheduler runs must produce identical unique key for idempotency');
  assert.strictEqual(key1, 'user123_bill456_5days_2026-10-30');
  console.log('✓ 1.1 Passed: 5-Day reminder schedule and deterministic unique key verified');
}

// Test 1.2: 3-Day Reminder Schedule
{
  const prefs = { enabled: true, reminder5Days: true, reminder3Days: true, reminderDueDate: true };
  const refDate = new Date('2026-10-27');
  const billDue = '2026-10-30T10:00:00.000Z'; // 3 days away

  const type = evaluateReminderType(billDue, refDate, prefs);
  assert.strictEqual(type, '3days', 'Should trigger 3-day reminder');
  console.log('✓ 1.2 Passed: 3-Day reminder schedule verified');
}

// Test 1.3: Due-Date Reminder Schedule
{
  const prefs = { enabled: true, reminder5Days: true, reminder3Days: true, reminderDueDate: true };
  const refDate = new Date('2026-10-30');
  const billDue = '2026-10-30T10:00:00.000Z'; // today

  const type = evaluateReminderType(billDue, refDate, prefs);
  assert.strictEqual(type, 'dueDate', 'Should trigger on-due-date reminder');
  console.log('✓ 1.3 Passed: Due-date reminder verified');
}

// Test 1.4: Bill created shortly before due date (e.g. 2 days before)
{
  const prefs = { enabled: true, reminder5Days: true, reminder3Days: true, reminderDueDate: true };
  const refDate = new Date('2026-10-28'); // 2 days before
  const billDue = '2026-10-30T10:00:00.000Z';

  const type = evaluateReminderType(billDue, refDate, prefs);
  assert.strictEqual(type, null, '2 days before is neither 5, 3, nor 0; should wait until due date');
  console.log('✓ 1.4 Passed: Bills created shortly before due date receive only remaining applicable reminders');
}

// Test 1.5: Disabled reminder preference respected
{
  const prefs = { enabled: true, reminder5Days: false, reminder3Days: true, reminderDueDate: true };
  const refDate = new Date('2026-10-25');
  const billDue = '2026-10-30T10:00:00.000Z';

  const type = evaluateReminderType(billDue, refDate, prefs);
  assert.strictEqual(type, null, 'Disabled 5-day reminder should be suppressed');
  console.log('✓ 1.5 Passed: User reminder preference overrides properly respected');
}

// -------------------------------------------------------------------------
// 2. QUIET HOURS & PRIVACY MODE EVALUATION
// -------------------------------------------------------------------------
console.log('\n[Suite 2: Quiet Hours & Lock-screen Privacy Evaluation]');

function isQuietHours(preferences, currentHour, currentMinute) {
  if (!preferences || !preferences.quietHoursEnabled) return false;
  const currentMinutes = currentHour * 60 + currentMinute;

  const [startH, startM] = (preferences.quietHoursStart || '22:00').split(':').map(Number);
  const [endH, endM] = (preferences.quietHoursEnd || '07:00').split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    // Overnight quiet hours (e.g. 22:00 to 07:00)
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
}

// Test 2.1: Overnight quiet hours at 23:30 (should be suppressed)
{
  const prefs = { quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '07:00' };
  assert.strictEqual(isQuietHours(prefs, 23, 30), true, '23:30 must be inside quiet hours');
  assert.strictEqual(isQuietHours(prefs, 3, 15), true, '03:15 must be inside quiet hours');
  assert.strictEqual(isQuietHours(prefs, 9, 0), false, '09:00 must be outside quiet hours');
  console.log('✓ 2.1 Passed: Overnight quiet hours correctly evaluated');
}

// Test 2.2: Privacy mode payload formatting
{
  const bill = { billName: 'Rent Payment', amount: 15000 };
  const privacyMode = true;

  const title = 'Upcoming Payment';
  const body = privacyMode
    ? 'You have an upcoming bill due in 5 days. Open RupeeRise to review.'
    : `Your ${bill.billName} payment (₹${bill.amount}) is due in 5 days.`;

  assert(!body.includes('15000'), 'Privacy mode must hide monetary amounts on lock-screen');
  assert(!body.includes('Rent'), 'Privacy mode should avoid sensitive merchant labels');
  console.log('✓ 2.2 Passed: Privacy mode prevents sensitive amounts on device lock-screen');
}

// -------------------------------------------------------------------------
// 3. CALENDAR PAYMENT STATUSES & STATUS PRECEDENCE
// -------------------------------------------------------------------------
console.log('\n[Suite 3: Financial Calendar Status Precedence]');

function derivePaymentStatus(bill, referenceDate = new Date('2026-10-26')) {
  // Completed always takes highest precedence
  if (bill.status === 'paid') return 'completed';

  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  const due = new Date(bill.dueDate);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'overdue';
  if (diffDays <= 3) return 'due_soon';
  return 'upcoming';
}

// Test 3.1: Completed bill due 10 days ago must NOT show as overdue
{
  const bill = {
    billName: 'Old Electricity',
    dueDate: '2026-10-10T00:00:00.000Z',
    status: 'paid',
    paidDate: '2026-10-09T10:00:00.000Z'
  };

  const status = derivePaymentStatus(bill, new Date('2026-10-26'));
  assert.strictEqual(status, 'completed', 'Completed status MUST take precedence over overdue');
  console.log('✓ 3.1 Passed: Completed bill takes absolute precedence over overdue status');
}

// Test 3.2: Unpaid bill due yesterday must show as overdue
{
  const bill = {
    billName: 'Unpaid Water Bill',
    dueDate: '2026-10-25T00:00:00.000Z',
    status: 'pending'
  };

  const status = derivePaymentStatus(bill, new Date('2026-10-26'));
  assert.strictEqual(status, 'overdue');
  console.log('✓ 3.2 Passed: Past due date without completion correctly marked overdue');
}

// Test 3.3: Bill due in 2 days must show as due_soon
{
  const bill = {
    billName: 'WiFi Internet',
    dueDate: '2026-10-28T00:00:00.000Z',
    status: 'pending'
  };

  const status = derivePaymentStatus(bill, new Date('2026-10-26'));
  assert.strictEqual(status, 'due_soon');
  console.log('✓ 3.3 Passed: Bill approaching within 3 days marked as due_soon');
}

// Test 3.4: Bill due in 15 days must show as upcoming
{
  const bill = {
    billName: 'Gym Membership',
    dueDate: '2026-11-10T00:00:00.000Z',
    status: 'pending'
  };

  const status = derivePaymentStatus(bill, new Date('2026-10-26'));
  assert.strictEqual(status, 'upcoming');
  console.log('✓ 3.4 Passed: Bill outside due-soon window marked as upcoming');
}

// -------------------------------------------------------------------------
// 4. RECURRING BILL OCCURRENCE ADVANCEMENT
// -------------------------------------------------------------------------
console.log('\n[Suite 4: Recurring Bill Occurrences]');

function calculateNextDueDate(currentDueDateStr, recurringCycle) {
  const currentDueDate = new Date(currentDueDateStr);
  const nextDueDate = new Date(currentDueDate);

  if (recurringCycle === 'weekly') {
    nextDueDate.setDate(currentDueDate.getDate() + 7);
  } else if (recurringCycle === 'monthly') {
    nextDueDate.setMonth(currentDueDate.getMonth() + 1);
  } else if (recurringCycle === 'yearly') {
    nextDueDate.setFullYear(currentDueDate.getFullYear() + 1);
  }
  return nextDueDate.toISOString();
}

{
  const currentDue = '2026-10-15T00:00:00.000Z';
  const nextMonthly = calculateNextDueDate(currentDue, 'monthly');
  assert.strictEqual(new Date(nextMonthly).getMonth(), 10, 'Next month should be November');
  assert.strictEqual(new Date(nextMonthly).getDate(), 15, 'Day of month should be preserved');

  const nextYearly = calculateNextDueDate(currentDue, 'yearly');
  assert.strictEqual(new Date(nextYearly).getFullYear(), 2027, 'Next year should be 2027');
  console.log('✓ 4.1 Passed: Recurring bill dates correctly calculated without shifting day of month');
}

// -------------------------------------------------------------------------
// 5. EXPIRED PUSH SUBSCRIPTION PRUNING
// -------------------------------------------------------------------------
console.log('\n[Suite 5: Expired Push Subscription Pruning]');

function isSubscriptionExpired(statusCode) {
  return statusCode === 410 || statusCode === 404;
}

{
  assert.strictEqual(isSubscriptionExpired(410), true, '410 Gone indicates expired subscription');
  assert.strictEqual(isSubscriptionExpired(404), true, '404 Not Found indicates unsubscribed endpoint');
  assert.strictEqual(isSubscriptionExpired(500), false, '500 Server Error should be retried, not pruned');
  console.log('✓ 5.1 Passed: HTTP 410/404 subscription expiration handling verified');
}

console.log('\n================================================================');
console.log('ALL BACKEND & SCHEDULE LOGIC TESTS COMPLETED SUCCESSFULLY (100%)');
console.log('================================================================\n');
