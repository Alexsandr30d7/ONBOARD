import { useCallback, useEffect, useState } from "react";
import { apiJson } from "../api/client";
import type { Employee, OnboardingRisk, OnboardingTrack, User } from "../types";

export default function HrView() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tracks, setTracks] = useState<OnboardingTrack[]>([]);
  const [risks, setRisks] = useState<OnboardingRisk[]>([]);
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
  const [showHighRiskOnly, setShowHighRiskOnly] = useState(false);
  const [riskActionLoading, setRiskActionLoading] = useState<Record<number, boolean>>({});

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [e, t, r] = await Promise.all([
        apiJson<Employee[]>("/hr/employees"),
        apiJson<OnboardingTrack[]>("/hr/tracks"),
        apiJson<OnboardingRisk[]>("/hr/onboarding-risk"),
      ]);
      setEmployees(e);
      setTracks(t);
      setRisks(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (employees.length && empId === "") setEmpId(employees[0].employee_id);
  }, [employees, empId]);

  useEffect(() => {
    if (tracks.length && trackId === "") setTrackId(tracks[0].track_id);
  }, [tracks, trackId]);

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

  async function runRiskAction(onboardingId: number, actionType: "plan_1on1" | "send_nudge") {
    setOk(null);
    setRiskActionLoading((prev) => ({ ...prev, [onboardingId]: true }));
    try {
      const res = await apiJson<{ onboarding_id: number; action_type: string; message: string }>(
        `/hr/onboarding-risk/${onboardingId}/action?action_type=${actionType}`,
        { method: "POST" }
      );
      setOk(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка действия");
    } finally {
      setRiskActionLoading((prev) => ({ ...prev, [onboardingId]: false }));
    }
  }

  const displayedRisks = showHighRiskOnly ? risks.filter((r) => r.risk_level === "high") : risks;

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
          <h2>Новый сотрудник</h2>
          <form onSubmit={createEmployee}>
            <div className="form-row">
              <label>Email (логин)</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="form-row">
              <label>Пароль</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="form-row">
              <label>Имя</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="form-row">
              <label>Фамилия</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
            <div className="form-row">
              <label>Дата найма</label>
              <input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} required />
            </div>
            <div className="form-row">
              <label>Должность</label>
              <input value={position} onChange={(e) => setPosition(e.target.value)} required />
            </div>
            <div className="form-row">
              <label>Отдел</label>
              <input value={department} onChange={(e) => setDepartment(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary">
              Создать
            </button>
          </form>
        </div>

        <div className="card">
          <h2>Запуск адаптации</h2>
          <form onSubmit={startOnboarding}>
            <div className="form-row">
              <label>Сотрудник</label>
              <select
                value={empId === "" ? "" : String(empId)}
                onChange={(e) => setEmpId(e.target.value ? Number(e.target.value) : "")}
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
              <label>Трек</label>
              <select
                value={trackId === "" ? "" : String(trackId)}
                onChange={(e) => setTrackId(e.target.value ? Number(e.target.value) : "")}
                disabled={!tracks.length}
              >
                {tracks.map((t) => (
                  <option key={t.track_id} value={t.track_id}>
                    #{t.track_id} {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Дата старта</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={!employees.length || !tracks.length}>
              Старт
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <h2>Риск срыва адаптации</h2>
        <div style={{ marginBottom: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
            <input type="checkbox" checked={showHighRiskOnly} onChange={(e) => setShowHighRiskOnly(e.target.checked)} />
            <span>Только high-risk</span>
          </label>
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            Показано: {displayedRisks.length} из {risks.length}
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Трек</th>
                <th>Score</th>
                <th>Уровень</th>
                <th>Факторы</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {displayedRisks.map((r) => (
                <tr key={r.onboarding_id}>
                  <td>
                    {r.employee_name} (#{r.employee_id})
                  </td>
                  <td>{r.track_name}</td>
                  <td>{r.risk_score}</td>
                  <td>
                    <span className={`badge ${r.risk_level === "high" ? "pending" : r.risk_level === "medium" ? "" : "done"}`}>
                      {r.risk_level.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    просрочка {r.factors.overdue_ratio}% · темп {r.factors.pace_drop}% · тишина {r.factors.inactivity_days} дн. ·
                    негатив {r.factors.negative_feedback ? "да" : "нет"}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {r.risk_level === "high" ? (
                      <button
                        type="button"
                        className="btn btn-danger btn-small"
                        disabled={Boolean(riskActionLoading[r.onboarding_id])}
                        onClick={() => void runRiskAction(r.onboarding_id, "plan_1on1")}
                      >
                        1:1 за 48ч
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-small"
                        disabled={Boolean(riskActionLoading[r.onboarding_id])}
                        onClick={() => void runRiskAction(r.onboarding_id, "send_nudge")}
                      >
                        Напомнить
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {displayedRisks.length === 0 ? <p className="muted">Нет записей для текущего фильтра.</p> : null}
      </div>

      <div className="card">
        <h2>Сотрудники</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Имя</th>
                <th>Должность</th>
                <th>Отдел</th>
                <th>Найм</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((x) => (
                <tr key={x.employee_id}>
                  <td>{x.employee_id}</td>
                  <td>
                    {x.first_name} {x.last_name}
                  </td>
                  <td>{x.position}</td>
                  <td>{x.department}</td>
                  <td>{x.hire_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
