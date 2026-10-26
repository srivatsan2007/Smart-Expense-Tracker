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
  Grocery: '#355E3B',
  Food: '#3D8B50',
  Petrol: '#D97706',
  Transportation: '#B45309',
  Medical: '#C24141',
  Rent: '#80A66A',
  Housing: '#80A66A',
  'Home Tax': '#647067',
  Milk: '#B9D89A',
  Electricity: '#B7791F',
  'Water Bill': '#294B30',
  Internet: '#5A8F64',
  EMI: '#7C3AED',
  Shopping: '#E11D48',
  Entertainment: '#9333EA',
  Travel: '#0D9488',
  Education: '#059669',
  Bills: '#4D7C0F',
  Others: '#A9B4AA',
  Other: '#A9B4AA',
};
