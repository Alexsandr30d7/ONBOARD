import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { apiJson } from "./api/client";
import type { User } from "./types";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    apiJson<User>("/auth/me")
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return (
      <div className="layout">
        <p className="muted">Загрузка…</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage onLoggedIn={setUser} />} />
      <Route
        path="/"
        element={user ? <DashboardPage user={user} onUserChange={setUser} /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
    </Routes>
  );
}
