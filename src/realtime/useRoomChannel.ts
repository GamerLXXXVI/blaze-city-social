import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AvatarConfig, Direction, Facing } from "@/avatar/types";
import type { RemotePlayer } from "@/room/Room";
import type { ChatMessage } from "@/room/Chat";

export interface LocalPresence {
  id: string;
  username: string;
  config: AvatarConfig;
  x: number;
  y: number;
  direction: Direction;
  facing: Facing;
  state: "idle" | "walk" | "dance" | "sit";
}

export function useRoomChannel(roomId: string, initial: LocalPresence | null) {
  const [players, setPlayers] = useState<RemotePlayer[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const presenceRef = useRef<LocalPresence | null>(initial);
  const pendingRef = useRef(false);
  const lastSentAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Supabase Realtime enforces a client-presence rate limit (~10/s). Movement
  // ticks fire far more often than that, so we throttle track() to ~5/s and
  // coalesce the latest presenceRef state into a single trailing send.
  const MIN_INTERVAL_MS = 200;

  const flushTrack = () => {
    const ch = channelRef.current;
    if (!ch || !presenceRef.current) return;
    pendingRef.current = false;
    lastSentAtRef.current = Date.now();
    void ch.track(presenceRef.current);
  };

  const scheduleTrack = () => {
    if (pendingRef.current) return;
    const elapsed = Date.now() - lastSentAtRef.current;
    if (elapsed >= MIN_INTERVAL_MS) {
      flushTrack();
      return;
    }
    pendingRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flushTrack, MIN_INTERVAL_MS - elapsed);
  };

  useEffect(() => {
    if (!initial) return;
    presenceRef.current = initial;

    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: initial.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<LocalPresence>();
        const list: RemotePlayer[] = [];
        for (const key of Object.keys(state)) {
          const metas = state[key];
          const m = metas[metas.length - 1];
          if (!m) continue;
          list.push({
            id: m.id,
            username: m.username,
            config: m.config,
            x: m.x,
            y: m.y,
            direction: m.direction,
            facing: m.facing,
            state: m.state,
          });
        }
        setPlayers(list);
      })
      .on("broadcast", { event: "chat" }, ({ payload }) => {
        setMessages((prev) => [...prev.slice(-99), payload as ChatMessage]);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && presenceRef.current) {
          lastSentAtRef.current = Date.now();
          await channel.track(presenceRef.current);
        }
      });

    channelRef.current = channel;
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      pendingRef.current = false;
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, initial?.id]);

  const updatePresence = useCallback((partial: Partial<LocalPresence>) => {
    const ch = channelRef.current;
    if (!ch || !presenceRef.current) return;
    presenceRef.current = { ...presenceRef.current, ...partial };
    scheduleTrack();
  }, []);

  const sendChat = useCallback((text: string) => {
    const ch = channelRef.current;
    if (!ch || !presenceRef.current) return;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      username: presenceRef.current.username,
      text,
      ts: Date.now(),
      senderId: presenceRef.current.id,
    };
    void ch.send({ type: "broadcast", event: "chat", payload: msg });
    setMessages((prev) => [...prev.slice(-99), msg]);
  }, []);

  return { players, messages, updatePresence, sendChat };
}
