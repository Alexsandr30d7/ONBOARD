import { useCallback, useEffect, useMemo, useState } from "react";
import { apiForm, apiJson } from "../api/client";
import type { KnowledgeBaseItem, User } from "../types";

export default function KnowledgeBasePage({ user }: { user: User }) {
  const [items, setItems] = useState<KnowledgeBaseItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [removeCurrentFile, setRemoveCurrentFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const canCreate = user.role === "hr" || user.role === "mentor";

  const load = useCallback(async () => {
    setError(null);
    try {
      const q = search.trim();
      const list = await apiJson<KnowledgeBaseItem[]>(`/knowledge-base${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      setItems(list);
      if (list.length > 0 && (selectedId === null || !list.some((x) => x.item_id === selectedId))) {
        setSelectedId(list[0].item_id);
      }
      if (list.length === 0) setSelectedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки базы знаний");
    }
  }, [search, selectedId]);

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
      setIsEditing(false);
      setTitle("");
      setContent("");
      setFile(null);
      setRemoveCurrentFile(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    }
  }

  function startCreate() {
    setIsCreating(true);
    setIsEditing(false);
    setSelectedId(null);
    setTitle("");
    setContent("");
    setFile(null);
    setRemoveCurrentFile(false);
    setError(null);
    setOk(null);
  }

  function startEdit() {
    if (!selectedItem) return;
    setIsEditing(true);
    setIsCreating(false);
    setTitle(selectedItem.title);
    setContent(selectedItem.content ?? "");
    setFile(null);
    setRemoveCurrentFile(false);
    setError(null);
    setOk(null);
  }

  function cancelForm() {
    setIsEditing(false);
    setIsCreating(false);
    setTitle("");
    setContent("");
    setFile(null);
    setRemoveCurrentFile(false);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate || !selectedItem) return;

    setError(null);
    setOk(null);
    try {
      const formData = new FormData();
      formData.set("title", title);
      formData.set("content", content);
      formData.set("remove_file", String(removeCurrentFile));
      if (file) formData.set("file", file);

      const updated = await apiForm<KnowledgeBaseItem>(`/knowledge-base/${selectedItem.item_id}`, formData, {
        method: "PUT",
      });

      setItems((prev) => prev.map((it) => (it.item_id === updated.item_id ? updated : it)));
      setSelectedId(updated.item_id);
      setIsEditing(false);
      setFile(null);
      setRemoveCurrentFile(false);
      setOk("Материал обновлен");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка обновления");
    }
  }

  async function deleteItem() {
    if (!canCreate || !selectedItem) return;
    if (!window.confirm(`Удалить "${selectedItem.title}"?`)) return;
    setError(null);
    setOk(null);
    try {
      await apiJson<void>(`/knowledge-base/${selectedItem.item_id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((x) => x.item_id !== selectedItem.item_id));
      setSelectedId((prev) => {
        if (prev !== selectedItem.item_id) return prev;
        const rest = items.filter((x) => x.item_id !== selectedItem.item_id);
        return rest.length ? rest[0].item_id : null;
      });
      setIsEditing(false);
      setIsCreating(false);
      setOk("Материал удален");
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка удаления");
    }
  }

  const selectedIsImage = Boolean(selectedItem?.file_mime_type?.startsWith("image/") && selectedItem?.file_url);
  const editingHasCurrentFile = Boolean(selectedItem?.file_url && !removeCurrentFile);

  return (
    <div className="kb-layout">
      <aside className="card kb-sidebar">
        <h2 style={{ marginBottom: "0.7rem" }}>База знаний</h2>
        <div className="form-row" style={{ marginBottom: "0.6rem" }}>
          <label>Поиск по названию</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Например: регламент"
          />
        </div>
        <div className="kb-list">
          {items.map((item) => (
            <button
              key={item.item_id}
              type="button"
              className={`kb-item ${selectedId === item.item_id && !isCreating ? "active" : ""}`}
              onClick={() => {
                setSelectedId(item.item_id);
                setIsCreating(false);
                setIsEditing(false);
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
            onClick={startCreate}
            style={{ marginTop: "0.8rem" }}
          >
            + Добавить базу
          </button>
        ) : null}
      </aside>

      <section className="card">
        {error ? <div className="alert">{error}</div> : null}
        {ok ? <div className="alert ok">{ok}</div> : null}

        {isCreating || isEditing ? (
          <form onSubmit={isCreating ? createItem : saveEdit}>
            <h2>{isCreating ? "Новая база знаний" : "Редактирование базы знаний"}</h2>
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
            {isEditing && selectedItem?.file_url ? (
              <div className="form-row">
                <label style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="checkbox"
                    checked={removeCurrentFile}
                    onChange={(e) => setRemoveCurrentFile(e.target.checked)}
                  />
                  <span>Удалить текущее вложение ({selectedItem.file_name ?? "файл"})</span>
                </label>
              </div>
            ) : null}
            <div className="form-row">
              <label>{isEditing ? "Новое вложение (заменит текущее)" : "Файл или изображение"}</label>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {isCreating ? "Сохранить" : "Сохранить изменения"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={cancelForm}>
                Отмена
              </button>
            </div>
          </form>
        ) : selectedItem ? (
          <div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "space-between", flexWrap: "wrap" }}>
              <h2 style={{ marginBottom: 0 }}>{selectedItem.title}</h2>
              {canCreate ? (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button type="button" className="btn btn-ghost btn-small" onClick={startEdit}>
                    Редактировать
                  </button>
                  <button type="button" className="btn btn-danger btn-small" onClick={() => void deleteItem()}>
                    Удалить
                  </button>
                </div>
              ) : null}
            </div>
            {selectedItem.content ? (
              <p style={{ whiteSpace: "pre-wrap", marginTop: "0.75rem" }}>{selectedItem.content}</p>
            ) : (
              <p className="muted">Текст не добавлен.</p>
            )}

            {editingHasCurrentFile ? (
              <div style={{ marginTop: "1rem" }}>
                <a href={selectedItem.file_url!} target="_blank" rel="noreferrer">
                  Открыть файл: {selectedItem.file_name ?? "вложение"}
                </a>
              </div>
            ) : null}

            {selectedIsImage ? (
              <div style={{ marginTop: "0.9rem" }}>
                <img src={selectedItem.file_url!} alt={selectedItem.file_name ?? selectedItem.title} className="kb-image-preview" />
              </div>
            ) : null}

            <p className="muted" style={{ marginTop: "1rem" }}>
              Создано: {new Date(selectedItem.created_at).toLocaleString()}
            </p>
          </div>
        ) : (
          <div>
            <h2>База знаний</h2>
            <p className="muted">Ничего не найдено. Измени поисковый запрос или создай новый материал.</p>
            {canCreate ? (
              <button type="button" className="btn btn-primary" onClick={startCreate}>
                + Добавить базу
              </button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
