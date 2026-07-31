/**
 * Expense IQ™ — RBAC helpers (API-layer style checks, not just UI hide)
 */
(function () {
  function roleOf(session) {
    return session && session.role ? session.role : null;
  }

  function can(session, module, minLevel) {
    if (!session || !session.org_id || !session.role) return false;
    const matrix = (EIQ.config.permissions && EIQ.config.permissions[module]) || {};
    const level = matrix[session.role] || "none";
    if (level === "none") return false;

    const rank = {
      none: 0,
      view: 1,
      own: 2,
      grant: 2,
      export: 2,
      edit: 3,
      full: 4,
    };
    const need = rank[minLevel || "view"] || 1;
    return (rank[level] || 0) >= need;
  }

  function requireMfa(session) {
    if (!session) return false;
    const required = EIQ.config.mfaRequiredRoles || [];
    if (!required.includes(session.role)) return false;
    return !session.mfa_verified;
  }

  function mfaRequiredForRole(role) {
    return (EIQ.config.mfaRequiredRoles || []).includes(role);
  }

  function assertOrgScope(session, orgId) {
    if (!session || session.org_id !== orgId) {
      throw new Error("Forbidden: org_id scope mismatch.");
    }
  }

  EIQ.permissions = {
    can,
    roleOf,
    requireMfa,
    mfaRequiredForRole,
    assertOrgScope,
  };
})();
