export default function StatCard({
  title,
  value,
  icon: IconComponent,
  iconColor = 'var(--primary-color)',
  iconBg = 'var(--primary-light)',
  badgeText,
  badgeType = 'neutral', // primary | success | danger | warning | neutral
  subtitle,
}) {
  return (
    <div className="glass-card stat-card">
      <div className="stat-details">
        <h3>{title}</h3>
        <p>{value}</p>
        {badgeText && (
          <span className={`stat-badge badge-${badgeType}`}>
            {badgeText}
          </span>
        )}
        {subtitle && !badgeText && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
            {subtitle}
          </span>
        )}
      </div>
      {IconComponent && (
        <div className="stat-icon" style={{ backgroundColor: iconBg, color: iconColor }}>
          <IconComponent size={24} color={iconColor} />
        </div>
      )}
    </div>
  );
}
