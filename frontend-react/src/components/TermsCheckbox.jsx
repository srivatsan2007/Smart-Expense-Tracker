import { Link } from 'react-router-dom';

export default function TermsCheckbox({ checked, onChange, id = 'acceptTerms' }) {
  return (
    <label
      htmlFor={id}
      className="terms-check"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        I have read and agree to the{' '}
        <Link to="/terms" target="_blank" rel="noopener noreferrer">
          Terms &amp; Conditions
        </Link>{' '}
        and{' '}
        <Link to="/terms#privacy" target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </Link>
        .
      </span>
    </label>
  );
}
