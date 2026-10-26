export default function EmptyState({
  icon: IconComponent,
  title = 'No records found',
  description = 'There are no items to display right now.',
  action,
}) {
  return (
    <div className="empty-state">
      {IconComponent && (
        <div className="empty-state-icon">
          <IconComponent size={26} />
        </div>
      )}
      <h4>{title}</h4>
      <p>{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
