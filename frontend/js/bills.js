document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  fetchBills();

  const billForm = document.getElementById('bill-form');
  if (billForm) {
    billForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const billData = {
        billName: document.getElementById('billName').value,
        amount: document.getElementById('amount').value,
        dueDate: document.getElementById('dueDate').value,
        category: document.getElementById('category').value,
        recurring: document.getElementById('recurring').value
      };

      try {
        const res = await fetch('/api/bills', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(billData)
        });

        const data = await res.json();
        
        if (res.ok) {
          alert('Bill added successfully!');
          billForm.reset();
          fetchBills();
        } else {
          alert(data.message || 'Error adding bill');
        }
      } catch (error) {
        console.error('Error:', error);
        alert('An error occurred');
      }
    });
  }
});

async function fetchBills() {
  try {
    const res = await fetch('/api/bills', {
      headers: getAuthHeaders()
    });
    
    if (res.ok) {
      const bills = await res.json();
      
      // Sort bills: pending first, ordered by due date, then paid
      bills.sort((a, b) => {
        if (a.status === 'pending' && b.status === 'paid') return -1;
        if (a.status === 'paid' && b.status === 'pending') return 1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
      
      renderBills(bills);
    }
  } catch (error) {
    console.error('Error fetching bills:', error);
  }
}

function renderBills(bills) {
  const tbody = document.querySelector('#bills-table tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  if (bills.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No bills found. Add one above!</td></tr>';
    return;
  }

  const today = new Date();
  today.setHours(0,0,0,0);

  bills.forEach(bill => {
    const tr = document.createElement('tr');
    
    // Status Badge Logic
    let statusBadge = '';
    const dueDate = new Date(bill.dueDate);
    dueDate.setHours(0,0,0,0);
    
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (bill.status === 'paid') {
      statusBadge = '<span style="background: rgba(40,167,69,0.2); color: var(--success-color); padding: 4px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;">Paid</span>';
    } else if (diffDays < 0) {
      statusBadge = '<span style="background: rgba(220,53,69,0.2); color: var(--danger-color); padding: 4px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;">Overdue</span>';
    } else if (diffDays <= 3) {
      statusBadge = '<span style="background: rgba(255,193,7,0.2); color: #d39e00; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;">Due Soon</span>';
    } else {
      statusBadge = '<span style="background: rgba(0,123,255,0.2); color: var(--primary-color); padding: 4px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;">Pending</span>';
    }

    // Action button
    let actionBtn = '';
    if (bill.status !== 'paid') {
      actionBtn = `<button class="btn btn-success" style="padding: 5px 10px; font-size: 0.8rem; background: var(--success-color); color: white; border: none; border-radius: 5px; cursor: pointer; margin-right: 5px;" onclick="markAsPaid('${bill._id}')"><i class="fas fa-check"></i> Mark Paid</button>`;
    }
    
    actionBtn += `<button style="padding: 5px 10px; font-size: 0.8rem; background: var(--danger-color); color: white; border: none; border-radius: 5px; cursor: pointer;" onclick="deleteBill('${bill._id}')"><i class="fas fa-trash"></i></button>`;

    tr.innerHTML = `
      <td>${statusBadge}</td>
      <td><strong>${bill.billName}</strong></td>
      <td>${new Date(bill.dueDate).toLocaleDateString()}</td>
      <td>${bill.category}</td>
      <td style="text-transform: capitalize;">${bill.recurring}</td>
      <td>₹${Number(bill.amount).toFixed(2)}</td>
      <td>${actionBtn}</td>
    `;
    
    // Dim the row if paid
    if (bill.status === 'paid') {
      tr.style.opacity = '0.6';
    }
    
    tbody.appendChild(tr);
  });
}

async function markAsPaid(billId) {
  if (!confirm('Mark this bill as paid? If it is a recurring bill, the next occurrence will be automatically generated.')) return;
  
  try {
    const res = await fetch(`/api/bills/${billId}/pay`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });
    
    if (res.ok) {
      fetchBills();
    } else {
      const data = await res.json();
      alert(data.message || 'Failed to mark as paid');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

async function deleteBill(billId) {
  if (!confirm('Are you sure you want to delete this bill?')) return;
  
  try {
    const res = await fetch(`/api/bills/${billId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    
    if (res.ok) {
      fetchBills();
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
