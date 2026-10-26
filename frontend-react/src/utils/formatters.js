// Indian Rupee (INR) and date formatting utilities

export function formatINR(val, options = {}) {
  const num = Number(val);
  if (isNaN(num)) return '₹0.00';

  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const parts = absNum.toFixed(2).split('.');
  let intPart = parts[0];
  const decPart = parts[1];

  // Indian numbering system: last 3 digits, then groups of 2
  let lastThree = intPart.substring(intPart.length - 3);
  const otherNumbers = intPart.substring(0, intPart.length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInt = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  const result = `₹${formattedInt}.${decPart}`;
  return isNegative ? `-${result}` : result;
}

export function formatDate(dateString) {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(dateString);
  }
}

export const CATEGORY_COLORS = {
  Medical: '#EC4899',
  Petrol: '#F97316',
  Grocery: '#10B981',
  Milk: '#06B6D4',
  Education: '#8B5CF6',
  'Home Tax': '#64748B',
  Electricity: '#EAB308',
  'Water Bill': '#3B82F6',
  Internet: '#6366F1',
  Rent: '#EF4444',
  EMI: '#D946EF',
  Shopping: '#F43F5E',
  Entertainment: '#A855F7',
  Travel: '#14B8A6',
  Others: '#64748B',
  Food: '#10B981',
  Transportation: '#F97316',
  Housing: '#EF4444',
  Bills: '#6366F1',
  Other: '#64748B',
};
