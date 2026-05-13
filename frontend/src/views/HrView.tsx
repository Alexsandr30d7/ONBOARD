import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson } from "../api/client";
import type {
  Employee,
  MentorContact,
  OnboardingRisk,
  OnboardingRiskDetail,
  OnboardingTrack,
  Role,
  Task,
  User,
} from "../types";
import ChatPanel from "../components/ChatPanel";

function riskClass(level: OnboardingRisk["risk_level"]) {
  if (level === "high") return "risk-high";
  if (level === "medium") return "risk-medium";
  return "risk-low";
}

function riskReason(r: OnboardingRisk) {
  if (r.factors.inactivity_days >= 7) return `Высокий риск из-за ${r.factors.inactivity_days} дней неактивности`;
  if (r.factors.negative_feedback) return "Высокий риск из-за негативного отзыва";
  if (r.factors.overdue_ratio >= 40) return `Высокий риск из-за ${r.factors.overdue_ratio}% просрочки`;
  if (r.factors.pace_drop >= 30) return `Риск из-за отставания темпа на ${r.factors.pace_drop}%`;
  return "Риск стабилен, требуется мониторинг";
}

export default function HrView({ user }: { user: User }) {
  const isMentor = user.role === "mentor";
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tracks, setTracks] = useState<OnboardingTrack[]>([]);
  const [risks, setRisks] = useState<OnboardingRisk[]>([]);
  const [mentors, setMentors] = useState<MentorContact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [hireDate, setHireDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [empId, setEmpId] = useState<number | "">("");
  const [trackId, setTrackId] = useState<number | "">("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
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
  const [mentorEmployeeId, setMentorEmployeeId] = useState<number | "">("");
  const [mentorUserId, setMentorUserId] = useState<number | "">("");
  const [assignLoading, setAssignLoading] = useState(false);

  const [riskLevelFilter, setRiskLevelFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [trackFilter, setTrackFilter] = useState("all");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [selectedRiskId, setSelectedRiskId] = useState<number | null>(null);
  const [selectedRiskDetail, setSelectedRiskDetail] = useState<OnboardingRiskDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionComment, setActionComment] = useState("");
  const [riskActionLoading, setRiskActionLoading] = useState<Record<number, boolean>>({});

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const riskPromise = apiJson<OnboardingRisk[]>("/hr/onboarding-risk");
      if (isMentor) {
        const r = await riskPromise;
        setRisks(r);
      } else {
        const [e, t, r, m] = await Promise.all([
          apiJson<Employee[]>("/hr/employees"),
          apiJson<OnboardingTrack[]>("/hr/tracks"),
          riskPromise,
          apiJson<MentorContact[]>("/chat/mentors"),
        ]);
        setEmployees(e);
        setTracks(t);
        setRisks(r);
        setMentors(m);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    }
  }, [isMentor]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (employees.length && empId === "") setEmpId(employees[0].employee_id);
  }, [employees, empId]);
  useEffect(() => {
    if (employees.length && mentorEmployeeId === "") setMentorEmployeeId(employees[0].employee_id);
  }, [employees, mentorEmployeeId]);
  useEffect(() => {
    if (mentors.length && mentorUserId === "") setMentorUserId(mentors[0].mentor_user_id);
  }, [mentors, mentorUserId]);
  useEffect(() => {
    if (tracks.length && trackId === "") setTrackId(tracks[0].track_id);
  }, [tracks, trackId]);
  useEffect(() => {
    if (tracks.length && taskTrackId === "") setTaskTrackId(tracks[0].track_id);
  }, [tracks, taskTrackId]);

  const filteredRisks = useMemo(() => {
    return risks.filter((r) => {
      if (riskLevelFilter !== "all" && r.risk_level !== riskLevelFilter) return false;
      if (trackFilter !== "all" && r.track_name !== trackFilter) return false;
      if (startDateFilter && r.onboarding_start_date < startDateFilter) return false;
      return true;
    });
  }, [risks, riskLevelFilter, trackFilter, startDateFilter]);

  const kpi = useMemo(() => {
    const total = risks.length;
    const high = risks.filter((r) => r.risk_level === "high").length;
    const medium = risks.filter((r) => r.risk_level === "medium").length;
    const avg = total ? Math.round(risks.reduce((sum, r) => sum + r.risk_score, 0) / total) : 0;
    return { total, high, medium, avg };
  }, [risks]);

  async function openRiskDetail(onboardingId: number) {
    setSelectedRiskId(onboardingId);
    setDetailLoading(true);
    try {
      const detail = await apiJson<OnboardingRiskDetail>(`/hr/onboarding-risk/${onboardingId}`);
      setSelectedRiskDetail(detail);
      setActionComment("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки деталей риска");
    } finally {
      setDetailLoading(false);
    }
  }

  async function runRiskAction(onboardingId: number, actionType: "plan_1on1" | "send_nudge") {
    setRiskActionLoading((prev) => ({ ...prev, [onboardingId]: true }));
    try {
      const res = await apiJson<{ message: string }>(
        `/hr/onboarding-risk/${onboardingId}/action?action_type=${actionType}&comment=${encodeURIComponent(actionComment)}`,
        { method: "POST" }
      );
      setOk(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка действия");
    } finally {
      setRiskActionLoading((prev) => ({ ...prev, [onboardingId]: false }));
    }
  }

  async function createEmployee(ev: React.FormEvent) {
    ev.preventDefault();
    setOk(null);
    try {
      await apiJson<User>("/hr/employees", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          hire_date: hireDate,
          position,
          department,
        }),
      });
      setOk("Сотрудник и учётная запись созданы");
      setEmail("");
      setPassword("");
      setFirstName("");
      setLastName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  async function startOnboarding(ev: React.FormEvent) {
    ev.preventDefault();
    if (empId === "" || trackId === "") return;
    setOk(null);
    try {
      await apiJson("/onboarding/start", {
        method: "POST",
        body: JSON.stringify({
          employee_id: empId,
          track_id: trackId,
          start_date: startDate,
        }),
      });
      setOk("Адаптация запущена");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  async function createTrack(ev: React.FormEvent) {
    ev.preventDefault();
    setOk(null);
    try {
      await apiJson<OnboardingTrack>("/hr/tracks", {
        method: "POST",
        body: JSON.stringify({
          name: trackName,
          description: trackDesc || null,
          target_position: trackPosition,
          duration_days: trackDays,
          is_active: true,
        }),
      });
      setOk("Трек адаптации создан");
      setTrackName("");
      setTrackDesc("");
      setTrackPosition("");
      setTrackDays(30);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  async function addTaskToTrack(ev: React.FormEvent) {
    ev.preventDefault();
    if (taskTrackId === "") return;
    setOk(null);
    try {
      await apiJson<Task>(`/hr/tracks/${taskTrackId}/tasks`, {
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
      setOk("Задача добавлена в трек");
      setTaskTitle("");
      setTaskDesc("");
      setTaskType("document");
      setTaskOrder(1);
      setTaskDur(3);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  async function assignMentor(ev: React.FormEvent) {
    ev.preventDefault();
    if (mentorEmployeeId === "" || mentorUserId === "") return;
    setOk(null);
    setError(null);
    setAssignLoading(true);
    try {
      await apiJson<void>("/chat/assignments", {
        method: "PUT",
        body: JSON.stringify({ employee_id: mentorEmployeeId, mentor_user_id: mentorUserId }),
      });
      setOk("Ментор назначен (или обновлен) для сотрудника");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка назначения ментора");
    } finally {
      setAssignLoading(false);
    }
  }

  const uniqueTrackNames = Array.from(new Set(risks.map((r) => r.track_name)));

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
        <div className="card kpi-card">
          <h2>Активные адаптации</h2>
          <div className="kpi-value">{kpi.total}</div>
        </div>
        <div className="card kpi-card risk-high">
          <h2>High Risk</h2>
          <div className="kpi-value">{kpi.high}</div>
        </div>
        <div className="card kpi-card risk-medium">
          <h2>Medium Risk</h2>
          <div className="kpi-value">{kpi.medium}</div>
        </div>
        <div className="card kpi-card">
          <h2>Средний EWS Score</h2>
          <div className="kpi-value">{kpi.avg}</div>
        </div>
      </div>

      <div className="card">
        <h2>Risk Dashboard</h2>
        <div className="grid grid-2">
          <div className="form-row">
            <label>Уровень риска</label>
            <select value={riskLevelFilter} onChange={(e) => setRiskLevelFilter(e.target.value as typeof riskLevelFilter)}>
              <option value="all">Все</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="form-row">
            <label>Трек адаптации</label>
            <select value={trackFilter} onChange={(e) => setTrackFilter(e.target.value)}>
              <option value="all">Все</option>
              {uniqueTrackNames.map((trackNameOption) => (
                <option key={trackNameOption} value={trackNameOption}>
                  {trackNameOption}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Дата старта не раньше</label>
            <input type="date" value={startDateFilter} onChange={(e) => setStartDateFilter(e.target.value)} />
          </div>
          <div className="form-row">
            <label>&nbsp;</label>
            <button type="button" className="btn btn-ghost" onClick={() => { setRiskLevelFilter("all"); setTrackFilter("all"); setStartDateFilter(""); }}>
              Сбросить фильтры
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Трек</th>
                <th>Дней</th>
                <th>Score</th>
                <th>Уровень</th>
                <th>Индикатор</th>
              </tr>
            </thead>
            <tbody>
              {filteredRisks.map((r) => (
                <tr key={r.onboarding_id} onClick={() => void openRiskDetail(r.onboarding_id)} style={{ cursor: "pointer" }}>
                  <td>
                    <span className="ews-widget" title={riskReason(r)}>
                      <span className={`ews-dot ${riskClass(r.risk_level)}`} />
                      <span>{r.risk_score}</span>
                    </span>
                    {" "}{r.employee_name}
                  </td>
                  <td>{r.track_name}</td>
                  <td>{r.days_in_onboarding}</td>
                  <td>{r.risk_score}</td>
                  <td>
                    <span className={`badge ${r.risk_level === "high" ? "pending" : r.risk_level === "medium" ? "" : "done"}`}>
                      {r.risk_level.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <div className="risk-meter">
                      <div className={`risk-meter-fill ${riskClass(r.risk_level)}`} style={{ width: `${r.risk_score}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredRisks.length === 0 ? <p className="muted">Нет записей для выбранных фильтров.</p> : null}
      </div>

      {isMentor ? (
        <div className="card">
          <h2>Чаты с сотрудниками</h2>
          <ChatPanel user={user} />
        </div>
      ) : null}

      {selectedRiskId ? (
        <div className="modal-backdrop" role="presentation" onClick={() => { setSelectedRiskId(null); setSelectedRiskDetail(null); }}>
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            {detailLoading || !selectedRiskDetail ? (
              <p className="muted">Загрузка детализации...</p>
            ) : (
              <div className="grid">
                <div>
                  <h2 style={{ marginBottom: "0.3rem" }}>{selectedRiskDetail.employee_name}</h2>
                  <p className="muted" style={{ marginTop: 0 }}>
                    {selectedRiskDetail.track_name} · статус {selectedRiskDetail.status} · score {selectedRiskDetail.risk_score} (
                    {selectedRiskDetail.risk_level.toUpperCase()})
                  </p>
                </div>

                <div className="card" style={{ padding: "0.75rem 0.9rem" }}>
                  <h2>Факторы алгоритма</h2>
                  <div className="factor-row">
                    <span>Просрочка (35%)</span>
                    <div className="risk-meter"><div className="risk-meter-fill risk-high" style={{ width: `${selectedRiskDetail.factors.overdue_ratio}%` }} /></div>
                    <span>{selectedRiskDetail.factors.overdue_ratio}%</span>
                  </div>
                  <div className="factor-row">
                    <span>Отставание темпа (25%)</span>
                    <div className="risk-meter"><div className="risk-meter-fill risk-medium" style={{ width: `${selectedRiskDetail.factors.pace_drop}%` }} /></div>
                    <span>{selectedRiskDetail.factors.pace_drop}%</span>
                  </div>
                  <div className="factor-row">
                    <span>Неактивность (20%)</span>
                    <div className="risk-meter"><div className="risk-meter-fill risk-low" style={{ width: `${Math.min(100, selectedRiskDetail.factors.inactivity_days * 5)}%` }} /></div>
                    <span>{selectedRiskDetail.factors.inactivity_days} дн.</span>
                  </div>
                  <div className="factor-row">
                    <span>Негативный feedback (20%)</span>
                    <div className="risk-meter"><div className="risk-meter-fill risk-high" style={{ width: `${selectedRiskDetail.factors.negative_feedback ? 100 : 0}%` }} /></div>
                    <span>{selectedRiskDetail.factors.negative_feedback ? "100" : "0"}</span>
                  </div>
                </div>

                <div className="card" style={{ padding: "0.75rem 0.9rem" }}>
                  <h2>План vs Факт</h2>
                  <div className="factor-row">
                    <span>Плановый прогресс</span>
                    <div className="risk-meter"><div className="risk-meter-fill risk-medium" style={{ width: `${selectedRiskDetail.planned_progress}%` }} /></div>
                    <span>{selectedRiskDetail.planned_progress}%</span>
                  </div>
                  <div className="factor-row">
                    <span>Фактический прогресс</span>
                    <div className="risk-meter"><div className="risk-meter-fill risk-low" style={{ width: `${selectedRiskDetail.actual_progress}%` }} /></div>
                    <span>{selectedRiskDetail.actual_progress}%</span>
                  </div>
                </div>

                <div className="card" style={{ padding: "0.75rem 0.9rem" }}>
                  <h2>Просроченные задачи</h2>
                  {selectedRiskDetail.overdue_tasks.length ? (
                    <ul className="stack" style={{ margin: 0 }}>
                      {selectedRiskDetail.overdue_tasks.map((task) => (
                        <li key={task.task_id}>
                          <strong>{task.title}</strong> — дедлайн {task.due_date}, статус {task.status}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Нет просроченных задач.</p>
                  )}
                </div>

                <div className="card" style={{ padding: "0.75rem 0.9rem" }}>
                  <h2>Активность и feedback</h2>
                  <p className="muted">Последняя активность: {selectedRiskDetail.last_activity_date ?? "нет данных"}</p>
                  <p style={{ marginBottom: 0 }}>
                    {selectedRiskDetail.latest_feedback_excerpt ? selectedRiskDetail.latest_feedback_excerpt : "Нет обратной связи."}
                  </p>
                </div>

                <div className="card" style={{ padding: "0.75rem 0.9rem" }}>
                  <h2>Рекомендуемые действия</h2>
                  <div className="form-row">
                    <label>Комментарий HR/ментора</label>
                    <textarea rows={3} value={actionComment} onChange={(e) => setActionComment(e.target.value)} />
                  </div>
                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn btn-danger btn-small"
                      disabled={Boolean(riskActionLoading[selectedRiskDetail.onboarding_id])}
                      onClick={() => void runRiskAction(selectedRiskDetail.onboarding_id, "plan_1on1")}
                    >
                      Назначить 1-on-1
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-small"
                      disabled={Boolean(riskActionLoading[selectedRiskDetail.onboarding_id])}
                      onClick={() => void runRiskAction(selectedRiskDetail.onboarding_id, "send_nudge")}
                    >
                      Отправить напоминание
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {!isMentor ? (
        <>
          <div className="card">
            <h2>Назначение ментора</h2>
            <form onSubmit={assignMentor}>
              <div className="grid grid-2">
                <div className="form-row">
                  <label>Сотрудник</label>
                  <select
                    value={mentorEmployeeId === "" ? "" : String(mentorEmployeeId)}
                    onChange={(e) => setMentorEmployeeId(e.target.value ? Number(e.target.value) : "")}
                    disabled={!employees.length}
                  >
                    {employees.map((x) => (
                      <option key={x.employee_id} value={x.employee_id}>
                        #{x.employee_id} {x.first_name} {x.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label>Ментор</label>
                  <select
                    value={mentorUserId === "" ? "" : String(mentorUserId)}
                    onChange={(e) => setMentorUserId(e.target.value ? Number(e.target.value) : "")}
                    disabled={!mentors.length}
                  >
                    {mentors.map((m) => (
                      <option key={m.mentor_user_id} value={m.mentor_user_id}>
                        #{m.mentor_user_id} {m.mentor_email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={!employees.length || !mentors.length || assignLoading}>
                Назначить
              </button>
              {!mentors.length ? <p className="muted">Нет пользователей с ролью mentor. Создай их в админке.</p> : null}
            </form>
          </div>

          <div className="grid grid-2">
            <div className="card">
              <h2>Новый трек адаптации</h2>
              <form onSubmit={createTrack}>
                <div className="form-row"><label>Название</label><input value={trackName} onChange={(e) => setTrackName(e.target.value)} required /></div>
                <div className="form-row"><label>Описание</label><textarea value={trackDesc} onChange={(e) => setTrackDesc(e.target.value)} rows={2} /></div>
                <div className="form-row"><label>Целевая должность</label><input value={trackPosition} onChange={(e) => setTrackPosition(e.target.value)} required /></div>
                <div className="form-row"><label>Длительность (дней)</label><input type="number" min={1} value={trackDays} onChange={(e) => setTrackDays(Number(e.target.value))} /></div>
                <button type="submit" className="btn btn-primary">Создать трек</button>
              </form>
            </div>
            <div className="card">
              <h2>Задача в треке</h2>
              <form onSubmit={addTaskToTrack}>
                <div className="form-row">
                  <label>Трек</label>
                  <select value={taskTrackId === "" ? "" : String(taskTrackId)} onChange={(e) => setTaskTrackId(e.target.value ? Number(e.target.value) : "")} disabled={!tracks.length}>
                    {tracks.map((t) => <option key={t.track_id} value={t.track_id}>#{t.track_id} — {t.name}</option>)}
                  </select>
                </div>
                <div className="form-row"><label>Название задачи</label><input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} required /></div>
                <div className="form-row"><label>Описание</label><textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} rows={2} /></div>
                <div className="form-row"><label>Тип</label><select value={taskType} onChange={(e) => setTaskType(e.target.value)}><option value="document">document</option><option value="meeting">meeting</option><option value="training">training</option><option value="system">system</option></select></div>
                <div className="form-row"><label>Порядок</label><input type="number" min={1} value={taskOrder} onChange={(e) => setTaskOrder(Number(e.target.value))} /></div>
                <div className="form-row"><label>Ожидаемая длительность (дней)</label><input type="number" min={1} value={taskDur} onChange={(e) => setTaskDur(Number(e.target.value))} /></div>
                <button type="submit" className="btn btn-primary" disabled={!tracks.length}>Добавить задачу</button>
              </form>
            </div>
          </div>

          <div className="grid grid-2">
            <div className="card">
              <h2>Новый сотрудник</h2>
              <form onSubmit={createEmployee}>
                <div className="form-row"><label>Email (логин)</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                <div className="form-row"><label>Пароль</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
                <div className="form-row"><label>Имя</label><input value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></div>
                <div className="form-row"><label>Фамилия</label><input value={lastName} onChange={(e) => setLastName(e.target.value)} required /></div>
                <div className="form-row"><label>Дата найма</label><input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} required /></div>
                <div className="form-row"><label>Должность</label><input value={position} onChange={(e) => setPosition(e.target.value)} required /></div>
                <div className="form-row"><label>Отдел</label><input value={department} onChange={(e) => setDepartment(e.target.value)} required /></div>
                <button type="submit" className="btn btn-primary">Создать</button>
              </form>
            </div>
            <div className="card">
              <h2>Запуск адаптации</h2>
              <form onSubmit={startOnboarding}>
                <div className="form-row"><label>Сотрудник</label><select value={empId === "" ? "" : String(empId)} onChange={(e) => setEmpId(e.target.value ? Number(e.target.value) : "")} disabled={!employees.length}>{employees.map((x) => <option key={x.employee_id} value={x.employee_id}>#{x.employee_id} {x.first_name} {x.last_name}</option>)}</select></div>
                <div className="form-row"><label>Трек</label><select value={trackId === "" ? "" : String(trackId)} onChange={(e) => setTrackId(e.target.value ? Number(e.target.value) : "")} disabled={!tracks.length}>{tracks.map((t) => <option key={t.track_id} value={t.track_id}>#{t.track_id} {t.name}</option>)}</select></div>
                <div className="form-row"><label>Дата старта</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></div>
                <button type="submit" className="btn btn-primary" disabled={!employees.length || !tracks.length}>Старт</button>
              </form>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
