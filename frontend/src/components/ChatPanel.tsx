import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiJson } from "../api/client";
import type { ChatMessage, EmployeeContact, MentorContact, Role, User } from "../types";

type Contact = { employee_id: number; label: string };

export default function ChatPanel({ user }: { user: User }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeEmployeeId, setActiveEmployeeId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const isMentor = user.role === "mentor";
  const isEmployee = user.role === "new_employee";

  const loadContacts = useCallback(async () => {
    setError(null);
    try {
      if (isEmployee) {
        const mentor = (await apiJson<MentorContact>("/chat/contacts")) as MentorContact;
        if (!mentor.employee_id) throw new Error("Ментор не назначен (нет employee_id для чата).");
        setContacts([{ employee_id: mentor.employee_id, label: `Ментор: ${mentor.mentor_email}` }]);
        setActiveEmployeeId(mentor.employee_id);
      } else if (isMentor) {
        const emps = (await apiJson<EmployeeContact[]>("/chat/contacts")) as EmployeeContact[];
        const mapped = emps.map((e) => ({ employee_id: e.employee_id, label: `${e.employee_name} (${e.user_email})` }));
        setContacts(mapped);
        if (mapped.length && activeEmployeeId === null) setActiveEmployeeId(mapped[0].employee_id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки контактов");
    }
  }, [activeEmployeeId, isEmployee, isMentor]);

  const loadMessages = useCallback(async () => {
    if (!activeEmployeeId) return;
    setLoading(true);
    try {
      const list = await apiJson<ChatMessage[]>(`/chat/messages?employee_id=${activeEmployeeId}`);
      setMessages(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки сообщений");
    } finally {
      setLoading(false);
    }
  }, [activeEmployeeId]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    void loadMessages();
    const t = window.setInterval(() => {
      void loadMessages();
    }, 2500);
    return () => window.clearInterval(t);
  }, [loadMessages]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(ev: React.FormEvent) {
    ev.preventDefault();
    if (!activeEmployeeId) return;
    const body = text.trim();
    if (!body) return;
    setError(null);
    setText("");
    try {
      const created = await apiJson<ChatMessage>("/chat/messages", {
        method: "POST",
        body: JSON.stringify({ employee_id: activeEmployeeId, text: body }),
      });
      setMessages((prev) => [...prev, created]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка отправки");
      setText(body);
    }
  }

  const activeLabel = useMemo(() => contacts.find((c) => c.employee_id === activeEmployeeId)?.label ?? null, [contacts, activeEmployeeId]);

  if (user.role !== ("mentor" as Role) && user.role !== ("new_employee" as Role)) {
    return (
      <div className="card">
        <h2>Чат</h2>
        <p className="muted">Доступно только сотруднику и ментору.</p>
      </div>
    );
  }

  return (
    <div className="kb-layout" style={{ gridTemplateColumns: "320px 1fr" }}>
      <aside className="card">
        <h2 style={{ marginBottom: "0.6rem" }}>Чаты</h2>
        {error ? <div className="alert">{error}</div> : null}
        <div className="kb-list">
          {contacts.map((c) => (
            <button
              key={c.employee_id}
              type="button"
              className={`kb-item ${activeEmployeeId === c.employee_id ? "active" : ""}`}
              onClick={() => setActiveEmployeeId(c.employee_id)}
            >
              {c.label}
            </button>
          ))}
          {contacts.length === 0 ? <p className="muted">Нет доступных чатов.</p> : null}
        </div>
      </aside>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>{activeLabel ?? "Диалог"}</h2>
        <div ref={listRef} className="chat-list">
          {messages.map((m) => (
            <div key={m.message_id} className={`chat-msg ${m.sender_user_id === user.user_id ? "me" : "them"}`}>
              <div className="chat-bubble">{m.text}</div>
              <div className="muted" style={{ fontSize: "0.75rem" }}>
                {new Date(m.created_at).toLocaleString()}
              </div>
            </div>
          ))}
          {loading && messages.length === 0 ? <p className="muted">Загрузка…</p> : null}
        </div>
        <form onSubmit={send} className="chat-form">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Напишите сообщение…" />
          <button type="submit" className="btn btn-primary btn-small" disabled={!activeEmployeeId}>
            Отправить
          </button>
        </form>
      </section>
    </div>
  );
}

