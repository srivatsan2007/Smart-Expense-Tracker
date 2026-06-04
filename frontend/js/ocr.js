document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('receipt-image');
  const preview = document.getElementById('ocr-preview');
  const form = document.getElementById('ocr-form');
  const scanBtn = document.getElementById('scan-btn');

  if(fileInput) {
      fileInput.addEventListener('change', function() {
          const file = this.files[0];
          if (file) {
              const reader = new FileReader();
              reader.onload = function(e) {
                  preview.src = e.target.result;
                  preview.style.display = 'block';
              }
              reader.readAsDataURL(file);
          }
      });
  }

  if(form) {
      form.addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const file = fileInput.files[0];
          if(!file) return;

          const formData = new FormData();
          formData.append('receipt', file);

          scanBtn.disabled = true;
          scanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';

          try {
              const res = await fetch('/api/ocr/scan', {
                  method: 'POST',
                  headers: {
                      'Authorization': `Bearer ${localStorage.getItem('token')}`
                  },
                  body: formData
              });

              const data = await res.json();
              
              if(res.ok && data.success) {
                  document.getElementById('ocr-result').style.display = 'block';
                  document.getElementById('ocr-amount').textContent = data.extracted.amount || 'Not found';
                  document.getElementById('ocr-date').textContent = data.extracted.date || 'Not found';
                  
                  // Store for redirection
                  if (data.extracted.amount) {
                      localStorage.setItem('ocr_amount', data.extracted.amount);
                  }
                  if (data.extracted.date) {
                      // Format date if needed, basic implementation
                      localStorage.setItem('ocr_date', data.extracted.date);
                  }
              } else {
                  alert('OCR scanning failed or could not extract data.');
              }
          } catch (error) {
              console.error('OCR Error:', error);
              alert('Error during OCR scanning.');
          } finally {
              scanBtn.disabled = false;
              scanBtn.innerHTML = '<i class="fas fa-camera"></i> Scan Receipt';
          }
      });
  }
  
  // Quick pre-fill logic for expenses.html if navigating from OCR
  if (window.location.pathname.includes('expenses.html')) {
      const ocrAmt = localStorage.getItem('ocr_amount');
      if (ocrAmt) {
          const amtInput = document.getElementById('amount');
          if(amtInput) amtInput.value = ocrAmt;
          localStorage.removeItem('ocr_amount');
      }
      // Date can be complex due to formatting (MM/DD/YYYY vs YYYY-MM-DD for input[type=date])
      // A more robust date parser would be needed for production
  }
});

function fillExpenseForm() {
  window.location.href = 'expenses.html';
}
