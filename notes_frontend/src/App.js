import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const STORAGE_KEY = "simpleNotesApp.notes.v1";

/**
 * @typedef {Object} Note
 * @property {string} id
 * @property {string} title
 * @property {string} body
 * @property {number} updatedAt
 */

/**
 * Create a reasonably unique id without extra dependencies.
 * (Uses crypto.randomUUID when available, falls back to time+random.)
 */
function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Extract the first non-empty line as a "title" fallback.
 * If the body is empty, returns "Untitled".
 */
function deriveTitle(body) {
  const lines = (body || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines[0] ? lines[0].slice(0, 60) : "Untitled";
}

/**
 * Format timestamp as a small, human readable value.
 */
function formatUpdatedAt(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Safely load notes from localStorage.
 * @returns {Note[]}
 */
function loadNotes() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((n) => n && typeof n === "object")
      .map((n) => ({
        id: String(n.id ?? createId()),
        title: String(n.title ?? ""),
        body: String(n.body ?? ""),
        updatedAt: Number(n.updatedAt ?? Date.now()),
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/**
 * Persist notes to localStorage.
 * @param {Note[]} notes
 */
function saveNotes(notes) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

// PUBLIC_INTERFACE
function App() {
  /** @type {[Note[], Function]} */
  const [notes, setNotes] = useState(() => loadNotes());
  const [selectedId, setSelectedId] = useState(() => (loadNotes()[0]?.id ?? null));

  // Editor state (supports both create and edit using the same input)
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const bodyRef = useRef(null);

  const selectedNote = useMemo(
    () => (selectedId ? notes.find((n) => n.id === selectedId) ?? null : null),
    [notes, selectedId]
  );

  // Keep localStorage synced.
  useEffect(() => {
    try {
      saveNotes(notes);
    } catch {
      // Ignore storage exceptions (e.g., quota exceeded) to avoid breaking UI.
    }
  }, [notes]);

  // When selection changes, load it into the editor.
  useEffect(() => {
    if (selectedNote) {
      setDraftTitle(selectedNote.title || deriveTitle(selectedNote.body));
      setDraftBody(selectedNote.body || "");
    } else {
      setDraftTitle("");
      setDraftBody("");
    }
  }, [selectedNote]);

  // Keep selection valid if a note is deleted.
  useEffect(() => {
    if (selectedId && !notes.some((n) => n.id === selectedId)) {
      setSelectedId(notes[0]?.id ?? null);
    }
  }, [notes, selectedId]);

  // PUBLIC_INTERFACE
  const startNewNote = () => {
    setSelectedId(null);
    setDraftTitle("");
    setDraftBody("");
    // Focus editor body for quick entry.
    setTimeout(() => bodyRef.current?.focus(), 0);
  };

  const upsertNote = () => {
    const trimmedTitle = (draftTitle || "").trim();
    const trimmedBody = (draftBody || "").trimEnd();

    // Avoid creating empty notes.
    if (!trimmedTitle && !trimmedBody) return;

    const now = Date.now();
    const title = trimmedTitle || deriveTitle(trimmedBody);

    if (selectedNote) {
      // Update existing
      const updated = {
        ...selectedNote,
        title,
        body: trimmedBody,
        updatedAt: now,
      };
      setNotes((prev) => [updated, ...prev.filter((n) => n.id !== selectedNote.id)]);
      setSelectedId(updated.id);
      return;
    }

    // Create new
    const created = {
      id: createId(),
      title,
      body: trimmedBody,
      updatedAt: now,
    };
    setNotes((prev) => [created, ...prev]);
    setSelectedId(created.id);
  };

  // PUBLIC_INTERFACE
  const deleteNote = (id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    upsertNote();
  };

  const onEditorKeyDown = (e) => {
    // Cmd/Ctrl + Enter saves
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      upsertNote();
    }
  };

  const hasAnyNotes = notes.length > 0;

  return (
    <div className="App">
      <div className="page">
        <header className="header">
          <div className="header__left">
            <div className="brandMark" aria-hidden="true" />
            <div>
              <h1 className="header__title">Notes</h1>
              <p className="header__subtitle">Create, edit, and keep notes locally in your browser.</p>
            </div>
          </div>

          <div className="header__actions">
            <button type="button" className="btn btn-secondary" onClick={startNewNote}>
              New note
            </button>
          </div>
        </header>

        <main className="content" aria-label="Notes app content">
          <section className="editorCard" aria-label="Note editor">
            <form className="editor" onSubmit={onSubmit}>
              <div className="editor__top">
                <div className="editor__titleWrap">
                  <label className="srOnly" htmlFor="note-title">
                    Title
                  </label>
                  <input
                    id="note-title"
                    className="input"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="Title (optional)"
                    onKeyDown={onEditorKeyDown}
                    autoComplete="off"
                  />
                </div>

                <button type="submit" className="btn btn-primary" disabled={!draftTitle.trim() && !draftBody.trim()}>
                  {selectedNote ? "Save" : "Create"}
                </button>
              </div>

              <div className="editor__body">
                <label className="srOnly" htmlFor="note-body">
                  Note
                </label>
                <textarea
                  id="note-body"
                  ref={bodyRef}
                  className="textarea"
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  placeholder="Write a note..."
                  onKeyDown={onEditorKeyDown}
                  rows={6}
                />
                <div className="editor__help" role="note">
                  Tip: press <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Enter</kbd> to save.
                </div>
              </div>
            </form>
          </section>

          <section className="notesSection" aria-label="Notes list">
            <div className="notesSection__header">
              <h2 className="sectionTitle">Your notes</h2>
              <div className="sectionMeta">{hasAnyNotes ? `${notes.length} total` : "No notes yet"}</div>
            </div>

            {!hasAnyNotes ? (
              <div className="emptyState">
                <div className="emptyState__card">
                  <div className="emptyState__icon" aria-hidden="true">
                    📝
                  </div>
                  <div className="emptyState__text">
                    <div className="emptyState__title">Start writing</div>
                    <div className="emptyState__subtitle">
                      Create your first note above. Notes are saved automatically in this browser.
                    </div>
                  </div>
                  <button type="button" className="btn btn-primary" onClick={startNewNote}>
                    New note
                  </button>
                </div>
              </div>
            ) : (
              <ul className="notesList" aria-label="Existing notes">
                {notes.map((note) => {
                  const isSelected = note.id === selectedId;
                  return (
                    <li key={note.id} className="notesList__item">
                      <button
                        type="button"
                        className={`noteCard ${isSelected ? "noteCard--selected" : ""}`}
                        onClick={() => setSelectedId(note.id)}
                        aria-current={isSelected ? "true" : "false"}
                      >
                        <div className="noteCard__main">
                          <div className="noteCard__titleRow">
                            <div className="noteCard__title">{note.title || deriveTitle(note.body)}</div>
                            <div className="noteCard__time">{formatUpdatedAt(note.updatedAt)}</div>
                          </div>
                          <div className="noteCard__preview">
                            {(note.body || "").trim() ? note.body.trim().slice(0, 160) : "No content"}
                          </div>
                        </div>

                        <div className="noteCard__actions" aria-label="Note actions">
                          <button
                            type="button"
                            className="iconBtn"
                            title="Delete note"
                            aria-label={`Delete note: ${note.title || "Untitled"}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNote(note.id);
                            }}
                          >
                            <span aria-hidden="true">🗑</span>
                          </button>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </main>

        <footer className="footer">
          <span className="footer__text">
            Data is stored in <code>localStorage</code> only (no backend).
          </span>
        </footer>
      </div>
    </div>
  );
}

export default App;
