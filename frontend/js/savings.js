document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  fetchGoals();

  const form = document.getElementById('goal-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const name = document.getElementById('name').value;
      const targetAmount = document.getElementById('targetAmount').value;
      const currentAmount = document.getElementById('currentAmount').value;
      const targetDate = document.getElementById('targetDate').value;

      try {
        const res = await fetch('/api/savings', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ name, targetAmount, currentAmount, targetDate })
        });
        
        if (res.ok) {
          form.reset();
          fetchGoals();
        } else {
          alert('Failed to create goal');
        }
      } catch (error) {
        console.error(error);
      }
    });
  }

  // Update form logic
  document.getElementById('update-goal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('update-goal-id').value;
    const currentAmount = document.getElementById('update-current').value;

    try {
      const res = await fetch(`/api/savings/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ currentAmount })
      });
      if(res.ok) {
        document.getElementById('update-modal').style.display = 'none';
        fetchGoals();
      }
    } catch(err) {
      console.error(err);
    }
  });
});

async function fetchGoals() {
  try {
    const res = await fetch('/api/savings', { headers: getAuthHeaders() });
    const goals = await res.json();
    renderGoals(goals);
  } catch (error) {
    console.error('Error fetching goals:', error);
  }
}

function renderGoals(goals) {
  const container = document.getElementById('goals-container');
  container.innerHTML = '';
  
  if (goals.length === 0) {
    container.innerHTML = '<p style="text-align:center; width:100%;">No savings goals found.</p>';
    return;
  }

  goals.forEach(goal => {
    const percentage = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
    
    const div = document.createElement('div');
    div.className = 'glass-card goal-card';
    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h4 style="margin:0;">${goal.name}</h4>
        <div>
          <button onclick="openUpdateModal('${goal._id}', ${goal.currentAmount})" class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem; margin-right: 5px;"><i class="fas fa-edit"></i></button>
          <button onclick="deleteGoal('${goal._id}')" class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem; color: var(--danger-color); border-color: var(--danger-color);"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <p style="font-size: 0.9rem; margin-bottom: 5px;">₹${goal.currentAmount.toFixed(2)} / ₹${goal.targetAmount.toFixed(2)}</p>
      <div class="progress-bar-container">
          <div class="progress-bar" style="width: ${percentage}%"></div>
      </div>
      <p style="text-align: right; font-size: 0.8rem; font-weight: bold; margin:0;">${percentage.toFixed(1)}%</p>
    `;
    container.appendChild(div);
  });
}

function openUpdateModal(id, current) {
  document.getElementById('update-goal-id').value = id;
  document.getElementById('update-current').value = current;
  document.getElementById('update-modal').style.display = 'flex';
}

async function deleteGoal(id) {
  if(confirm('Are you sure you want to delete this goal?')) {
    try {
      const res = await fetch(`/api/savings/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if(res.ok) {
        fetchGoals();
      }
    } catch(err) {
      console.error(err);
    }
  }
}
