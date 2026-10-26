import { useEffect, useState } from 'react';

export default function SplashScreen({ forceShow = false, onFinish }) {
  const [visible, setVisible] = useState(() => {
    if (forceShow) return true;
    // Show splash screen on first visit of session
    return !sessionStorage.getItem('rupeerise_splash_shown');
  });
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!visible) return;

    // Timer to start fade out
    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, 1400);

    // Timer to completely unmount
    const finishTimer = setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem('rupeerise_splash_shown', 'true');
      if (onFinish) onFinish();
    }, 1800);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [visible, onFinish]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'linear-gradient(135deg, #0d1e17 0%, #061510 50%, #082117 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      {/* Background ambient glow */}
      <div
        style={{
          position: 'absolute',
          width: 380,
          height: 380,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(61, 139, 80, 0.18) 0%, rgba(53, 94, 59, 0.08) 50%, transparent 70%)',
          filter: 'blur(40px)',
          animation: 'pulseGlow 2.5s infinite alternate ease-in-out',
          pointerEvents: 'none',
        }}
      />

      {/* Centered Logo & Branding */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
          animation: 'splashFadeIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        {/* Logo Image */}
        <div
          style={{
            width: 110,
            height: 110,
            borderRadius: 28,
            overflow: 'hidden',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45), 0 0 30px rgba(16, 185, 129, 0.3)',
            background: '#ffffff',
            padding: 8,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src="/images/rupeerise-logo.png"
            alt="RupeeRise Logo"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>

        {/* Brand Name */}
        <h1
          style={{
            fontSize: 'clamp(2rem, 5vw, 2.6rem)',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: '#FFFFFF',
            margin: '0 0 6px 0',
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
          }}
        >
          Rupee<span style={{ color: '#10B981' }}>Rise</span>
        </h1>

        {/* Tagline */}
        <p
          style={{
            fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
            color: '#94a3b8',
            letterSpacing: '0.04em',
            margin: '0 0 28px 0',
            fontWeight: 500,
          }}
        >
          Track Smarter. Save Better. Rise Higher.
        </p>

        {/* Minimal Animated Progress Bar */}
        <div
          style={{
            width: 180,
            height: 4,
            borderRadius: 999,
            background: 'rgba(255, 255, 255, 0.1)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              height: '100%',
              borderRadius: 999,
              background: 'linear-gradient(90deg, #355E3B, #DDF2C1)',
              animation: 'splashBar 1.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes splashFadeIn {
          from {
            opacity: 0;
            transform: scale(0.92) translateY(12px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes splashBar {
          0% {
            width: 0%;
          }
          60% {
            width: 75%;
          }
          100% {
            width: 100%;
          }
        }
        @keyframes pulseGlow {
          from {
            transform: scale(0.95);
            opacity: 0.6;
          }
          to {
            transform: scale(1.15);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
