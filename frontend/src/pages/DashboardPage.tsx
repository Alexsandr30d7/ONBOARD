import { Link, useLocation, useNavigate } from "react-router-dom";
import { logout } from "../api/client";
import type { User } from "../types";
import AdminView from "../views/AdminView";
import HrView from "../views/HrView";
import EmployeeView from "../views/EmployeeView";
import KnowledgeBasePage from "./KnowledgeBasePage";

export default function DashboardPage({
  user,
  onUserChange,
  section = "dashboard",
}: {
  user: User;
  onUserChange: (u: User | null) => void;
  section?: "dashboard" | "knowledge";
}) {
  const nav = useNavigate();
  const location = useLocation();

  async function handleLogout() {
    await logout();
    onUserChange(null);
    nav("/login", { replace: true });
  }

  const roleLabel: Record<string, string> = {
    admin: "Администратор",
    hr: "HR",
    new_employee: "Новый сотрудник",
    mentor: "Ментор",
  };

  return (
    <div className="layout">
      <header className="topbar">
        <div>
          <div className="brand">Онбординг — демо</div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.45rem", flexWrap: "wrap" }}>
            <Link to="/" className={`btn btn-ghost btn-small ${location.pathname === "/" ? "menu-active" : ""}`}>
              Дашборд
            </Link>
            <Link
              to="/knowledge-base"
              className={`btn btn-ghost btn-small ${location.pathname === "/knowledge-base" ? "menu-active" : ""}`}
            >
              База знаний
            </Link>
          </div>
          <div className="muted" style={{ fontSize: "0.9rem" }}>
            {user.email}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <span className="pill">{roleLabel[user.role] ?? user.role}</span>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </header>

      {section === "knowledge" ? <KnowledgeBasePage user={user} /> : null}
      {section === "dashboard" && user.role === "admin" ? <AdminView currentUserId={user.user_id} /> : null}
      {section === "dashboard" && user.role === "hr" ? <HrView role="hr" /> : null}
      {section === "dashboard" && user.role === "new_employee" ? <EmployeeView /> : null}
      {section === "dashboard" && user.role === "mentor" ? <HrView role="mentor" /> : null}
    </div>
  );
}
