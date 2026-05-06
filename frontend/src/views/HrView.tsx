import { useCallback, useEffect, useState } from "react";
import { apiJson } from "../api/client";
import type { Employee, OnboardingTrack, User } from "../types";

export default function HrView() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tracks, setTracks] = useState<OnboardingTrack[]>([]);
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

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [e, t] = await Promise.all([apiJson<Employee[]>("/hr/employees"), apiJson<OnboardingTrack[]>("/hr/tracks")]);
      setEmployees(e);
      setTracks(t);
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
