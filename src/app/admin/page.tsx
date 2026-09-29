// Shell only (MV-S1-06): role-gated layout + RLS backstop are what this task builds. The actual
// pages (Overview, Reports, Users, Catalogue, Flags, Invites, Scan jobs — F-16) are later tasks
// (MV-S10-04 and others); F-16 exempts /admin from prototype fidelity but still asks for the
// same tokens and plain tables/forms, no dashboards — this placeholder follows that.
export default function AdminOverviewPage() {
  return (
    <div className="panel" style={{ padding: 16 }}>
      <p className="muted">
        Admin console pages (Overview, Reports, Users, Catalogue, Flags, Invites, Scan jobs) land in
        later sprints.
      </p>
    </div>
  );
}
