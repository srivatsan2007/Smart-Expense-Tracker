import { useState } from 'react';
import { CalculatorIcon, X } from './Icons.jsx';

export default function Calculator() {
  const [isOpen, setIsOpen] = useState(false);
  const [modalType, setModalType] = useState(null); // null | 'gst' | 'disc' | 'emi'
  const [previousOperand, setPreviousOperand] = useState('');
  const [currentOperand, setCurrentOperand] = useState('0');
  const [operation, setOperation] = useState(null);
  const [historyText, setHistoryText] = useState('');

  // Financial inputs
  const [gstRate, setGstRate] = useState('18');
  const [discRate, setDiscRate] = useState('10');
  const [emiRate, setEmiRate] = useState('8.5');
  const [emiMonths, setEmiMonths] = useState('12');

  const getDisplayNumber = (number) => {
    if (!number && number !== 0) return '0';
    const stringNumber = number.toString();
    const parts = stringNumber.split('.');
    const integerDigits = parseFloat(parts[0]);
    const decimalDigits = parts[1];
    const integerDisplay = isNaN(integerDigits)
      ? ''
      : integerDigits.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    return decimalDigits != null ? `${integerDisplay}.${decimalDigits}` : integerDisplay;
  };

  const appendNumber = (num) => {
    if (num === '.' && currentOperand.includes('.')) return;
    if (currentOperand === '0' && num !== '.') {
      setCurrentOperand(num);
    } else {
      setCurrentOperand((prev) => prev.toString() + num.toString());
    }
  };

  const runCompute = (p, c, op) => {
    const prev = parseFloat(p);
    const curr = parseFloat(c);
    if (isNaN(prev) || isNaN(curr)) return null;
    let res;
    switch (op) {
      case '+': res = prev + curr; break;
      case '-': res = prev - curr; break;
      case '*': res = prev * curr; break;
      case '/': res = curr !== 0 ? prev / curr : 0; break;
      case '%': res = prev * (curr / 100); break;
      default: return null;
    }
    return res;
  };

  const chooseOperation = (opVisual) => {
    if (currentOperand === '') return;
    let curr = currentOperand;
    let prev = previousOperand;
    let op = operation;

    let nextOp = opVisual;
    if (opVisual === '×') nextOp = '*';
    if (opVisual === '÷') nextOp = '/';

    if (prev !== '' && op) {
      const computed = runCompute(prev, curr, op);
      if (computed != null) {
        prev = computed.toString();
        curr = '';
      }
    } else {
      prev = curr;
      curr = '';
    }

    setPreviousOperand(prev);
    setCurrentOperand(curr);
    setOperation(nextOp);
    const displayOp = nextOp === '*' ? '×' : nextOp === '/' ? '÷' : nextOp;
    setHistoryText(`${getDisplayNumber(prev)} ${displayOp}`);
  };

  const compute = () => {
    if (!operation || previousOperand === '' || currentOperand === '') return;
    const res = runCompute(previousOperand, currentOperand, operation);
    if (res != null) {
      setCurrentOperand(res.toString());
      setOperation(null);
      setPreviousOperand('');
      setHistoryText('');
    }
  };

  const clear = () => {
    setCurrentOperand('0');
    setPreviousOperand('');
    setOperation(null);
    setHistoryText('');
  };

  const deleteChar = () => {
    if (currentOperand === '0') return;
    const next = currentOperand.toString().slice(0, -1);
    setCurrentOperand(next === '' ? '0' : next);
  };

  const openFinancial = (type) => {
    if (operation && currentOperand !== '') {
      const res = runCompute(previousOperand, currentOperand, operation);
      if (res != null) {
        setCurrentOperand(res.toString());
        setOperation(null);
        setPreviousOperand('');
        setHistoryText('');
      }
    }
    setModalType(type);
  };

  const baseAmount = parseFloat(currentOperand) || 0;

  const handleAddGst = () => {
    const rate = parseFloat(gstRate) || 0;
    const gstAmount = baseAmount * (rate / 100);
    const total = (baseAmount + gstAmount).toFixed(2);
    setCurrentOperand(total);
    setHistoryText(`₹${baseAmount} + ${rate}% GST`);
    setModalType(null);
  };

  const handleSubGst = () => {
    const rate = parseFloat(gstRate) || 0;
    const originalPrice = (baseAmount / (1 + rate / 100)).toFixed(2);
    setCurrentOperand(originalPrice);
    setHistoryText(`₹${baseAmount} inc. ${rate}% GST`);
    setModalType(null);
  };

  const handleApplyDiscount = () => {
    const rate = parseFloat(discRate) || 0;
    const discAmount = baseAmount * (rate / 100);
    const finalPrice = (baseAmount - discAmount).toFixed(2);
    setCurrentOperand(finalPrice);
    setHistoryText(`₹${baseAmount} - ${rate}% Discount`);
    setModalType(null);
  };

  const handleCalcEmi = () => {
    const annualRate = parseFloat(emiRate) || 0;
    const months = parseInt(emiMonths) || 1;
    const monthlyRate = annualRate / 12 / 100;
    let emi = 0;
    if (monthlyRate === 0) {
      emi = baseAmount / months;
    } else {
      emi = (baseAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
    }
    setCurrentOperand(emi.toFixed(2));
    setHistoryText(`EMI for ₹${baseAmount} (${annualRate}%, ${months}m)`);
    setModalType(null);
  };

  return (
    <>
      {/* Floating Action Button */}
      <div className="calc-fab" title="Financial Calculator" onClick={() => setIsOpen(true)}>
        <CalculatorIcon size={26} color="#ffffff" />
      </div>

      {/* Overlay */}
      <div
        className={`calc-overlay${isOpen ? ' active' : ''}`}
        onClick={() => {
          setIsOpen(false);
          setModalType(null);
        }}
      ></div>

      {/* Bottom Sheet Calculator */}
      <div className={`calc-sheet${isOpen ? ' active' : ''}`}>
        <div className="calc-header">
          <h3>Smart Calculator</h3>
          <button
            className="calc-close"
            onClick={() => {
              setIsOpen(false);
              setModalType(null);
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="calc-display-container">
          <div className="calc-history">{historyText}</div>
          <div className="calc-current">{getDisplayNumber(currentOperand)}</div>
        </div>

        <div className="calc-grid">
          {/* Row 1: Financial Features */}
          <button className="calc-btn financial" onClick={() => openFinancial('gst')}>GST</button>
          <button className="calc-btn financial" onClick={() => openFinancial('disc')}>DISC</button>
          <button className="calc-btn financial" onClick={() => openFinancial('emi')} style={{ gridColumn: 'span 2' }}>EMI Calc</button>

          {/* Row 2 */}
          <button className="calc-btn action" onClick={clear}>C</button>
          <button className="calc-btn action" onClick={deleteChar}>⌫</button>
          <button className="calc-btn operator" onClick={() => chooseOperation('%')}>%</button>
          <button className="calc-btn operator" onClick={() => chooseOperation('÷')}>÷</button>

          {/* Row 3 */}
          <button className="calc-btn number" onClick={() => appendNumber('7')}>7</button>
          <button className="calc-btn number" onClick={() => appendNumber('8')}>8</button>
          <button className="calc-btn number" onClick={() => appendNumber('9')}>9</button>
          <button className="calc-btn operator" onClick={() => chooseOperation('×')}>×</button>

          {/* Row 4 */}
          <button className="calc-btn number" onClick={() => appendNumber('4')}>4</button>
          <button className="calc-btn number" onClick={() => appendNumber('5')}>5</button>
          <button className="calc-btn number" onClick={() => appendNumber('6')}>6</button>
          <button className="calc-btn operator" onClick={() => chooseOperation('-')}>-</button>

          {/* Row 5 */}
          <button className="calc-btn number" onClick={() => appendNumber('1')}>1</button>
          <button className="calc-btn number" onClick={() => appendNumber('2')}>2</button>
          <button className="calc-btn number" onClick={() => appendNumber('3')}>3</button>
          <button className="calc-btn operator" onClick={() => chooseOperation('+')}>+</button>

          {/* Row 6 */}
          <button className="calc-btn number" onClick={() => appendNumber('0')} style={{ gridColumn: 'span 2' }}>0</button>
          <button className="calc-btn number" onClick={() => appendNumber('.')}>.</button>
          <button className="calc-btn equals" onClick={compute}>=</button>
        </div>

        {/* Financial Input Modal */}
        <div className={`calc-modal${modalType ? ' active' : ''}`}>
          <div className="calc-modal-header">
            <h4>
              {modalType === 'gst' ? 'Calculate GST' : modalType === 'disc' ? 'Calculate Discount' : 'Calculate EMI'}
            </h4>
            <button className="calc-close" onClick={() => setModalType(null)}>
              <X size={18} />
            </button>
          </div>
          <div className="calc-modal-body">
            {modalType === 'gst' && (
              <>
                <p style={{ marginBottom: 15, color: 'var(--text-color)' }}>
                  Base Amount: <strong>₹{baseAmount.toLocaleString('en-IN')}</strong>
                </p>
                <div className="form-group">
                  <label>GST Rate (%)</label>
                  <select className="form-control" value={gstRate} onChange={(e) => setGstRate(e.target.value)}>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleAddGst}>+ Add GST</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubGst}>- Remove GST</button>
                </div>
              </>
            )}

            {modalType === 'disc' && (
              <>
                <p style={{ marginBottom: 15, color: 'var(--text-color)' }}>
                  Original Price: <strong>₹{baseAmount.toLocaleString('en-IN')}</strong>
                </p>
                <div className="form-group">
                  <label>Discount (%)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={discRate}
                    min="0"
                    max="100"
                    onChange={(e) => setDiscRate(e.target.value)}
                  />
                </div>
                <button className="btn btn-primary" style={{ width: '100%', marginTop: 'auto' }} onClick={handleApplyDiscount}>
                  Apply Discount
                </button>
              </>
            )}

            {modalType === 'emi' && (
              <>
                <p style={{ marginBottom: 15, color: 'var(--text-color)' }}>
                  Loan Amount: <strong>₹{baseAmount.toLocaleString('en-IN')}</strong>
                </p>
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label>Interest Rate (% p.a.)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={emiRate}
                    step="0.1"
                    onChange={(e) => setEmiRate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Tenure (Months)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={emiMonths}
                    onChange={(e) => setEmiMonths(e.target.value)}
                  />
                </div>
                <button className="btn btn-primary" style={{ width: '100%', marginTop: 'auto' }} onClick={handleCalcEmi}>
                  Calculate EMI
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
