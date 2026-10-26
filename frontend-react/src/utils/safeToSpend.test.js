import assert from 'assert';
import { calculateSafeToSpend, estimateNextSalaryDate, getPeriodEndDate } from './safeToSpend.js';

console.log('--- RUNNING SAFE-TO-SPEND UNIT TESTS ---');

// Test 1: Correct calculation with standard positive balance
{
  const result = calculateSafeToSpend({
    availableBalance: 25000,
    bills: [
      { billName: 'Rent', amount: 8000, dueDate: '2026-10-30', status: 'pending' },
      { billName: 'Internet', amount: 1000, dueDate: '2026-10-28', status: 'pending' },
      { billName: 'Electricity', amount: 1500, dueDate: '2026-10-15', status: 'paid' }, // Paid! Should NOT be counted
    ],
    expenses: [{ amount: 5000, date: '2026-10-20' }],
    planningPeriod: 'month',
    referenceDate: new Date('2026-10-26'),
  });

  assert.strictEqual(result.unpaidCommitments, 9000, 'Unpaid commitments should be 9000 (Rent + Internet)');
  assert.strictEqual(result.unpaidBillsCount, 2, 'Should count exactly 2 unpaid bills');
  assert.strictEqual(result.safeToSpend, 16000, 'Safe-to-spend should be 25000 - 9000 = 16000');
  assert.strictEqual(result.isDeficit, false, 'Should not be in deficit');
  console.log('✓ Test 1 Passed: Correct calculation and no double-counting of paid bills');
}

// Test 2: Negative Safe-to-Spend warning when commitments exceed balance
{
  const result = calculateSafeToSpend({
    availableBalance: 4000,
    bills: [
      { billName: 'EMI', amount: 12000, dueDate: '2026-10-29', status: 'pending' },
    ],
    planningPeriod: 'month',
    referenceDate: new Date('2026-10-26'),
  });

  assert.strictEqual(result.unpaidCommitments, 12000);
  assert.strictEqual(result.safeToSpend, -8000, 'Safe-to-spend should be negative -8000');
  assert.strictEqual(result.isDeficit, true, 'Should trigger deficit flag');
  assert.strictEqual(result.deficitAmount, 8000);
  assert(result.warning.includes('Warning: Your upcoming commitments'), 'Should include warning message');
  console.log('✓ Test 2 Passed: Negative safe-to-spend properly triggers warning and deficit amount');
}

// Test 3: Zero or Missing Balance handling
{
  const result = calculateSafeToSpend({
    availableBalance: 0,
    bills: [
      { billName: 'Mobile Recharge', amount: 499, dueDate: '2026-10-27', status: 'pending' }
    ],
    planningPeriod: 'month',
    referenceDate: new Date('2026-10-26'),
  });

  assert.strictEqual(result.availableBalance, 0);
  assert.strictEqual(result.safeToSpend, -499);
  assert.strictEqual(result.isDeficit, true);
  console.log('✓ Test 3 Passed: Zero/missing balance correctly handled');
}

// Test 4: Planning horizons (7 days vs 30 days)
{
  const result7d = calculateSafeToSpend({
    availableBalance: 10000,
    bills: [
      { billName: 'Water Bill', amount: 500, dueDate: '2026-10-28', status: 'pending' }, // in 2 days
      { billName: 'Annual Insurance', amount: 6000, dueDate: '2026-11-20', status: 'pending' }, // in 25 days
    ],
    planningPeriod: '7days',
    referenceDate: new Date('2026-10-26'),
  });

  assert.strictEqual(result7d.unpaidCommitments, 500, '7-day horizon should only include bills due within 7 days');
  assert.strictEqual(result7d.safeToSpend, 9500);

  const result30d = calculateSafeToSpend({
    availableBalance: 10000,
    bills: [
      { billName: 'Water Bill', amount: 500, dueDate: '2026-10-28', status: 'pending' },
      { billName: 'Annual Insurance', amount: 6000, dueDate: '2026-11-20', status: 'pending' },
    ],
    planningPeriod: '30days',
    referenceDate: new Date('2026-10-26'),
  });

  assert.strictEqual(result30d.unpaidCommitments, 6500, '30-day horizon should include both bills');
  assert.strictEqual(result30d.safeToSpend, 3500);
  console.log('✓ Test 4 Passed: Planning period filtering accurately selects due commitments');
}

// Test 5: Planned savings and essential expenses buffer
{
  const result = calculateSafeToSpend({
    availableBalance: 20000,
    bills: [{ billName: 'Gas', amount: 1000, dueDate: '2026-10-30', status: 'pending' }],
    savingsGoals: [
      { name: 'Emergency Fund', targetAmount: 50000, currentAmount: 10000 }
    ],
    planningPeriod: 'month',
    referenceDate: new Date('2026-10-26'),
  });

  assert(result.plannedSavingsNotReserved > 0, 'Planned savings should be reserved');
  assert.strictEqual(result.safeToSpend, 20000 - 1000 - result.plannedSavingsNotReserved);
  console.log('✓ Test 5 Passed: Savings goals accounted for without double-counting');
}

console.log('--- ALL SAFE-TO-SPEND TESTS PASSED SUCCESSFULLY! ---');
