import { useState, useEffect, useCallback } from "react";
import { Shell } from "./components/Shell";

// ── Types ──────────────────────────────────────────────────────────────

interface Card {
  id: string;
  front: string;
  back: string;
}

interface Deck {
  id: string;
  name: string;
  cards: Card[];
  lastStudied: number | null;
}

type View =
  | { kind: "decks" }
  | { kind: "deck"; deckId: string }
  | { kind: "study"; deckId: string }
  | { kind: "editCard"; deckId: string; cardId: string | null };

// ── Persistence ────────────────────────────────────────────────────────

const STORAGE_KEY = "flashcards_decks";

function loadDecks(): Deck[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Deck[]) : [];
  } catch {
    return [];
  }
}

function saveDecks(decks: Deck[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
}

function uid(): string {
  return crypto.randomUUID();
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  )
    return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// ── Styles ─────────────────────────────────────────────────────────────

const btnBase: React.CSSProperties = {
  border: "none",
  borderRadius: "var(--radius-btn)",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "0.875rem",
  transition: "opacity 0.15s",
};

const btnAccent: React.CSSProperties = {
  ...btnBase,
  background: "var(--color-accent)",
  color: "#fff",
  padding: "0.5rem 1rem",
};

const btnMuted: React.CSSProperties = {
  ...btnBase,
  background: "var(--color-panel)",
  color: "var(--color-ink)",
  padding: "0.5rem 1rem",
  border: "1px solid var(--color-line)",
};

const btnSuccess: React.CSSProperties = {
  ...btnBase,
  background: "#22c55e",
  color: "#fff",
  padding: "0.5rem 1.25rem",
};

const btnDanger: React.CSSProperties = {
  ...btnBase,
  background: "#ef4444",
  color: "#fff",
  padding: "0.5rem 1.25rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.625rem 0.75rem",
  borderRadius: "var(--radius-btn)",
  border: "1px solid var(--color-line)",
  background: "var(--color-paper)",
  color: "var(--color-ink)",
  fontSize: "0.9375rem",
  fontFamily: "var(--font-body)",
  outline: "none",
};

const panelStyle: React.CSSProperties = {
  background: "var(--color-panel)",
  borderRadius: "var(--radius-card)",
  border: "1px solid var(--color-line)",
};

// ── Flip CSS (injected once) ───────────────────────────────────────────

const flipCSS = `
.fc-scene { perspective: 800px; }
.fc-card {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  transform-style: preserve-3d;
}
.fc-card.flipped { transform: rotateY(180deg); }
.fc-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  font-size: 1.25rem;
  overflow: auto;
  word-break: break-word;
}
.fc-back { transform: rotateY(180deg); }
`;

// ── App ────────────────────────────────────────────────────────────────

export function App() {
  const [decks, setDecks] = useState<Deck[]>(loadDecks);
  const [view, setView] = useState<View>({ kind: "decks" });

  useEffect(() => {
    saveDecks(decks);
  }, [decks]);

  const navigate = useCallback((v: View) => setView(v), []);

  const updateDeck = useCallback(
    (deckId: string, fn: (d: Deck) => Deck) => {
      setDecks((prev) => prev.map((d) => (d.id === deckId ? fn(d) : d)));
    },
    [],
  );

  const deleteDeck = useCallback((deckId: string) => {
    setDecks((prev) => prev.filter((d) => d.id !== deckId));
    setView({ kind: "decks" });
  }, []);

  const markStudied = useCallback((deckId: string) => {
    setDecks((prev) =>
      prev.map((d) => (d.id === deckId ? { ...d, lastStudied: Date.now() } : d)),
    );
  }, []);

  // ── Render views ───────────────────────────────────────────────────

  let content: React.ReactNode;

  if (view.kind === "decks") {
    content = (
      <DeckListView
        decks={decks}
        onNavigate={navigate}
        onCreate={(name) => {
          const deck: Deck = { id: uid(), name, cards: [], lastStudied: null };
          setDecks((prev) => [...prev, deck]);
          navigate({ kind: "deck", deckId: deck.id });
        }}
      />
    );
  } else if (view.kind === "deck") {
    const deck = decks.find((d) => d.id === view.deckId);
    if (!deck) {
      content = <EmptyState message="Deck not found." onBack={() => navigate({ kind: "decks" })} />;
    } else {
      content = (
        <DeckDetailView
          deck={deck}
          onNavigate={navigate}
          onUpdate={(fn) => updateDeck(deck.id, fn)}
          onDelete={() => deleteDeck(deck.id)}
        />
      );
    }
  } else if (view.kind === "study") {
    const deck = decks.find((d) => d.id === view.deckId);
    if (!deck || deck.cards.length === 0) {
      content = <EmptyState message="No cards to study." onBack={() => navigate({ kind: "decks" })} />;
    } else {
      content = (
        <StudyView
          deck={deck}
          onBack={() => navigate({ kind: "deck", deckId: view.deckId })}
          onComplete={() => markStudied(view.deckId)}
        />
      );
    }
  } else {
    const deck = decks.find((d) => d.id === view.deckId);
    if (!deck) {
      content = <EmptyState message="Deck not found." onBack={() => navigate({ kind: "decks" })} />;
    } else {
      content = (
        <EditCardView
          deck={deck}
          cardId={view.cardId}
          onNavigate={navigate}
          onUpdate={(fn) => updateDeck(deck.id, fn)}
        />
      );
    }
  }

  return (
    <Shell>
      <style>{flipCSS}</style>
      {content}
    </Shell>
  );
}

// ── DeckListView ───────────────────────────────────────────────────────

function DeckListView({
  decks,
  onNavigate,
  onCreate,
}: {
  decks: Deck[];
  onNavigate: (v: View) => void;
  onCreate: (name: string) => void;
}) {
  const [newName, setNewName] = useState("");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: "var(--font-display)" }}>
        Your Decks
      </h1>

      <form
        className="flex gap-2 mb-6"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = newName.trim();
          if (trimmed) {
            onCreate(trimmed);
            setNewName("");
          }
        }}
      >
        <input
          style={inputStyle}
          placeholder="New deck name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" style={btnAccent}>
          Create
        </button>
      </form>

      {decks.length === 0 ? (
        <p style={{ color: "var(--color-muted)" }}>
          No decks yet. Create one above to get started.
        </p>
      ) : (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))" }}
        >
          {decks.map((deck) => (
            <button
              key={deck.id}
              className="text-left p-4 hover:opacity-80 transition-opacity"
              style={panelStyle}
              onClick={() => onNavigate({ kind: "deck", deckId: deck.id })}
            >
              <div className="font-semibold mb-1" style={{ color: "var(--color-ink)" }}>
                {deck.name}
              </div>
              <div className="text-sm" style={{ color: "var(--color-muted)" }}>
                {deck.cards.length} {deck.cards.length === 1 ? "card" : "cards"}
              </div>
              {deck.lastStudied !== null && (
                <div className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
                  Studied {formatDate(deck.lastStudied)}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── DeckDetailView ─────────────────────────────────────────────────────

function DeckDetailView({
  deck,
  onNavigate,
  onUpdate,
  onDelete,
}: {
  deck: Deck;
  onNavigate: (v: View) => void;
  onUpdate: (fn: (d: Deck) => Deck) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(deck.name);
  const [confirming, setConfirming] = useState(false);

  return (
    <div>
      <button
        className="text-sm mb-4 hover:underline"
        style={{ color: "var(--color-accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        onClick={() => onNavigate({ kind: "decks" })}
      >
        &larr; All Decks
      </button>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {editing ? (
          <form
            className="flex gap-2 items-center"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = editName.trim();
              if (trimmed) {
                onUpdate((d) => ({ ...d, name: trimmed }));
                setEditing(false);
              }
            }}
          >
            <input
              style={{ ...inputStyle, width: "auto" }}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
            />
            <button type="submit" style={btnAccent}>Save</button>
            <button
              type="button"
              style={btnMuted}
              onClick={() => { setEditing(false); setEditName(deck.name); }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
              {deck.name}
            </h1>
            <button
              style={{ ...btnMuted, padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
              onClick={() => setEditing(true)}
            >
              Rename
            </button>
          </>
        )}
      </div>

      {deck.lastStudied !== null && (
        <p className="text-sm mb-4" style={{ color: "var(--color-muted)" }}>
          Last studied: {formatDate(deck.lastStudied)}
        </p>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          style={btnAccent}
          onClick={() => onNavigate({ kind: "editCard", deckId: deck.id, cardId: null })}
        >
          + Add Card
        </button>
        {deck.cards.length > 0 && (
          <button
            style={btnSuccess}
            onClick={() => onNavigate({ kind: "study", deckId: deck.id })}
          >
            Study
          </button>
        )}
        {confirming ? (
          <span className="flex gap-2 items-center">
            <span className="text-sm" style={{ color: "#ef4444" }}>Delete this deck?</span>
            <button style={btnDanger} onClick={onDelete}>Yes, delete</button>
            <button style={btnMuted} onClick={() => setConfirming(false)}>Cancel</button>
          </span>
        ) : (
          <button style={btnMuted} onClick={() => setConfirming(true)}>
            Delete Deck
          </button>
        )}
      </div>

      {deck.cards.length === 0 ? (
        <p style={{ color: "var(--color-muted)" }}>
          No cards yet. Add one to start studying.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {deck.cards.map((card) => (
            <div
              key={card.id}
              className="flex items-center justify-between p-3"
              style={panelStyle}
            >
              <div className="flex-1 min-w-0 mr-3">
                <div className="font-medium truncate">{card.front}</div>
                <div className="text-sm truncate" style={{ color: "var(--color-muted)" }}>
                  {card.back}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  style={{ ...btnMuted, padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                  onClick={() =>
                    onNavigate({ kind: "editCard", deckId: deck.id, cardId: card.id })
                  }
                >
                  Edit
                </button>
                <button
                  style={{ ...btnMuted, padding: "0.25rem 0.5rem", fontSize: "0.75rem", color: "#ef4444" }}
                  onClick={() =>
                    onUpdate((d) => ({
                      ...d,
                      cards: d.cards.filter((c) => c.id !== card.id),
                    }))
                  }
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── EditCardView ───────────────────────────────────────────────────────

function EditCardView({
  deck,
  cardId,
  onNavigate,
  onUpdate,
}: {
  deck: Deck;
  cardId: string | null;
  onNavigate: (v: View) => void;
  onUpdate: (fn: (d: Deck) => Deck) => void;
}) {
  const existing = cardId ? deck.cards.find((c) => c.id === cardId) : undefined;
  const [front, setFront] = useState(existing?.front ?? "");
  const [back, setBack] = useState(existing?.back ?? "");

  const isNew = !cardId;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedFront = front.trim();
    const trimmedBack = back.trim();
    if (!trimmedFront || !trimmedBack) return;

    if (isNew) {
      const card: Card = { id: uid(), front: trimmedFront, back: trimmedBack };
      onUpdate((d) => ({ ...d, cards: [...d.cards, card] }));
    } else {
      onUpdate((d) => ({
        ...d,
        cards: d.cards.map((c) =>
          c.id === cardId ? { ...c, front: trimmedFront, back: trimmedBack } : c,
        ),
      }));
    }
    onNavigate({ kind: "deck", deckId: deck.id });
  }

  return (
    <div>
      <button
        className="text-sm mb-4 hover:underline"
        style={{ color: "var(--color-accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        onClick={() => onNavigate({ kind: "deck", deckId: deck.id })}
      >
        &larr; {deck.name}
      </button>

      <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: "var(--font-display)" }}>
        {isNew ? "Add Card" : "Edit Card"}
      </h1>

      <form className="flex flex-col gap-4 max-w-lg" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Front</span>
          <textarea
            style={{ ...inputStyle, minHeight: "5rem", resize: "vertical" }}
            placeholder="Question or prompt..."
            value={front}
            onChange={(e) => setFront(e.target.value)}
            autoFocus
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Back</span>
          <textarea
            style={{ ...inputStyle, minHeight: "5rem", resize: "vertical" }}
            placeholder="Answer..."
            value={back}
            onChange={(e) => setBack(e.target.value)}
          />
        </label>
        <div className="flex gap-2">
          <button type="submit" style={btnAccent}>
            {isNew ? "Add Card" : "Save Changes"}
          </button>
          <button
            type="button"
            style={btnMuted}
            onClick={() => onNavigate({ kind: "deck", deckId: deck.id })}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ── StudyView ──────────────────────────────────────────────────────────

function StudyView({
  deck,
  onBack,
  onComplete,
}: {
  deck: Deck;
  onBack: () => void;
  onComplete: () => void;
}) {
  const [queue, setQueue] = useState<Card[]>(() => shuffle([...deck.cards]));
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [completed, setCompleted] = useState(0);

  const current = queue[0];

  function handleGotIt() {
    setFlipped(false);
    const next = queue.slice(1);
    setCompleted((c) => c + 1);
    if (next.length === 0) {
      setDone(true);
      onComplete();
    } else {
      setQueue(next);
    }
  }

  function handleAgain() {
    setFlipped(false);
    if (queue.length === 1) {
      setQueue([...queue]);
    } else {
      const rest = queue.slice(1);
      const insertAt = Math.max(
        1,
        Math.floor(rest.length / 2) + Math.floor(Math.random() * Math.ceil(rest.length / 2)),
      );
      const newQueue = [...rest];
      newQueue.splice(insertAt, 0, queue[0]!);
      setQueue(newQueue);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: "50vh" }}>
        <div
          className="text-4xl font-bold mb-4"
          style={{ fontFamily: "var(--font-display)", color: "#22c55e" }}
        >
          All done!
        </div>
        <p className="mb-6" style={{ color: "var(--color-muted)" }}>
          You reviewed all {deck.cards.length} cards in {deck.name}.
        </p>
        <div className="flex gap-2">
          <button
            style={btnAccent}
            onClick={() => {
              setQueue(shuffle([...deck.cards]));
              setFlipped(false);
              setDone(false);
              setCompleted(0);
            }}
          >
            Study Again
          </button>
          <button style={btnMuted} onClick={onBack}>
            Back to Deck
          </button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const total = completed + queue.length;

  return (
    <div>
      <button
        className="text-sm mb-4 hover:underline"
        style={{ color: "var(--color-accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        onClick={onBack}
      >
        &larr; {deck.name}
      </button>

      <div className="flex items-center justify-between mb-4">
        <span className="text-sm" style={{ color: "var(--color-muted)" }}>
          {completed + 1} / {total}
        </span>
        <span className="text-sm" style={{ color: "var(--color-muted)" }}>
          {queue.length} remaining
        </span>
      </div>

      <div
        className="mb-6"
        style={{
          height: "4px",
          borderRadius: "2px",
          background: "var(--color-line)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(completed / total) * 100}%`,
            background: "var(--color-accent)",
            borderRadius: "2px",
            transition: "width 0.3s",
          }}
        />
      </div>

      <div
        className="fc-scene mx-auto mb-6 cursor-pointer"
        style={{ maxWidth: "28rem", height: "18rem" }}
        onClick={() => !flipped && setFlipped(true)}
      >
        <div className={`fc-card ${flipped ? "flipped" : ""}`}>
          <div className="fc-face" style={panelStyle}>
            <div>
              <div
                className="text-xs mb-2 uppercase tracking-wide"
                style={{ color: "var(--color-muted)" }}
              >
                Front
              </div>
              {current.front}
            </div>
          </div>
          <div className="fc-face fc-back" style={panelStyle}>
            <div>
              <div
                className="text-xs mb-2 uppercase tracking-wide"
                style={{ color: "var(--color-muted)" }}
              >
                Back
              </div>
              {current.back}
            </div>
          </div>
        </div>
      </div>

      {!flipped ? (
        <div className="text-center">
          <button style={btnAccent} onClick={() => setFlipped(true)}>
            Tap to Reveal
          </button>
        </div>
      ) : (
        <div className="flex justify-center gap-3">
          <button style={btnDanger} onClick={handleAgain}>
            Again
          </button>
          <button style={btnSuccess} onClick={handleGotIt}>
            Got it
          </button>
        </div>
      )}
    </div>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────────

function EmptyState({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: "40vh" }}>
      <p className="mb-4" style={{ color: "var(--color-muted)" }}>{message}</p>
      <button style={btnAccent} onClick={onBack}>
        Go Back
      </button>
    </div>
  );
}
