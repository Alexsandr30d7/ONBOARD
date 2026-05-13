import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson } from "../api/client";
import type {
  EWSDistributionPreview,
  EWSWeightsPayload,
  EmployeeOnboarding,
  OnboardingTrack,
  Role,
  User,
  UserUpdatePayload,
} from "../types";

export default function AdminView({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<User[]>([]);
  const [tracks, setTracks] = useState<OnboardingTrack[]>([]);
  const [onboardings, setOnboardings] = useState<EmployeeOnboarding[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [hrEmail, setHrEmail] = useState("");
  const [hrPassword, setHrPassword] = useState("");
  const [mentorEmail, setMentorEmail] = useState("");
  const [mentorPassword, setMentorPassword] = useState("");
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<Role>("hr");
  const [editActive, setEditActive] = useState(true);
  const [editPassword, setEditPassword] = useState("");
  const [weights, setWeights] = useState<EWSWeightsPayload>({
    overdue_ratio: 0.35,
    pace_drop: 0.25,
    inactivity: 0.2,
    negative_feedback: 0.2,
  });
  const [preview, setPreview] = useState<EWSDistributionPreview | null>(null);
  const [weightsLoading, setWeightsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [u, t, o] = await Promise.all([
        apiJson<User[]>("/admin/users"),
        apiJson<OnboardingTrack[]>("/admin/tracks"),
        apiJson<EmployeeOnboarding[]>("/admin/onboardings"),
      ]);
      const w = await apiJson<EWSWeightsPayload>("/admin/ews/weights");
      setUsers(u);
      setTracks(t);
      setOnboardings(o);
      setWeights(w);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function saveWeights() {
    setOk(null);
    const total = weights.overdue_ratio + weights.pace_drop + weights.inactivity + weights.negative_feedback;
    if (Math.abs(total - 1) > 0.001) {
      setError("Сумма весов должна быть 1.0");
      return;
    }
    setWeightsLoading(true);
    try {
      const updated = await apiJson<EWSWeightsPayload>("/admin/ews/weights", {
        method: "PUT",
        body: JSON.stringify(weights),
      });
      setWeights(updated);
      setOk("Веса EWS обновлены");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения весов");
    } finally {
      setWeightsLoading(false);
    }
  }

  async function recalculatePreview() {
    setOk(null);
    setWeightsLoading(true);
    try {
      const p = await apiJson<EWSDistributionPreview>("/admin/ews/recalculate", {
        method: "POST",
        body: JSON.stringify(weights),
      });
      setPreview(p);
      setOk("Предпросмотр пересчитан");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка пересчета");
    } finally {
      setWeightsLoading(false);
    }
  }

  const weightsTotal = (
    weights.overdue_ratio + weights.pace_drop + weights.inactivity + weights.negative_feedback
  ).toFixed(2);

  async function createHr(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    try {
      await apiJson<User>("/admin/users/hr", {
        method: "POST",
        body: JSON.stringify({ email: hrEmail, password: hrPassword, role: "hr" }),
      });
      setOk("HR создан");
      setHrEmail("");
      setHrPassword("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  async function createMentor(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    try {
      await apiJson<User>("/admin/users/mentor", {
        method: "POST",
        body: JSON.stringify({ email: mentorEmail, password: mentorPassword, role: "mentor" }),
      });
      setOk("Ментор создан");
      setMentorEmail("");
      setMentorPassword("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  async function toggleUser(u: User, active: boolean) {
    setOk(null);
    try {
      await apiJson<User>(`/admin/users/${u.user_id}/${active ? "activate" : "deactivate"}`, {
        method: "PUT",
      });
      setOk(active ? "Пользователь активирован" : "Пользователь деактивирован");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  function openEditUserForm(u: User) {
    setEditingUserId(u.user_id);
    setEditEmail(u.email);
    setEditRole(u.role);
    setEditActive(u.is_active);
    setEditPassword("");
    setError(null);
    setOk(null);
  }

  function cancelEditUserForm() {
    setEditingUserId(null);
    setEditPassword("");
  }

  async function saveUserChanges(userId: number) {
    setOk(null);
    try {
      const payload: UserUpdatePayload = {
        email: editEmail,
        role: editRole,
        is_active: editActive,
      };
      if (editPassword.trim()) payload.password = editPassword;

      await apiJson<User>(`/admin/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setOk("Данные пользователя обновлены");
      setEditingUserId(null);
      setEditPassword("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  const editingUser = useMemo(
    () => users.find((u) => u.user_id === editingUserId) ?? null,
    [users, editingUserId]
  );

  useEffect(() => {
    if (!editingUser) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancelEditUserForm();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [editingUser]);

  return (
    <div className="grid">
      {error ? (
        <div className="alert">
          {error}
          <button type="button" className="btn btn-ghost btn-small" style={{ marginLeft: "0.5rem" }} onClick={() => setError(null)}>
            Скрыть
          </button>
        </div>
      ) : null}
      {ok ? (
        <div className="alert ok">
          {ok}
          <button type="button" className="btn btn-ghost btn-small" style={{ marginLeft: "0.5rem" }} onClick={() => setOk(null)}>
            Ок
          </button>
        </div>
      ) : null}

      <div className="grid grid-2">
        <div className="card">
          <h2>EWS Settings</h2>
          <div className="form-row">
            <label>Просрочка ({Math.round(weights.overdue_ratio * 100)}%)</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={weights.overdue_ratio}
              onChange={(e) => setWeights((prev) => ({ ...prev, overdue_ratio: Number(e.target.value) }))}
            />
          </div>
          <div className="form-row">
            <label>Отставание темпа ({Math.round(weights.pace_drop * 100)}%)</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={weights.pace_drop}
              onChange={(e) => setWeights((prev) => ({ ...prev, pace_drop: Number(e.target.value) }))}
            />
          </div>
          <div className="form-row">
            <label>Неактивность ({Math.round(weights.inactivity * 100)}%)</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={weights.inactivity}
              onChange={(e) => setWeights((prev) => ({ ...prev, inactivity: Number(e.target.value) }))}
            />
          </div>
          <div className="form-row">
            <label>Негативный feedback ({Math.round(weights.negative_feedback * 100)}%)</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={weights.negative_feedback}
              onChange={(e) => setWeights((prev) => ({ ...prev, negative_feedback: Number(e.target.value) }))}
            />
          </div>
          <p className="muted">Сумма весов: {weightsTotal}</p>
          <div className="form-actions">
            <button type="button" className="btn btn-primary btn-small" disabled={weightsLoading} onClick={() => void saveWeights()}>
              Сохранить веса
            </button>
            <button type="button" className="btn btn-ghost btn-small" disabled={weightsLoading} onClick={() => void recalculatePreview()}>
              Пересчитать риски
            </button>
          </div>
        </div>
        <div className="card">
          <h2>Предпросмотр распределения</h2>
          {preview ? (
            <ul className="stack" style={{ margin: 0, paddingLeft: "1rem" }}>
              <li>Low: {preview.low}</li>
              <li>Medium: {preview.medium}</li>
              <li>High: {preview.high}</li>
              <li>Average score: {preview.average_score}</li>
            </ul>
          ) : (
            <p className="muted">Нажми "Пересчитать риски", чтобы увидеть прогноз.</p>
          )}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Создать HR</h2>
          <form onSubmit={createHr}>
            <div className="form-row">
              <label>Email</label>
              <input value={hrEmail} onChange={(e) => setHrEmail(e.target.value)} type="email" required />
            </div>
            <div className="form-row">
              <label>Пароль</label>
              <input value={hrPassword} onChange={(e) => setHrPassword(e.target.value)} type="password" required />
            </div>
            <button type="submit" className="btn btn-primary">
              Создать
            </button>
          </form>
        </div>
        <div className="card">
          <h2>Создать ментора</h2>
          <form onSubmit={createMentor}>
            <div className="form-row">
              <label>Email</label>
              <input value={mentorEmail} onChange={(e) => setMentorEmail(e.target.value)} type="email" required />
            </div>
            <div className="form-row">
              <label>Пароль</label>
              <input value={mentorPassword} onChange={(e) => setMentorPassword(e.target.value)} type="password" required />
            </div>
            <button type="submit" className="btn btn-primary">
              Создать
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <h2>Пользователи</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Активен</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id}>
                  <td>{u.user_id}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.is_active ? "да" : "нет"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button type="button" className="btn btn-ghost btn-small" onClick={() => openEditUserForm(u)}>
                      Редактировать
                    </button>
                    {" "}
                    {u.role !== "admin" && u.user_id !== currentUserId ? (
                      u.is_active ? (
                        <button type="button" className="btn btn-danger btn-small" onClick={() => void toggleUser(u, false)}>
                          Деактивировать
                        </button>
                      ) : (
                        <button type="button" className="btn btn-primary btn-small" onClick={() => void toggleUser(u, true)}>
                          Активировать
                        </button>
                      )
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingUser ? (
        <div className="modal-backdrop" role="presentation" onClick={cancelEditUserForm}>
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: "0.8rem" }}>Редактирование пользователя #{editingUser.user_id}</h3>
            <div className="grid grid-2">
              <div className="form-row">
                <label>Email</label>
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </div>
              <div className="form-row">
                <label>Роль</label>
                <select value={editRole} onChange={(e) => setEditRole(e.target.value as Role)}>
                  <option value="admin">admin</option>
                  <option value="hr">hr</option>
                  <option value="mentor">mentor</option>
                  <option value="new_employee">new_employee</option>
                </select>
              </div>
              <div className="form-row">
                <label>Новый пароль (необязательно)</label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Оставьте пустым, чтобы не менять"
                />
              </div>
              <div className="form-row">
                <label style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginTop: "1.8rem" }}>
                  <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                  <span>Активен</span>
                </label>
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-primary btn-small" onClick={() => void saveUserChanges(editingUser.user_id)}>
                Сохранить
              </button>
              <button type="button" className="btn btn-ghost btn-small" onClick={cancelEditUserForm}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-2">
        <div className="card">
          <h2>Треки</h2>
          <ul className="stack muted" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {tracks.map((t) => (
              <li key={t.track_id}>
                <strong style={{ color: "var(--text)" }}>#{t.track_id}</strong> {t.name} — {t.target_position} ({t.duration_days} дн.)
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2>Адаптации</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Статус</th>
                  <th>Старт</th>
                  <th>До</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {onboardings.map((o) => (
                  <tr key={o.onboarding_id}>
                    <td>{o.onboarding_id}</td>
                    <td>{o.status}</td>
                    <td>{o.start_date}</td>
                    <td>{o.expected_end_date}</td>
                    <td>{o.progress_percentage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
