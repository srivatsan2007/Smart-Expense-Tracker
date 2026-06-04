class FinancialCalculator {
  constructor() {
    this.previousOperand = '';
    this.currentOperand = '0';
    this.operation = undefined;
    this.injectHTML();
    this.bindEvents();
  }

  injectHTML() {
    const html = `
      <!-- FAB -->
      <div class="calc-fab" id="calc-fab" title="Financial Calculator">
        <i class="fas fa-calculator"></i>
      </div>

      <!-- Overlay -->
      <div class="calc-overlay" id="calc-overlay"></div>

      <!-- Bottom Sheet Calculator -->
      <div class="calc-sheet" id="calc-sheet">
        <div class="calc-header">
          <h3>Smart Calculator</h3>
          <button class="calc-close" id="calc-close"><i class="fas fa-times"></i></button>
        </div>

        <div class="calc-display-container">
          <div class="calc-history" id="calc-history"></div>
          <div class="calc-current" id="calc-current">0</div>
        </div>

        <div class="calc-grid">
          <!-- Row 1: Financial Features -->
          <button class="calc-btn financial" data-fin="gst">GST</button>
          <button class="calc-btn financial" data-fin="disc">DISC</button>
          <button class="calc-btn financial" data-fin="emi" style="grid-column: span 2;">EMI Calc</button>

          <!-- Row 2 -->
          <button class="calc-btn action" data-action="clear">C</button>
          <button class="calc-btn action" data-action="delete"><i class="fas fa-backspace"></i></button>
          <button class="calc-btn operator" data-op="%">%</button>
          <button class="calc-btn operator" data-op="/">÷</button>

          <!-- Row 3 -->
          <button class="calc-btn number">7</button>
          <button class="calc-btn number">8</button>
          <button class="calc-btn number">9</button>
          <button class="calc-btn operator" data-op="*">×</button>

          <!-- Row 4 -->
          <button class="calc-btn number">4</button>
          <button class="calc-btn number">5</button>
          <button class="calc-btn number">6</button>
          <button class="calc-btn operator" data-op="-">-</button>

          <!-- Row 5 -->
          <button class="calc-btn number">1</button>
          <button class="calc-btn number">2</button>
          <button class="calc-btn number">3</button>
          <button class="calc-btn operator" data-op="+">+</button>

          <!-- Row 6 -->
          <button class="calc-btn number" style="grid-column: span 2;">0</button>
          <button class="calc-btn number">.</button>
          <button class="calc-btn equals" id="calc-equals">=</button>
        </div>

        <!-- Financial Input Modal -->
        <div class="calc-modal" id="calc-modal">
          <div class="calc-modal-header">
            <h4 id="calc-modal-title">Enter Details</h4>
            <button class="calc-close" id="calc-modal-close"><i class="fas fa-times"></i></button>
          </div>
          <div class="calc-modal-body" id="calc-modal-body">
            <!-- Dynamically injected -->
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
  }

  bindEvents() {
    this.fab = document.getElementById('calc-fab');
    this.overlay = document.getElementById('calc-overlay');
    this.sheet = document.getElementById('calc-sheet');
    this.closeBtn = document.getElementById('calc-close');
    
    this.historyText = document.getElementById('calc-history');
    this.currentText = document.getElementById('calc-current');
    
    this.modal = document.getElementById('calc-modal');
    this.modalCloseBtn = document.getElementById('calc-modal-close');
    this.modalBody = document.getElementById('calc-modal-body');
    this.modalTitle = document.getElementById('calc-modal-title');

    // UI Toggles
    this.fab.addEventListener('click', () => this.toggleSheet(true));
    this.overlay.addEventListener('click', () => this.toggleSheet(false));
    this.closeBtn.addEventListener('click', () => this.toggleSheet(false));
    this.modalCloseBtn.addEventListener('click', () => this.toggleModal(false));

    // Number Buttons
    document.querySelectorAll('.calc-btn.number').forEach(btn => {
      btn.addEventListener('click', () => {
        this.appendNumber(btn.innerText);
        this.updateDisplay();
      });
    });

    // Operator Buttons
    document.querySelectorAll('.calc-btn.operator').forEach(btn => {
      btn.addEventListener('click', () => {
        this.chooseOperation(btn.innerText);
        this.updateDisplay();
      });
    });

    // Equals
    document.getElementById('calc-equals').addEventListener('click', () => {
      this.compute();
      this.updateDisplay();
    });

    // Actions
    document.querySelectorAll('.calc-btn.action').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.action === 'clear') this.clear();
        if (btn.dataset.action === 'delete') this.delete();
        this.updateDisplay();
      });
    });

    // Financial Features
    document.querySelectorAll('.calc-btn.financial').forEach(btn => {
      btn.addEventListener('click', () => {
        this.openFinancialModal(btn.dataset.fin);
      });
    });
  }

  toggleSheet(show) {
    if (show) {
      this.overlay.classList.add('active');
      this.sheet.classList.add('active');
    } else {
      this.overlay.classList.remove('active');
      this.sheet.classList.remove('active');
      this.toggleModal(false);
    }
  }

  toggleModal(show) {
    if (show) {
      this.modal.classList.add('active');
    } else {
      this.modal.classList.remove('active');
    }
  }

  clear() {
    this.currentOperand = '0';
    this.previousOperand = '';
    this.operation = undefined;
  }

  delete() {
    if (this.currentOperand === '0') return;
    this.currentOperand = this.currentOperand.toString().slice(0, -1);
    if (this.currentOperand === '') this.currentOperand = '0';
  }

  appendNumber(number) {
    if (number === '.' && this.currentOperand.includes('.')) return;
    if (this.currentOperand === '0' && number !== '.') {
      this.currentOperand = number;
    } else {
      this.currentOperand = this.currentOperand.toString() + number.toString();
    }
  }

  chooseOperation(operation) {
    if (this.currentOperand === '') return;
    if (this.previousOperand !== '') {
      this.compute();
    }
    
    // Map visual operators to logic operators
    if (operation === '×') this.operation = '*';
    else if (operation === '÷') this.operation = '/';
    else this.operation = operation;
    
    this.previousOperand = this.currentOperand;
    this.currentOperand = '';
  }

  compute() {
    let computation;
    const prev = parseFloat(this.previousOperand);
    const current = parseFloat(this.currentOperand);
    if (isNaN(prev) || isNaN(current)) return;

    switch (this.operation) {
      case '+': computation = prev + current; break;
      case '-': computation = prev - current; break;
      case '*': computation = prev * current; break;
      case '/': computation = prev / current; break;
      case '%': computation = prev * (current / 100); break;
      default: return;
    }

    this.currentOperand = computation.toString();
    this.operation = undefined;
    this.previousOperand = '';
  }

  getDisplayNumber(number) {
    const stringNumber = number.toString();
    const integerDigits = parseFloat(stringNumber.split('.')[0]);
    const decimalDigits = stringNumber.split('.')[1];
    let integerDisplay;
    if (isNaN(integerDigits)) {
      integerDisplay = '';
    } else {
      integerDisplay = integerDigits.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    }
    if (decimalDigits != null) {
      return `${integerDisplay}.${decimalDigits}`;
    } else {
      return integerDisplay;
    }
  }

  updateDisplay() {
    this.currentText.innerText = this.getDisplayNumber(this.currentOperand);
    if (this.operation != null) {
      let displayOp = this.operation;
      if (displayOp === '*') displayOp = '×';
      if (displayOp === '/') displayOp = '÷';
      this.historyText.innerText = `${this.getDisplayNumber(this.previousOperand)} ${displayOp}`;
    } else {
      this.historyText.innerText = '';
    }
  }

  openFinancialModal(type) {
    // Before opening, if there is a calculation pending, compute it
    if (this.operation && this.currentOperand !== '') this.compute();
    
    const baseAmount = parseFloat(this.currentOperand) || 0;

    let html = '';
    if (type === 'gst') {
      this.modalTitle.innerText = 'Calculate GST';
      html = `
        <p style="margin-bottom: 15px; color: var(--text-color);">Base Amount: <strong>₹${baseAmount.toLocaleString('en-IN')}</strong></p>
        <div class="form-group">
          <label>GST Rate (%)</label>
          <select id="fin-rate" class="form-control">
            <option value="5">5%</option>
            <option value="12">12%</option>
            <option value="18" selected>18%</option>
            <option value="28">28%</option>
          </select>
        </div>
        <div style="display:flex; gap: 10px; margin-top: auto;">
          <button class="btn btn-secondary" style="flex:1" id="fin-add-gst">+ Add GST</button>
          <button class="btn btn-primary" style="flex:1" id="fin-sub-gst">- Remove GST</button>
        </div>
      `;
    } else if (type === 'disc') {
      this.modalTitle.innerText = 'Calculate Discount';
      html = `
        <p style="margin-bottom: 15px; color: var(--text-color);">Original Price: <strong>₹${baseAmount.toLocaleString('en-IN')}</strong></p>
        <div class="form-group">
          <label>Discount (%)</label>
          <input type="number" id="fin-rate" class="form-control" value="10" min="0" max="100">
        </div>
        <button class="btn btn-primary" style="width: 100%; margin-top: auto;" id="fin-calc-disc">Apply Discount</button>
      `;
    } else if (type === 'emi') {
      this.modalTitle.innerText = 'Calculate EMI';
      html = `
        <p style="margin-bottom: 15px; color: var(--text-color);">Loan Amount: <strong>₹${baseAmount.toLocaleString('en-IN')}</strong></p>
        <div class="form-group" style="margin-bottom: 10px;">
          <label>Interest Rate (% p.a.)</label>
          <input type="number" id="fin-rate" class="form-control" value="8.5" step="0.1">
        </div>
        <div class="form-group">
          <label>Tenure (Months)</label>
          <input type="number" id="fin-months" class="form-control" value="12">
        </div>
        <button class="btn btn-primary" style="width: 100%; margin-top: auto;" id="fin-calc-emi">Calculate EMI</button>
      `;
    }

    this.modalBody.innerHTML = html;
    this.toggleModal(true);

    // Bind modal actions
    if (type === 'gst') {
      document.getElementById('fin-add-gst').addEventListener('click', () => {
        const rate = parseFloat(document.getElementById('fin-rate').value);
        const gstAmount = baseAmount * (rate / 100);
        this.currentOperand = (baseAmount + gstAmount).toFixed(2);
        this.historyText.innerText = `₹${baseAmount} + ${rate}% GST`;
        this.updateDisplay();
        this.toggleModal(false);
      });
      document.getElementById('fin-sub-gst').addEventListener('click', () => {
        const rate = parseFloat(document.getElementById('fin-rate').value);
        // Original Price = Total / (1 + Rate/100)
        const originalPrice = baseAmount / (1 + (rate / 100));
        this.currentOperand = originalPrice.toFixed(2);
        this.historyText.innerText = `₹${baseAmount} inc. ${rate}% GST`;
        this.updateDisplay();
        this.toggleModal(false);
      });
    } else if (type === 'disc') {
      document.getElementById('fin-calc-disc').addEventListener('click', () => {
        const rate = parseFloat(document.getElementById('fin-rate').value);
        const discAmount = baseAmount * (rate / 100);
        this.currentOperand = (baseAmount - discAmount).toFixed(2);
        this.historyText.innerText = `₹${baseAmount} - ${rate}% Discount`;
        this.updateDisplay();
        this.toggleModal(false);
      });
    } else if (type === 'emi') {
      document.getElementById('fin-calc-emi').addEventListener('click', () => {
        const annualRate = parseFloat(document.getElementById('fin-rate').value);
        const months = parseInt(document.getElementById('fin-months').value);
        
        const monthlyRate = annualRate / 12 / 100;
        let emi = 0;
        
        if (monthlyRate === 0) {
          emi = baseAmount / months;
        } else {
          emi = baseAmount * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);
        }
        
        this.currentOperand = emi.toFixed(2);
        this.historyText.innerText = `EMI for ₹${baseAmount} (${annualRate}%, ${months}m)`;
        this.updateDisplay();
        this.toggleModal(false);
      });
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Only inject if we're inside the app (e.g. check if sidebar exists to skip login/register)
  if (document.getElementById('sidebar')) {
    window.financialCalculator = new FinancialCalculator();
  }
});
