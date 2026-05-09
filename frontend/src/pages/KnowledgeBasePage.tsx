import { useCallback, useEffect, useMemo, useState } from "react";
import { apiForm, apiJson } from "../api/client";
import type { KnowledgeBaseItem, User } from "../types";

export default function KnowledgeBasePage({ user }: { user: User }) {
  const [items, setItems] = useState<KnowledgeBaseItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const canCreate = user.role === "hr" || user.role === "mentor";

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await apiJson<KnowledgeBaseItem[]>("/knowledge-base");
      setItems(list);
      if (list.length > 0 && selectedId === null) {
        setSelectedId(list[0].item_id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки базы знаний");
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedItem = useMemo(
    () => items.find((x) => x.item_id === selectedId) ?? null,
    [items, selectedId]
  );

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    setError(null);
    setOk(null);

    try {
      const formData = new FormData();
      formData.set("title", title);
      formData.set("content", content);
      if (file) formData.set("file", file);

      const created = await apiForm<KnowledgeBaseItem>("/knowledge-base", formData);
      setOk("Материал базы знаний создан");
      setItems((prev) => [created, ...prev]);
      setSelectedId(created.item_id);
      setIsCreating(false);
      setTitle("");
      setContent("");
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    }
  }

  return (
    <div className="kb-layout">
      <aside className="card kb-sidebar">
        <h2 style={{ marginBottom: "0.7rem" }}>База знаний</h2>
        <div className="kb-list">
          {items.map((item) => (
            <button
              key={item.item_id}
              type="button"
              className={`kb-item ${selectedId === item.item_id && !isCreating ? "active" : ""}`}
              onClick={() => {
                setSelectedId(item.item_id);
                setIsCreating(false);
              }}
            >
              {item.title}
            </button>
          ))}
          {items.length === 0 ? <p className="muted">Пока нет материалов.</p> : null}
        </div>
        {canCreate ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setIsCreating(true);
              setSelectedId(null);
            }}
            style={{ marginTop: "0.8rem" }}
          >
            + Добавить базу
          </button>
        ) : null}
      </aside>

      <section className="card">
        {error ? <div className="alert">{error}</div> : null}
        {ok ? <div className="alert ok">{ok}</div> : null}

        {isCreating ? (
          <form onSubmit={createItem}>
            <h2>Новая база знаний</h2>
            <div className="form-row">
              <label>Название</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="form-row">
              <label>Текст</label>
              <textarea
                rows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Введите описание, инструкции или материалы"
              />
            </div>
            <div className="form-row">
              <label>Файл или изображение</label>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Сохранить
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setIsCreating(false)}>
                Отмена
              </button>
            </div>
          </form>
        ) : selectedItem ? (
          <div>
            <h2>{selectedItem.title}</h2>
            {selectedItem.content ? (
              <p style={{ whiteSpace: "pre-wrap", marginTop: 0 }}>{selectedItem.content}</p>
            ) : (
              <p className="muted">Текст не добавлен.</p>
            )}

            {selectedItem.file_url ? (
              <div style={{ marginTop: "1rem" }}>
                <a href={selectedItem.file_url} target="_blank" rel="noreferrer">
                  Открыть файл: {selectedItem.file_name ?? "вложение"}
                </a>
              </div>
            ) : null}

            <p className="muted" style={{ marginTop: "1rem" }}>
              Создано: {new Date(selectedItem.created_at).toLocaleString()}
            </p>
          </div>
        ) : (
          <div>
            <h2>База знаний</h2>
            <p className="muted">Выберите материал слева.</p>
          </div>
        )}
      </section>
    </div>
  );
}
