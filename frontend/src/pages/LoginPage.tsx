import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiJson, login } from "../api/client";
import type { User } from "../types";

export default function LoginPage({ onLoggedIn }: { onLoggedIn: (u: User) => void }) {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      const me = await apiJson<User>("/auth/me");
      onLoggedIn(me);
      nav("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="layout">
      <div className="topbar">
        <span className="brand">Онбординг — демо</span>
      </div>
      <div className="card" style={{ maxWidth: 420, margin: "0 auto" }}>
        <h2>Вход</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Запросы идут через прокси Vite на бэкенд; cookie сессии общие для <code>http://localhost:5173</code>.
        </p>
        {error ? <div className="alert">{error}</div> : null}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Вход…" : "Войти"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
