import { useCallback, useEffect, useState } from "react";
import { apiJson } from "../api/client";
import type { EmployeeOnboarding, OnboardingTrack, Task, User } from "../types";

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

  const [trackName, setTrackName] = useState("");
  const [trackDesc, setTrackDesc] = useState("");
  const [trackPosition, setTrackPosition] = useState("");
  const [trackDays, setTrackDays] = useState(30);

  const [taskTrackId, setTaskTrackId] = useState<number | "">("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskType, setTaskType] = useState("document");
  const [taskOrder, setTaskOrder] = useState(1);
  const [taskDur, setTaskDur] = useState(3);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [u, t, o] = await Promise.all([
        apiJson<User[]>("/admin/users"),
        apiJson<OnboardingTrack[]>("/admin/tracks"),
        apiJson<EmployeeOnboarding[]>("/admin/onboardings"),
      ]);
      setUsers(u);
      setTracks(t);
      setOnboardings(o);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (tracks.length > 0 && taskTrackId === "") setTaskTrackId(tracks[0].track_id);
  }, [tracks, taskTrackId]);

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

  async function createTrack(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    try {
      await apiJson<OnboardingTrack>("/admin/tracks", {
        method: "POST",
        body: JSON.stringify({
          name: trackName,
          description: trackDesc || null,
          target_position: trackPosition,
          duration_days: trackDays,
          is_active: true,
        }),
      });
      setOk("Трек создан");
      setTrackName("");
      setTrackDesc("");
      setTrackPosition("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (taskTrackId === "") return;
    setOk(null);
    try {
      await apiJson<Task>(`/admin/tracks/${taskTrackId}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: taskTitle,
          description: taskDesc || null,
          task_type: taskType,
          expected_duration_days: taskDur,
          task_order: taskOrder,
          is_mandatory: true,
        }),
      });
      setOk("Задача добавлена");
      setTaskTitle("");
      setTaskDesc("");
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

      <div className="grid grid-2">
        <div className="card">
          <h2>Новый трек адаптации</h2>
          <form onSubmit={createTrack}>
            <div className="form-row">
              <label>Название</label>
              <input value={trackName} onChange={(e) => setTrackName(e.target.value)} required />
            </div>
            <div className="form-row">
              <label>Описание</label>
              <textarea value={trackDesc} onChange={(e) => setTrackDesc(e.target.value)} rows={2} />
            </div>
            <div className="form-row">
              <label>Целевая должность</label>
              <input value={trackPosition} onChange={(e) => setTrackPosition(e.target.value)} required />
            </div>
            <div className="form-row">
              <label>Длительность (дней)</label>
              <input type="number" min={1} value={trackDays} onChange={(e) => setTrackDays(Number(e.target.value))} />
            </div>
            <button type="submit" className="btn btn-primary">
              Создать трек
            </button>
          </form>
        </div>
        <div className="card">
          <h2>Задача в треке</h2>
          <form onSubmit={addTask}>
            <div className="form-row">
              <label>Трек</label>
              <select value={taskTrackId === "" ? "" : String(taskTrackId)} onChange={(e) => setTaskTrackId(Number(e.target.value))}>
                {tracks.map((t) => (
                  <option key={t.track_id} value={t.track_id}>
                    #{t.track_id} — {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Название задачи</label>
              <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} required />
            </div>
            <div className="form-row">
              <label>Описание</label>
              <textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} rows={2} />
            </div>
            <div className="form-row">
              <label>Тип</label>
              <select value={taskType} onChange={(e) => setTaskType(e.target.value)}>
                <option value="document">document</option>
                <option value="meeting">meeting</option>
                <option value="training">training</option>
                <option value="system">system</option>
              </select>
            </div>
            <div className="form-row">
              <label>Порядок</label>
              <input type="number" min={1} value={taskOrder} onChange={(e) => setTaskOrder(Number(e.target.value))} />
            </div>
            <div className="form-row">
              <label>Ожидаемая длительность (дней)</label>
              <input type="number" min={1} value={taskDur} onChange={(e) => setTaskDur(Number(e.target.value))} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={!tracks.length}>
              Добавить задачу
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
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id}>
                  <td>{u.user_id}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.is_active ? "да" : "нет"}</td>
                  <td>
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
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
