document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  fetchSalaries();

  // Set current year default
  document.getElementById('year').value = new Date().getFullYear();

  const form = document.getElementById('salary-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const amount = document.getElementById('amount').value;
      const month = document.getElementById('month').value;
      const year = document.getElementById('year').value;

      try {
        const res = await fetch('/api/salaries', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ amount, month, year })
        });
        
        if (res.ok) {
          form.reset();
          document.getElementById('year').value = new Date().getFullYear();
          fetchSalaries();
        } else {
          alert('Failed to add salary');
        }
      } catch (error) {
        console.error(error);
      }
    });
  }
});

async function fetchSalaries() {
  try {
    const res = await fetch('/api/salaries', { headers: getAuthHeaders() });
    const salaries = await res.json();
    renderSalaries(salaries);
  } catch (error) {
    console.error('Error fetching salaries:', error);
  }
}

function renderSalaries(salaries) {
  const tbody = document.querySelector('#salaries-table tbody');
  tbody.innerHTML = '';
  
  if (salaries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No salary history found.</td></tr>';
    return;
  }

  salaries.forEach(sal => {
    const tr = document.createElement('tr');
    const amountNum = Number(sal.amount || 0);
    tr.innerHTML = `
      <td>${sal.month}</td>
      <td>${sal.year}</td>
      <td style="color: var(--success-color); font-weight: 600;">₹${amountNum.toFixed(2)}</td>
      <td>
        <button onclick="deleteSalary('${sal._id}')" class="btn btn-secondary" style="padding: 5px 10px; font-size: 0.8rem; color: var(--danger-color); border-color: var(--danger-color);"><i class="fas fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function deleteSalary(id) {
  if(confirm('Are you sure you want to delete this salary record?')) {
    try {
      const res = await fetch(`/api/salaries/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if(res.ok) {
        fetchSalaries();
      }
    } catch(err) {
      console.error(err);
    }
  }
}
