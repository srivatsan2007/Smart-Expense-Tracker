import React from 'react';

export default function EmptyState({
  icon,
  title = 'No records found',
  description = 'There are no items to display right now.',
  action,
  actionLabel,
  onAction,
}) {
  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === 'function') {
      const IconComponent = icon;
      return <IconComponent size={26} />;
    }
    return null;
  };

  return (
    <div className="empty-state">
      {icon && (
        <div className="empty-state-icon">
          {renderIcon()}
        </div>
      )}
      <h4>{title}</h4>
      <p>{description}</p>
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
      {!action && actionLabel && onAction && (
        <div style={{ marginTop: 14 }}>
          <button type="button" className="btn btn-primary" onClick={onAction}>
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
