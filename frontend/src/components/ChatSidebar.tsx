import { useEffect, useRef, useState, type FormEvent } from "react";
import clsx from "clsx";
import type { BoardData } from "@/lib/kanban";
import { sendChat, type ChatMessage } from "@/lib/api";

type ChatSidebarProps = {
  onBoardUpdate: (board: BoardData) => void;
};

export const ChatSidebar = ({ onBoardUpdate }: ChatSidebarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || isSending) {
      return;
    }
    const history = messages;
    setMessages([...history, { role: "user", content: message }]);
    setInput("");
    setError("");
    setIsSending(true);
    try {
      const result = await sendChat(message, history);
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
      if (result.board_updated) {
        onBoardUpdate(result.board);
      }
    } catch {
      setError("The AI is unavailable right now. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-20 rounded-full bg-[var(--secondary-purple)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow)] transition hover:brightness-110"
      >
        Ask AI
      </button>
    );
  }

  return (
    // Overlays the board on smaller screens; docks beside it (shrinking the board) on wide screens
    <aside
      aria-label="AI assistant"
      className="fixed right-0 top-0 z-20 flex h-screen w-full max-w-[380px] shrink-0 flex-col border-l border-[var(--stroke)] bg-white/95 shadow-[var(--shadow)] backdrop-blur 2xl:sticky 2xl:shadow-none"
    >
      <div className="flex items-start justify-between gap-3 border-b border-[var(--stroke)] px-6 py-5">
        <div>
          <div className="h-1 w-10 rounded-full bg-[var(--accent-yellow)]" />
          <h2 className="mt-3 font-display text-xl font-semibold text-[var(--navy-dark)]">
            AI Assistant
          </h2>
          <p className="mt-1 text-xs text-[var(--gray-text)]">
            Ask about your board, or ask it to add, edit, or move cards.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close assistant"
          className="rounded-full border border-[var(--stroke)] px-3 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
        >
          Close
        </button>
      </div>

      <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-5">
        {messages.length === 0 && (
          <p className="mt-6 text-center text-sm leading-6 text-[var(--gray-text)]">
            Try &quot;Add a card to Review called Write release notes&quot; or &quot;What is
            in progress?&quot;
          </p>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            data-testid={`chat-${message.role}`}
            className={clsx(
              "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6",
              message.role === "user"
                ? "self-end bg-[var(--secondary-purple)] text-white"
                : "self-start border border-[var(--stroke)] bg-[var(--surface)] text-[var(--navy-dark)]"
            )}
          >
            {message.content}
          </div>
        ))}
        {isSending && (
          <div className="self-start rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--gray-text)]">
            Thinking...
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-[var(--stroke)] px-6 py-4">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          aria-label="Message"
          placeholder="Ask the assistant..."
          className="min-w-0 flex-1 rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
        />
        <button
          type="submit"
          disabled={isSending || !input.trim()}
          className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </aside>
  );
};
