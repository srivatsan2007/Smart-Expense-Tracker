export default function PageHeader({ title, description, subtitle, actions, action }) {
  const desc = description || subtitle;
  const act = actions || action;
  return (
    <div className="page-header">
      <div className="page-header-info">
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      {act && <div className="page-header-actions">{act}</div>}
    </div>
  );
}
