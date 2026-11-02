import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { Download, Sparkles, ExternalLink, CheckCircle2 } from './Icons.jsx';
import {
  checkGitHubReleaseUpdate,
  dismissUpdate,
  CURRENT_APP_VERSION
} from '../utils/updateChecker.js';

export default function UpdatePromptModal() {
  const [updateData, setUpdateData] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check GitHub release on launch
    checkGitHubReleaseUpdate().then((res) => {
      if (res && res.hasUpdate) {
        setUpdateData(res);
        setIsOpen(true);
      }
    });

    // Listen for manual update check events (e.g. from Settings or Test)
    const handleManualCheck = (event) => {
      const data = event.detail;
      if (data) {
        setUpdateData(data);
        setIsOpen(true);
      }
    };

    window.addEventListener('rupeerise_show_update_prompt', handleManualCheck);
    return () => window.removeEventListener('rupeerise_show_update_prompt', handleManualCheck);
  }, []);

  if (!isOpen || !updateData) return null;

  const handleDownload = () => {
    if (updateData.downloadUrl) {
      window.open(updateData.downloadUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDismiss = () => {
    if (updateData.latestVersion) {
      dismissUpdate(updateData.latestVersion);
    }
    setIsOpen(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="New Version Available"
    >
      <div style={{ padding: '6px 2px 2px 2px' }}>
        {/* Header Icon Badge */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 20,
              background: 'linear-gradient(135deg, rgba(53, 94, 59, 0.15) 0%, rgba(221, 242, 193, 0.45) 100%)',
              color: 'var(--color-primary, #355E3B)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px auto',
              boxShadow: '0 8px 24px rgba(53, 94, 59, 0.18)',
              border: '1px solid rgba(53, 94, 59, 0.2)'
            }}
          >
            <Sparkles size={28} />
          </div>

          <h3
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--color-forest, #1F3328)',
              margin: '0 0 6px 0'
            }}
          >
            A New RupeeRise Update is Ready!
          </h3>

          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted, #5f7566)', margin: 0 }}>
            {updateData.releaseName || `Version ${updateData.releaseTag} has been released on GitHub.`}
          </p>
        </div>

        {/* Version Badges Comparison */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            marginBottom: 18,
            padding: '10px 14px',
            borderRadius: 12,
            background: 'var(--bg-main, #F6FAF2)',
            border: '1px solid var(--border-color, #d1e2cb)'
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #5f7566)', textTransform: 'uppercase' }}>Current</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted, #5f7566)' }}>
              v{updateData.currentVersion || CURRENT_APP_VERSION}
            </div>
          </div>

          <span style={{ color: 'var(--color-primary, #355E3B)', fontWeight: 800, fontSize: '1.1rem' }}>➔</span>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-primary, #355E3B)', textTransform: 'uppercase', fontWeight: 600 }}>Latest</div>
            <div
              style={{
                fontSize: '0.95rem',
                fontWeight: 800,
                color: 'var(--color-primary, #355E3B)',
                background: 'rgba(53, 94, 59, 0.12)',
                padding: '2px 8px',
                borderRadius: 6
              }}
            >
              v{updateData.latestVersion}
            </div>
          </div>
        </div>

        {/* Release Notes */}
        <div
          style={{
            marginBottom: 20,
            padding: '12px 14px',
            borderRadius: 10,
            background: 'rgba(255, 255, 255, 0.8)',
            border: '1px solid var(--border-color, #d1e2cb)',
            maxHeight: 140,
            overflowY: 'auto',
            fontSize: '0.8rem',
            color: 'var(--text-color, #1F3328)',
            lineHeight: 1.5
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--color-forest, #1F3328)', marginBottom: 4 }}>
            What&apos;s New in this Version:
          </div>
          <div style={{ whiteSpace: 'pre-line', color: 'var(--text-muted, #5f7566)' }}>
            {updateData.releaseNotes || 'Includes new features, financial tracker upgrades, performance improvements, and bug fixes.'}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleDownload}
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '12px 20px',
              fontSize: '0.92rem',
              fontWeight: 600,
              gap: 8,
              boxShadow: '0 4px 14px rgba(53, 94, 59, 0.25)'
            }}
          >
            <Download size={18} />
            <span>
              {updateData.hasApk ? 'Download Latest APK Update' : 'Download from GitHub Releases'}
            </span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleDismiss}
            style={{
              width: '100%',
              justifyContent: 'center',
              fontSize: '0.85rem'
            }}
          >
            Remind Me Later
          </button>
        </div>
      </div>
    </Modal>
  );
}
