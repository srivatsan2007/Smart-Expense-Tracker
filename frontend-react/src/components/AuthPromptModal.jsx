import { useNavigate } from 'react-router-dom';
import Modal from './Modal.jsx';
import { User, LogIn, UserPlus, Sparkles, Shield, CheckCircle2 } from './Icons.jsx';

export default function AuthPromptModal({ isOpen, onClose, actionName = 'add an expense' }) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sign In Required">
      <div style={{ textAlign: 'center', padding: '8px 4px 4px 4px' }}>
        {/* RupeeRise Branded Icon Badge */}
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 20,
            background: 'linear-gradient(135deg, rgba(53, 94, 59, 0.15) 0%, rgba(221, 242, 193, 0.4) 100%)',
            color: 'var(--color-primary, #355E3B)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
            boxShadow: '0 8px 20px rgba(53, 94, 59, 0.15)',
            border: '1px solid rgba(53, 94, 59, 0.2)'
          }}
        >
          <UserPlus size={30} />
        </div>

        <h3
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--color-forest, #1F3328)',
            margin: '0 0 8px 0'
          }}
        >
          Create or Sign In to Your Account
        </h3>

        <p
          style={{
            fontSize: '0.88rem',
            color: 'var(--text-muted, #5f7566)',
            lineHeight: 1.5,
            maxWidth: 380,
            margin: '0 auto 18px auto'
          }}
        >
          To {actionName} and sync your financial records securely, please sign in or register a free RupeeRise account.
        </p>

        {/* Feature Highlights */}
        <div
          style={{
            background: 'var(--bg-main, #F6FAF2)',
            borderRadius: 12,
            border: '1px solid var(--border-color, #d1e2cb)',
            padding: '12px 16px',
            textAlign: 'left',
            marginBottom: 22,
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--color-forest, #1F3328)' }}>
            <CheckCircle2 size={16} color="var(--color-primary, #355E3B)" />
            <span>Save daily & monthly expenses in your private cloud</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--color-forest, #1F3328)' }}>
            <CheckCircle2 size={16} color="var(--color-primary, #355E3B)" />
            <span>Automatic Safe-to-Spend & financial calendar tracking</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--color-forest, #1F3328)' }}>
            <CheckCircle2 size={16} color="var(--color-primary, #355E3B)" />
            <span>Multi-device sync across mobile web and Android APK</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '12px 20px',
              fontSize: '0.92rem',
              fontWeight: 600,
              gap: 8
            }}
            onClick={() => {
              onClose();
              navigate('/login');
            }}
          >
            <LogIn size={18} />
            <span>Sign In to Existing Account</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '11px 20px',
              fontSize: '0.92rem',
              fontWeight: 600,
              gap: 8,
              border: '1px solid var(--color-primary, #355E3B)'
            }}
            onClick={() => {
              onClose();
              navigate('/register');
            }}
          >
            <UserPlus size={18} />
            <span>Create a Free Account</span>
          </button>

          <button
            type="button"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #5f7566)',
              fontSize: '0.82rem',
              cursor: 'pointer',
              marginTop: 4,
              padding: '6px'
            }}
            onClick={onClose}
          >
            Cancel & Continue Browsing
          </button>
        </div>
      </div>
    </Modal>
  );
}
