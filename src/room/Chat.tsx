import { useEffect, useRef, useState } from "react";

export interface ChatMessage {
  id: string;
  username: string;
  text: string;
  ts: number;
}

interface Props {
  messages: ChatMessage[];
  onSend: (text: string) => void;
}

export function Chat({ messages, onSend }: Props) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border" style={{ background: "var(--chat-surface)" }}>
      <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Room chat
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2 text-sm">
        {messages.length === 0 && (
          <p className="text-muted-foreground italic">Say hi — nobody's talking yet.</p>
        )}
        {messages.map((m) => (
          <div key={m.id}>
            <span className="font-semibold text-accent">{m.username}</span>{" "}
            <span>{m.text}</span>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-border p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message the room…"
          className="flex-1 rounded-lg bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          maxLength={280}
        />
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Send
        </button>
      </form>
    </div>
  );
}
