import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

const STORAGE_KEY = "simpleNotesApp.notes.v1";

/**
 * Helper: seed localStorage with an array of notes.
 * @param {Array<{id:string,title:string,body:string,updatedAt:number}>} notes
 */
function seedStorage(notes) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

/**
 * Helper: returns the note cards (the clickable card surface).
 * We intentionally target by test id to avoid ambiguity with the per-card delete button.
 */
function getNoteCards() {
  const list = screen.getByRole("list", { name: /existing notes/i });
  return within(list).getAllByTestId(/^note-card-/i);
}

beforeEach(() => {
  window.localStorage.clear();
  jest.restoreAllMocks();
});

describe("Notes app", () => {
  test("renders empty state when there are no notes", () => {
    render(<App />);

    // Primary heading exists.
    expect(screen.getByRole("heading", { level: 1, name: "Notes" })).toBeInTheDocument();

    // Empty state content.
    expect(screen.getByText(/start writing/i)).toBeInTheDocument();
    expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();

    // No list of existing notes is present.
    expect(screen.queryByRole("list", { name: /existing notes/i })).not.toBeInTheDocument();
  });

  test("creates a note and shows it in the list; selecting it loads it into the editor", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/^title$/i), "My first note");
    await user.type(screen.getByLabelText(/^note$/i), "Body text");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    // Now we should have an existing notes list with one item.
    const cards = getNoteCards();
    expect(cards).toHaveLength(1);
    expect(within(cards[0]).getByText("My first note")).toBeInTheDocument();
    expect(within(cards[0]).getByText(/body text/i)).toBeInTheDocument();

    // Editor reflects selected note.
    expect(screen.getByRole("button", { name: /^save$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^title$/i)).toHaveValue("My first note");
    expect(screen.getByLabelText(/^note$/i)).toHaveValue("Body text");
  });

  test("edits an existing note and persists the change in the list", async () => {
    const user = userEvent.setup();
    const now = Date.now();
    seedStorage([{ id: "n1", title: "Old title", body: "Old body", updatedAt: now }]);

    render(<App />);

    // Loads from storage and shows in list.
    expect(getNoteCards()).toHaveLength(1);
    expect(screen.getByLabelText(/^title$/i)).toHaveValue("Old title");
    expect(screen.getByLabelText(/^note$/i)).toHaveValue("Old body");

    // Edit and save.
    await user.clear(screen.getByLabelText(/^title$/i));
    await user.type(screen.getByLabelText(/^title$/i), "New title");
    await user.clear(screen.getByLabelText(/^note$/i));
    await user.type(screen.getByLabelText(/^note$/i), "New body");

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    const cards = getNoteCards();
    expect(within(cards[0]).getByText("New title")).toBeInTheDocument();
    expect(within(cards[0]).getByText(/new body/i)).toBeInTheDocument();
  });

  test('editing "cancel" behavior: clicking "New note" clears draft and does not change the existing note until saved', async () => {
    const user = userEvent.setup();
    const now = Date.now();
    seedStorage([{ id: "n1", title: "Stable title", body: "Stable body", updatedAt: now }]);

    render(<App />);

    // Confirm loaded note.
    expect(screen.getByLabelText(/^title$/i)).toHaveValue("Stable title");
    expect(screen.getByLabelText(/^note$/i)).toHaveValue("Stable body");

    // Start typing changes but do NOT save.
    await user.type(screen.getByLabelText(/^title$/i), " (draft)");
    await user.type(screen.getByLabelText(/^note$/i), " (draft)");

    // "Cancel" as implemented by app: click "New note" to leave editing context.
    await user.click(screen.getAllByRole("button", { name: /new note/i })[0]);

    // Draft cleared; button switches to Create mode.
    expect(screen.getByRole("button", { name: /^create$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^title$/i)).toHaveValue("");
    expect(screen.getByLabelText(/^note$/i)).toHaveValue("");

    // Existing note should remain unchanged in the list.
    const cards = getNoteCards();
    expect(within(cards[0]).getByText("Stable title")).toBeInTheDocument();
    expect(within(cards[0]).getByText(/stable body/i)).toBeInTheDocument();
  });

  test("deletes a note via the delete icon button", async () => {
    const user = userEvent.setup();
    seedStorage([
      { id: "n1", title: "Note A", body: "A", updatedAt: Date.now() },
      { id: "n2", title: "Note B", body: "B", updatedAt: Date.now() - 1000 },
    ]);

    render(<App />);

    expect(getNoteCards()).toHaveLength(2);

    // Click delete for "Note A".
    const deleteBtn = screen.getByRole("button", { name: /delete note:\s*note a/i });
    await user.click(deleteBtn);

    // Only one note remains.
    const cardsAfter = getNoteCards();
    expect(cardsAfter).toHaveLength(1);
    expect(within(cardsAfter[0]).getByText("Note B")).toBeInTheDocument();
  });

  test("does not prompt for confirmation when deleting (no confirm UI implemented)", async () => {
    const user = userEvent.setup();
    seedStorage([{ id: "n1", title: "No confirm", body: "x", updatedAt: Date.now() }]);

    // If confirm was used, this would be called.
    const confirmSpy = jest.spyOn(window, "confirm").mockImplementation(() => true);

    render(<App />);
    await user.click(screen.getByRole("button", { name: /delete note:\s*no confirm/i }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole("list", { name: /existing notes/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();
  });

  test("loads notes from localStorage on start", () => {
    seedStorage([{ id: "n1", title: "From storage", body: "Loaded", updatedAt: Date.now() }]);

    render(<App />);

    const cards = getNoteCards();
    expect(cards).toHaveLength(1);
    expect(within(cards[0]).getByText("From storage")).toBeInTheDocument();
  });

  test("saves notes to localStorage when notes change (create + edit + delete)", async () => {
    const user = userEvent.setup();
    const setItemSpy = jest.spyOn(window.localStorage.__proto__, "setItem");

    render(<App />);

    // Create triggers persistence.
    await user.type(screen.getByLabelText(/^title$/i), "Persist me");
    await user.type(screen.getByLabelText(/^note$/i), "One");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    // Wait for the effect-driven save to land, then assert against the *latest* write.
    await waitFor(() => {
      const writes = setItemSpy.mock.calls.filter((c) => c[0] === STORAGE_KEY);
      expect(writes.length).toBeGreaterThan(0);
      const last = writes.at(-1);
      const stored = JSON.parse(last[1]);
      expect(stored).toHaveLength(1);
      expect(stored[0].title).toBe("Persist me");
    });

    // Edit triggers persistence.
    await user.clear(screen.getByLabelText(/^note$/i));
    await user.type(screen.getByLabelText(/^note$/i), "Two");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      const lastStorageWrite = setItemSpy.mock.calls.filter((c) => c[0] === STORAGE_KEY).at(-1);
      const editedStored = JSON.parse(lastStorageWrite[1]);
      expect(editedStored).toHaveLength(1);
      expect(editedStored[0].body).toBe("Two");
    });

    // Delete triggers persistence.
    await user.click(screen.getByRole("button", { name: /delete note:\s*persist me/i }));

    await waitFor(() => {
      const afterDeleteWrite = setItemSpy.mock.calls.filter((c) => c[0] === STORAGE_KEY).at(-1);
      const deletedStored = JSON.parse(afterDeleteWrite[1]);
      expect(deletedStored).toHaveLength(0);
    });
  });
});
