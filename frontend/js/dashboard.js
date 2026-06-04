document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  
  const user = JSON.parse(localStorage.getItem('user'));
  if (user) {
    document.getElementById('welcome-msg').textContent = `Welcome, ${user.name}!`;
  }

  fetchDashboardData();
});

async function fetchDashboardData() {
  try {
    const headers = getAuthHeaders();
    
    // Fetch expenses
    const expRes = await fetch('/api/expenses', { headers });
    const expenses = await expRes.json();
    
    // Fetch salaries
    const salRes = await fetch('/api/salaries', { headers });
    const salaries = await salRes.json();

    // Fetch bills
    fetchBillsForWidget();
    
    updateStats(expenses, salaries);
    renderCharts(expenses);
    renderRecentExpenses(expenses);
    
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
  }
}

function updateStats(expenses, salaries) {
  const totalSal = salaries.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const totalExp = expenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const remBal = totalSal - totalExp;

  document.getElementById('total-salary').textContent = `₹${totalSal.toFixed(2)}`;
  document.getElementById('total-expenses').textContent = `₹${totalExp.toFixed(2)}`;
  document.getElementById('remaining-balance').textContent = `₹${remBal.toFixed(2)}`;
}

function renderRecentExpenses(expenses) {
  const tbody = document.querySelector('#recent-expenses-table tbody');
  tbody.innerHTML = '';
  
  const recent = expenses.slice(0, 5); // get top 5
  
  recent.forEach(exp => {
    const tr = document.createElement('tr');
    const amountNum = Number(exp.amount || 0);
    tr.innerHTML = `
      <td>${new Date(exp.date).toLocaleDateString()}</td>
      <td>${exp.category}</td>
      <td>${exp.description || '-'}</td>
      <td style="color: var(--danger-color); font-weight: 600;">₹${amountNum.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderCharts(expenses) {
  // Group by category for Pie Chart
  const categoryData = {};
  expenses.forEach(e => {
    categoryData[e.category] = (categoryData[e.category] || 0) + Number(e.amount || 0);
  });

  const pieCtx = document.getElementById('pieChart').getContext('2d');
  new Chart(pieCtx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(categoryData),
      datasets: [{
        data: Object.values(categoryData),
        backgroundColor: [
          '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E7E9ED', '#8AC926', '#1982C4', '#6A4C93'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' }
      }
    }
  });

  // Group by month for Bar Chart
  const monthlyData = {};
  expenses.forEach(e => {
    const month = new Date(e.date).toLocaleString('default', { month: 'short' });
    monthlyData[month] = (monthlyData[month] || 0) + Number(e.amount || 0);
  });

  const barCtx = document.getElementById('barChart').getContext('2d');
  new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: Object.keys(monthlyData),
      datasets: [{
        label: 'Expenses',
        data: Object.values(monthlyData),
        backgroundColor: 'rgba(74, 144, 226, 0.6)',
        borderColor: 'rgba(74, 144, 226, 1)',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

// --- Bill Reminders Widget Logic ---
async function fetchBillsForWidget() {
  try {
    const res = await fetch('/api/bills', { headers: getAuthHeaders() });
    if (!res.ok) return;
    
    const bills = await res.json();
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // Sort and filter bills
    const upcoming = [];
    const paid = [];
    const alerts = [];
    
    bills.forEach(bill => {
      if (bill.status === 'paid') {
        paid.push(bill);
        return;
      }
      
      const dueDate = new Date(bill.dueDate);
      dueDate.setHours(0,0,0,0);
      const diffTime = dueDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      upcoming.push({...bill, diffDays});
      
      if (diffDays < 0) {
        alerts.push({ type: 'overdue', msg: `🚨 <strong>Overdue:</strong> ${bill.billName} (₹${Number(bill.amount).toFixed(2)}) was due on ${dueDate.toLocaleDateString()}!` });
      } else if (diffDays === 0) {
        alerts.push({ type: 'today', msg: `⚠️ <strong>Due Today:</strong> ${bill.billName} (₹${Number(bill.amount).toFixed(2)}) is due today!` });
      } else if (diffDays === 1) {
        alerts.push({ type: 'soon', msg: `🔔 <strong>Due Tomorrow:</strong> ${bill.billName} (₹${Number(bill.amount).toFixed(2)}) is due tomorrow.` });
      } else if (diffDays === 3) {
        alerts.push({ type: 'info', msg: `ℹ️ <strong>Reminder:</strong> ${bill.billName} (₹${Number(bill.amount).toFixed(2)}) is due in 3 days.` });
      } else if (diffDays === 7) {
        alerts.push({ type: 'info', msg: `ℹ️ <strong>Reminder:</strong> ${bill.billName} (₹${Number(bill.amount).toFixed(2)}) is due in 7 days.` });
      }
    });
    
    // Render Alerts
    const alertsContainer = document.getElementById('bill-alerts-container');
    if (alertsContainer && alerts.length > 0) {
      alertsContainer.innerHTML = alerts.map(a => {
        let bg = 'rgba(0,123,255,0.1)';
        let color = 'var(--primary-color)';
        let border = '1px solid rgba(0,123,255,0.2)';
        
        if (a.type === 'overdue') {
          bg = 'rgba(220,53,69,0.1)'; color = 'var(--danger-color)'; border = '1px solid rgba(220,53,69,0.3)';
        } else if (a.type === 'today' || a.type === 'soon') {
          bg = 'rgba(255,193,7,0.1)'; color = '#b58500'; border = '1px solid rgba(255,193,7,0.3)';
        }
        
        return `<div style="background: ${bg}; color: ${color}; border: ${border}; padding: 12px 15px; border-radius: 8px; margin-bottom: 10px;">${a.msg}</div>`;
      }).join('');
    } else if (alertsContainer) {
      alertsContainer.innerHTML = '';
    }
    
    // Render Upcoming Bills Widget (next 30 days)
    upcoming.sort((a, b) => a.diffDays - b.diffDays);
    const upcomingContainer = document.getElementById('upcoming-bills-widget');
    if (upcomingContainer) {
      if (upcoming.length === 0) {
        upcomingContainer.innerHTML = '<p style="text-align:center; color:#777; padding:20px 0;">No pending bills!</p>';
      } else {
        const top5 = upcoming.slice(0, 5);
        upcomingContainer.innerHTML = top5.map(b => {
          let dayText = b.diffDays < 0 ? 'Overdue' : (b.diffDays === 0 ? 'Today' : `in ${b.diffDays} day(s)`);
          let color = b.diffDays <= 3 ? 'var(--danger-color)' : 'var(--text-color)';
          return `
            <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid rgba(0,0,0,0.05);">
              <div>
                <strong>${b.billName}</strong> <br>
                <span style="font-size:0.8rem; color:${color};">${dayText}</span>
              </div>
              <div style="font-weight:600; text-align:right;">
                ₹${Number(b.amount).toFixed(2)}
              </div>
            </div>
          `;
        }).join('');
      }
    }
    
    // Render Paid Bills History Widget
    paid.sort((a, b) => new Date(b.paidDate || 0) - new Date(a.paidDate || 0));
    const paidContainer = document.getElementById('paid-bills-widget');
    if (paidContainer) {
      if (paid.length === 0) {
        paidContainer.innerHTML = '<p style="text-align:center; color:#777; padding:20px 0;">No paid bills yet.</p>';
      } else {
        const top5 = paid.slice(0, 5);
        paidContainer.innerHTML = top5.map(b => {
          return `
            <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid rgba(0,0,0,0.05);">
              <div>
                <strong style="text-decoration:line-through; color:#999;">${b.billName}</strong> <br>
                <span style="font-size:0.8rem; color:var(--success-color);">Paid on ${new Date(b.paidDate || b.dueDate).toLocaleDateString()}</span>
              </div>
              <div style="font-weight:600; text-align:right; color:#999;">
                ₹${Number(b.amount).toFixed(2)}
              </div>
            </div>
          `;
        }).join('');
      }
    }
    
  } catch (error) {
    console.error('Widget error:', error);
  }
}
