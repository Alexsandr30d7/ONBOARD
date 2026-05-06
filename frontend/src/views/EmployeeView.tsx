import { useCallback, useEffect, useState } from "react";
import { apiJson, apiPost } from "../api/client";
import type { EmployeeOnboarding, EmployeeOnboardingTask } from "../types";

export default function EmployeeView() {
  const [onb, setOnb] = useState<EmployeeOnboarding | null>(null);
  const [tasks, setTasks] = useState<EmployeeOnboardingTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [notesByTask, setNotesByTask] = useState<Record<number, string>>({});
  const [feedbackType, setFeedbackType] = useState("7_days");
  const [feedbackJson, setFeedbackJson] = useState('{"mood":"good","comment":"Всё ок"}');

  const load = useCallback(async () => {
    setError(null);
    try {
      const [o, t] = await Promise.all([
        apiJson<EmployeeOnboarding>("/onboarding/my"),
        apiJson<EmployeeOnboardingTask[]>("/onboarding/my/tasks"),
      ]);
      setOnb(o);
      setTasks(t.sort((a, b) => a.task_order - b.task_order));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setOnb(null);
      setTasks([]);
      setError(msg);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function completeTask(taskId: number) {
    setOk(null);
    const notes = notesByTask[taskId]?.trim();
    try {
      await apiPost(`/onboarding/tasks/${taskId}/complete`, notes ? { notes } : undefined);
      setOk("Задача отмечена выполненной");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  async function sendFeedback(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    let body: unknown;
    try {
      body = JSON.parse(feedbackJson) as object;
    } catch {
      setError("Некорректный JSON в ответах");
      return;
    }
    try {
      await apiJson(`/onboarding/feedback?survey_type=${encodeURIComponent(feedbackType)}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setOk("Обратная связь отправлена");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  if (error && !onb && tasks.length === 0) {
    return (
      <div className="card">
        <h2>Моя адаптация</h2>
        <div className="alert">{error}</div>
        <p className="muted">Убедитесь, что HR запустил для вас адаптацию и у аккаунта роль «новый сотрудник».</p>
        <button type="button" className="btn btn-ghost" onClick={() => void load()}>
          Обновить
        </button>
      </div>
    );
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

      {onb ? (
        <div className="card">
          <h2>Текущая адаптация</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Статус: <strong style={{ color: "var(--text)" }}>{onb.status}</strong> · прогресс {onb.progress_percentage}% · до {onb.expected_end_date}
          </p>
        </div>
      ) : null}

      <div className="card">
        <h2>Задачи</h2>
        <div className="stack">
          {tasks.map((t) => (
            <div key={t.task_id} className="task-row">
              <div>
                <div>
                  <span className="badge" style={{ marginRight: "0.35rem" }}>
                    {t.task_type}
                  </span>
                  <strong>{t.title}</strong>
                </div>
                {t.description ? <div className="muted" style={{ fontSize: "0.88rem" }}>{t.description}</div> : null}
                <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
                  Срок: {t.due_date} ·{" "}
                  <span className={`badge ${t.status === "completed" ? "done" : "pending"}`}>{t.status}</span>
                </div>
                {t.status !== "completed" ? (
                  <div className="form-row" style={{ marginBottom: 0, marginTop: "0.5rem" }}>
                    <label>Комментарий к закрытию</label>
                    <input
                      value={notesByTask[t.task_id] ?? ""}
                      onChange={(e) => setNotesByTask((m) => ({ ...m, [t.task_id]: e.target.value }))}
                      placeholder="Необязательно"
                    />
                  </div>
                ) : null}
              </div>
              <div>
                {t.status !== "completed" ? (
                  <button type="button" className="btn btn-primary btn-small" onClick={() => void completeTask(t.task_id)}>
                    Выполнено
                  </button>
                ) : (
                  <span className="muted">Готово</span>
                )}
              </div>
            </div>
          ))}
        </div>
        {tasks.length === 0 ? <p className="muted">Нет задач в треке.</p> : null}
      </div>

      <div className="card">
        <h2>Обратная связь</h2>
        <form onSubmit={sendFeedback}>
          <div className="form-row">
            <label>Тип опроса</label>
            <select value={feedbackType} onChange={(e) => setFeedbackType(e.target.value)}>
              <option value="7_days">7_days</option>
              <option value="30_days">30_days</option>
              <option value="90_days">90_days</option>
            </select>
          </div>
          <div className="form-row">
            <label>Тело (JSON)</label>
            <textarea value={feedbackJson} onChange={(e) => setFeedbackJson(e.target.value)} rows={4} />
          </div>
          <button type="submit" className="btn btn-primary">
            Отправить
          </button>
        </form>
      </div>
    </div>
  );
}
