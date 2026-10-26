import React from 'react';

export default function StatCard({
  title,
  label,
  value,
  icon,
  iconColor,
  iconBg,
  badgeText,
  badge,
  badgeType,
  variant,
  subtitle,
  sub,
}) {
  const cardTitle = title || label || '';
  const cardSub = subtitle || sub || '';
  const cardBadge = badgeText || badge || '';
  const resolvedBadgeType = badgeType || variant || 'neutral';

  const defaultColorMap = {
    primary: { color: 'var(--primary-color)', bg: 'var(--primary-light)' },
    success: { color: 'var(--success-color)', bg: 'rgba(16, 185, 129, 0.12)' },
    danger: { color: 'var(--danger-color)', bg: 'rgba(239, 68, 68, 0.12)' },
    warning: { color: '#B45309', bg: 'rgba(245, 158, 11, 0.12)' },
    neutral: { color: 'var(--text-secondary)', bg: 'rgba(100, 116, 139, 0.1)' },
    default: { color: 'var(--primary-color)', bg: 'var(--primary-light)' },
  };

  const scheme = defaultColorMap[resolvedBadgeType] || defaultColorMap.primary;
  const finalIconColor = iconColor || scheme.color;
  const finalIconBg = iconBg || scheme.bg;

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === 'function') {
      const IconComponent = icon;
      return <IconComponent size={24} color={finalIconColor} />;
    }
    return null;
  };

  return (
    <div className="glass-card stat-card">
      <div className="stat-details">
        {cardTitle && <h3>{cardTitle}</h3>}
        <p>{value}</p>
        {cardBadge && (
          <span className={`stat-badge badge-${resolvedBadgeType}`}>
            {cardBadge}
          </span>
        )}
        {cardSub && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
            {cardSub}
          </span>
        )}
      </div>
      {icon && (
        <div className="stat-icon" style={{ backgroundColor: finalIconBg, color: finalIconColor }}>
          {renderIcon()}
        </div>
      )}
    </div>
  );
}
