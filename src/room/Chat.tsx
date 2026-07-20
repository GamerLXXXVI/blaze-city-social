import { useEffect, useRef, useState } from "react";

export interface ChatMessage {
  id: string;
  username: string;
  text: string;
  ts: number;
  senderId?: string;
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
    <div className="hud-panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[color:var(--glass-border)] px-4 py-3">
        <span className="font-mono-display text-[11px] uppercase tracking-[0.2em] text-primary/90">
          // room chat
        </span>
        <span className="hud-chip px-2 py-0.5 text-muted-foreground">live</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2 text-sm">
        {messages.length === 0 && (
          <p className="text-muted-foreground italic">The room's quiet. Say something.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="leading-relaxed">
            <span className="font-semibold text-ember">{m.username}</span>
            <span className="text-muted-foreground/60"> › </span>
            <span className="text-foreground/90">{m.text}</span>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-[color:var(--glass-border)] p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message the room…"
          className="flex-1 rounded-lg bg-input/60 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring"
          maxLength={280}
        />
        <button
          type="submit"
          className="btn-ember rounded-lg px-4 py-2 text-sm hover:brightness-110 active:scale-[0.98]"
        >
          Send
        </button>
      </form>
    </div>
  );
}
