document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  fetchExpenses();

  // Auto-fill from URL parameters (e.g. from QR scanner)
  const params = new URLSearchParams(window.location.search);
  if (params.has('amount')) document.getElementById('amount').value = params.get('amount');
  if (params.has('category')) document.getElementById('category').value = params.get('category');
  if (params.has('description')) document.getElementById('description').value = params.get('description');
  if (params.has('date')) document.getElementById('date').value = params.get('date');

  const form = document.getElementById('expense-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const amount = document.getElementById('amount').value;
      const category = document.getElementById('category').value;
      const date = document.getElementById('date').value;
      const paymentMethod = document.getElementById('paymentMethod').value;
      const description = document.getElementById('description').value;

      try {
        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ amount, category, date, paymentMethod, description })
        });
        
        if (res.ok) {
          form.reset();
          fetchExpenses(); // Refresh list
        } else {
          alert('Failed to add expense');
        }
      } catch (error) {
        console.error(error);
      }
    });
  }
});

async function fetchExpenses() {
  try {
    const res = await fetch('/api/expenses', { headers: getAuthHeaders() });
    const expenses = await res.json();
    renderExpenses(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
  }
}

function renderExpenses(expenses) {
  const tbody = document.querySelector('#expenses-table tbody');
  tbody.innerHTML = '';
  
  if (expenses.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No expenses found.</td></tr>';
    return;
  }

  expenses.forEach(exp => {
    const tr = document.createElement('tr');
    const amountNum = Number(exp.amount || 0);
    tr.innerHTML = `
      <td>${new Date(exp.date).toLocaleDateString()}</td>
      <td>${exp.category}</td>
      <td>${exp.description || '-'}</td>
      <td>${exp.paymentMethod}</td>
      <td style="color: var(--danger-color); font-weight: 600;">₹${amountNum.toFixed(2)}</td>
      <td>
        <button onclick="deleteExpense('${exp._id}')" class="btn btn-secondary" style="padding: 5px 10px; font-size: 0.8rem; color: var(--danger-color); border-color: var(--danger-color);"><i class="fas fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function deleteExpense(id) {
  if(confirm('Are you sure you want to delete this expense?')) {
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if(res.ok) {
        fetchExpenses();
      }
    } catch(err) {
      console.error(err);
    }
  }
}
