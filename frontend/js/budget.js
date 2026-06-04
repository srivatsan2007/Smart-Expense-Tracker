document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  
  // Set defaults
  const currentMonthIdx = new Date().getMonth();
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  document.getElementById('budget-month').value = months[currentMonthIdx];
  document.getElementById('budget-year').value = new Date().getFullYear();

  // Load Profile
  const user = JSON.parse(localStorage.getItem('user'));
  if(user) {
      document.getElementById('profile-name').textContent = user.name;
      document.getElementById('profile-email').textContent = user.email;
  }

  fetchBudget();
  checkBudgetStatus(); // Checks if we exceeded 80% or 100%

  document.getElementById('budget-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const month = document.getElementById('budget-month').value;
      const year = document.getElementById('budget-year').value;
      const monthlyLimit = document.getElementById('monthly-limit').value;

      try {
          const res = await fetch('/api/budget', {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({ month, year, monthlyLimit, categoryLimits: [] })
          });
          if(res.ok) {
              alert('Budget saved successfully!');
              checkBudgetStatus();
          }
      } catch(err) {
          console.error(err);
      }
  });
});

async function fetchBudget() {
  const month = document.getElementById('budget-month').value;
  const year = document.getElementById('budget-year').value;

  try {
      const res = await fetch(`/api/budget?month=${month}&year=${year}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data && data.monthlyLimit) {
          document.getElementById('monthly-limit').value = data.monthlyLimit;
      } else {
          document.getElementById('monthly-limit').value = '';
      }
  } catch (error) {
      console.error('Error fetching budget:', error);
  }
}

document.getElementById('budget-month').addEventListener('change', fetchBudget);
document.getElementById('budget-year').addEventListener('change', fetchBudget);

async function checkBudgetStatus() {
  try {
      // 1. Get current month total expenses
      const expRes = await fetch('/api/expenses', { headers: getAuthHeaders() });
      const allExpenses = await expRes.json();
      
      const currentMonthNum = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      const currentMonthExpenses = allExpenses.filter(e => {
          const d = new Date(e.date);
          return d.getMonth() === currentMonthNum && d.getFullYear() === currentYear;
      });
      
      const totalSpent = currentMonthExpenses.reduce((acc, e) => acc + e.amount, 0);

      // 2. Get budget
      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const currentMonth = months[currentMonthNum];

      const budRes = await fetch(`/api/budget?month=${currentMonth}&year=${currentYear}`, { headers: getAuthHeaders() });
      const budgetData = await budRes.json();

      if (budgetData && budgetData.monthlyLimit) {
          const limit = budgetData.monthlyLimit;
          const percentage = (totalSpent / limit) * 100;

          const warningAlert = document.getElementById('warning-alert');
          const dangerAlert = document.getElementById('danger-alert');

          warningAlert.style.display = 'none';
          dangerAlert.style.display = 'none';

          if (percentage >= 100) {
              dangerAlert.style.display = 'block';
          } else if (percentage >= 80) {
              warningAlert.style.display = 'block';
          }
      }
  } catch (error) {
      console.error('Error checking budget status:', error);
  }
}
