/**
 * AdminSubPage — simple placeholder for admin sub-sections that aren't fully
 * implemented yet (Project Types, Controlled Vocabulary, Settings).
 * Redirects to the main AdminPanel for the "Usage & errors" screen.
 */
export default function AdminSubPage({ title, description }) {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Administration · {title}</h1>
      </div>
      <div className="card">
        <div className="empty">
          <div className="empty-title">{title}</div>
          <p className="small" style={{ marginTop: 8, maxWidth: 420, textAlign: "center", lineHeight: 1.6 }}>
            {description || `This section is not yet implemented in this build. Use the main Administration panel for access-code management and AI usage reporting.`}
          </p>
        </div>
      </div>
    </div>
  );
}
