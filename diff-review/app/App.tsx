import { useCallback, useEffect, useRef, useState } from "react";
import {
  getDiff,
  postQuestion,
  postChangeRequest,
  deleteChangeRequest,
  getAnswers,
  getNotifications,
  submit,
  finish,
  DiffResponse,
  ChangeRequest,
} from "./api";
import { Question, Selection } from "./types";
import DiffView from "./components/DiffView";
import SelectionPopover from "./components/SelectionPopover";
import Thread from "./components/Thread";
import SubmitBar from "./components/SubmitBar";
import Logo from "./components/Logo";
import {
  fireNotification,
  notificationPermission,
  notificationsSupported,
  requestNotificationPermission,
  summarize,
} from "./notify";

interface Anchor {
  file: string;
  side: "old" | "new";
  line: number;
}

export default function App() {
  const [data, setData] = useState<DiffResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    notificationPermission()
  );

  // Ref so interval callbacks always see the current diff without stale closure
  const dataRef = useRef<DiffResponse | null>(null);
  dataRef.current = data;

  // Drag-select state read inside mouse handlers without re-creating them
  const draggingRef = useRef(false);
  // Notification poll cursor + one-shot "session started" guard
  const notifyCursorRef = useRef(0);
  const announcedRef = useRef(false);

  useEffect(() => {
    getDiff()
      .then(setData)
      .catch((err: unknown) => setError(String(err)));
  }, []);

  // Ask for desktop-notification permission once on load.
  useEffect(() => {
    void requestNotificationPermission().then(setNotifPerm);
  }, []);

  // Fire a "session started" notification once the diff is loaded and we have
  // permission (covers both already-granted and just-granted cases).
  useEffect(() => {
    if (announcedRef.current || !data || notifPerm !== "granted") return;
    announcedRef.current = true;
    const n = data.files.length;
    fireNotification("PRISM diff-review — session started", {
      body: `Reviewing ${n} file${n !== 1 ? "s" : ""}${
        data.baseRef ? ` vs ${data.baseRef}` : ""
      }.`,
      tag: "prism-session",
      force: true,
    });
  }, [data, notifPerm]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelection(null);
        setAnchor(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleLineMouseDown = useCallback(
    (file: string, side: "old" | "new", line: number, shiftKey: boolean) => {
      if (shiftKey && anchor && anchor.file === file && anchor.side === side) {
        // Shift-click extends the existing range from the anchor.
        setSelection({
          file,
          side,
          startLine: Math.min(anchor.line, line),
          endLine: Math.max(anchor.line, line),
        });
      } else {
        // Plain press starts a new selection (and begins a possible drag).
        setAnchor({ file, side, line });
        setSelection({ file, side, startLine: line, endLine: line });
      }
      draggingRef.current = true;
      setDragging(true);
    },
    [anchor]
  );

  // Drag across lines to bulk-highlight a block (extends from the anchor).
  const handleLineEnter = useCallback(
    (file: string, side: "old" | "new", line: number) => {
      if (!draggingRef.current || !anchor) return;
      if (anchor.file !== file || anchor.side !== side) return;
      setSelection({
        file,
        side,
        startLine: Math.min(anchor.line, line),
        endLine: Math.max(anchor.line, line),
      });
    },
    [anchor]
  );

  // End any in-progress drag wherever the mouse is released.
  useEffect(() => {
    const onUp = () => {
      draggingRef.current = false;
      setDragging(false);
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setAnchor(null);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleAsk = useCallback(
    async (text: string) => {
      if (!selection) return;
      setBusy(true);
      try {
        const { id } = await postQuestion({ ...selection, text });
        setQuestions((prev) => [
          ...prev,
          { id, ...selection, text, status: "pending" as const },
        ]);
        showToast("asked ✓");
        clearSelection();
      } finally {
        setBusy(false);
      }
    },
    [selection, clearSelection]
  );

  const handleRequest = useCallback(
    async (text: string) => {
      if (!selection) return;
      setBusy(true);
      try {
        const { id } = await postChangeRequest({ ...selection, text });
        setChangeRequests((prev) => [...prev, { id, ...selection, text }]);
        showToast("queued ✓");
        clearSelection();
      } finally {
        setBusy(false);
      }
    },
    [selection, clearSelection]
  );

  const handleRemove = useCallback(async (id: number) => {
    await deleteChangeRequest(id);
    setChangeRequests((prev) => prev.filter((cr) => cr.id !== id));
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    await submit();
    // Queue stays visible and greyed via submitting flag until round bumps and clears it
  }, []);

  const handleFinish = useCallback(async () => {
    await finish();
    // Server will exit; poll-failure handler shows the ended state
  }, []);

  // Live answers long-poll loop
  useEffect(() => {
    let mounted = true;
    let cursor = 0;
    let failures = 0;

    async function poll() {
      while (mounted) {
        try {
          const res = await getAnswers(cursor);
          failures = 0;
          if (res.answers.length > 0) {
            if (res.answers.length === 1) {
              fireNotification("Claude answered your question", {
                body: summarize(res.answers[0].markdown),
                tag: "prism-answer",
              });
            } else {
              fireNotification(`Claude answered ${res.answers.length} questions`, {
                tag: "prism-answer",
              });
            }
            setQuestions((prev) => {
              const next = [...prev];
              for (const answer of res.answers) {
                const idx = next.findIndex((q) => q.id === answer.questionId);
                if (idx !== -1) {
                  next[idx] = {
                    ...next[idx],
                    status: "answered",
                    answer: answer.markdown,
                  };
                }
              }
              return next;
            });
            cursor = res.cursor;
          }
        } catch {
          failures++;
          if (failures >= 3) {
            setSessionEnded(true);
            return;
          }
          await new Promise<void>((r) => setTimeout(r, 1000));
        }
      }
    }

    void poll();
    return () => {
      mounted = false;
    };
  }, []);

  // Round-refresh interval (decoupled from the answers channel)
  useEffect(() => {
    let failures = 0;
    const intervalId = setInterval(() => {
      void (async () => {
        try {
          const newDiff = await getDiff();
          failures = 0;
          const current = dataRef.current;
          if (current && newDiff.round > current.round) {
            setData(newDiff);
            setQuestions([]);
            setChangeRequests([]);
            setSelection(null);
            setAnchor(null);
            setSubmitting(false);
            showToast(`Round ${newDiff.round}`);
            fireNotification(`Round ${newDiff.round} ready`, {
              body: "Queued changes applied — diff refreshed.",
              tag: "prism-round",
            });
          }
        } catch {
          failures++;
          if (failures >= 3) {
            setSessionEnded(true);
            clearInterval(intervalId);
          }
        }
      })();
    }, 2000);

    return () => clearInterval(intervalId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Attention bridge: poll for notifications pushed by the Claude Code
  // Notification hook (permission prompts / idle waits) and surface them as
  // desktop notifications. Kept separate from the diff poll so its failures
  // never end the session.
  useEffect(() => {
    const intervalId = setInterval(() => {
      void (async () => {
        try {
          const res = await getNotifications(notifyCursorRef.current);
          if (res.notifications.length > 0) {
            for (const note of res.notifications) {
              fireNotification("Claude Code needs you", {
                body: note.message,
                tag: "prism-attention",
                force: true,
              });
            }
            notifyCursorRef.current = res.cursor;
          }
        } catch {
          /* server not up yet / shutting down — ignore */
        }
      })();
    }, 2000);
    return () => clearInterval(intervalId);
  }, []);

  if (sessionEnded) {
    return (
      <div className="session-ended-overlay">
        <div className="session-ended-banner">Review session ended.</div>
      </div>
    );
  }

  if (error) {
    return <p className="status-message error">Error: {error}</p>;
  }

  if (!data) {
    return <p className="status-message">Loading…</p>;
  }

  const baseLabel = data.baseRef ? `vs ${data.baseRef}` : "working tree";
  const fileCount = data.files.length;

  return (
    <div className="app">
      <header className="top-bar">
        <Logo />
        <span className="top-bar-title">
          PRISM <span className="top-bar-sub">diff-review</span>
        </span>
        <span className="top-bar-meta">
          {baseLabel} · round {data.round} · {fileCount} file
          {fileCount !== 1 ? "s" : ""}
        </span>
        {notificationsSupported() && notifPerm !== "granted" && (
          <button
            className="notif-enable"
            onClick={() => {
              void requestNotificationPermission().then(setNotifPerm);
            }}
            title="Enable desktop notifications for answers, new rounds, and permission prompts"
          >
            🔔 Enable alerts
          </button>
        )}
      </header>
      <div className="main">
        <div className={`diff-pane${dragging ? " dragging" : ""}`}>
          <DiffView
            files={data.files}
            selection={selection}
            onLineMouseDown={handleLineMouseDown}
            onLineEnter={handleLineEnter}
          />
        </div>
        <aside className="sidebar">
          <section className="sidebar-section">
            <div className="sidebar-section-title">Conversation</div>
            {questions.length === 0 ? (
              <div className="sidebar-empty">
                Select lines and ask a question to start a thread.
              </div>
            ) : (
              questions.map((q) => <Thread key={q.id} question={q} />)
            )}
          </section>
          <SubmitBar
            changeRequests={changeRequests}
            submitting={submitting}
            onRemove={handleRemove}
            onSubmit={handleSubmit}
            onFinish={handleFinish}
          />
        </aside>
      </div>
      {selection && (
        <SelectionPopover
          selection={selection}
          onAsk={handleAsk}
          onRequest={handleRequest}
          onCancel={clearSelection}
          busy={busy}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
