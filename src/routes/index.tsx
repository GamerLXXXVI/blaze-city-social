import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { upsertOwnProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/")({
  component: Login,
});

function randomHandle() {
  const adj = ["Neon", "Blaze", "Pixel", "Turbo", "Groovy", "Chill", "Vivid", "Wild"];
  const noun = ["Fox", "Panda", "Vibe", "Ghost", "Comet", "Owl", "Wave", "Nova"];
  return `${adj[Math.floor(Math.random() * adj.length)]}${noun[Math.floor(Math.random() * noun.length)]}${Math.floor(Math.random() * 90 + 10)}`;
}

function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<"blaze" | "dev" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signInWithBlaze = async () => {
    setError(null);
    setLoading("blaze");
    try {
      // Ensure we have a supabase user (anon) so callback can bind tokens to us
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        const { error: anonErr } = await supabase.auth.signInAnonymously();
        if (anonErr) {
          setError(
            `Couldn't start a local session (${anonErr.message}). Anonymous sign-in must be enabled for Blaze login to work. Try the dev shortcut below, or ask an admin to enable anonymous sign-ins.`,
          );
          return;
        }
      }

      const res = await supabase.functions.invoke("blaze-auth-url", { body: {} });
      if (res.error) throw new Error(res.error.message);
      const data = res.data as { authUrl?: string; error?: string; message?: string };
      if (data.error === "not_configured") {
        setError(
          "Blaze sign-in isn't wired up in this environment yet. Use the dev shortcut below to explore Blaze City.",
        );
        return;
      }
      if (!data.authUrl) {
        setError(data.message ?? "Couldn't start Blaze sign-in. Try again in a moment.");
        return;
      }
      window.location.href = data.authUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong starting Blaze sign-in.");
    } finally {
      setLoading(null);
    }
  };

  const useTestProfile = async () => {
    setLoading("dev");
    try {
      const { data } = await supabase.auth.getSession();
      let userId = data.session?.user.id;
      if (!userId) {
        const { data: signIn, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        userId = signIn.user!.id;
      }
      const username = randomHandle();
      await upsertOwnProfile({ data: { username, displayName: username } });
      navigate({ to: "/create" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create test profile.");
      setLoading(null);
    }
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center px-6 py-16 overflow-hidden">
      {/* backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, rgba(240,185,11,0.18), transparent 55%), radial-gradient(ellipse at 75% 80%, rgba(194,65,12,0.22), transparent 60%), #14110D",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <div className="hud-panel relative w-full max-w-md p-8 text-center space-y-8">
        <div>
          <p className="font-mono-display text-[11px] uppercase tracking-[0.3em] text-primary/80">
            // blaze.stream // room 001
          </p>
          <h1 className="mt-3 text-6xl font-extrabold tracking-tight leading-none">
            Blaze <span className="text-ember">City</span>
          </h1>
          <p className="mt-4 text-muted-foreground">
            A live room for the Blaze community. Walk around, chat,
            hang at the bar, burn on the dance floor.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full btn-ember hover:brightness-110"
            onClick={signInWithBlaze}
            disabled={loading !== null}
          >
            {loading === "blaze" ? "Opening Blaze…" : "Sign in with Blaze"}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full border-[color:var(--glass-border)] bg-transparent hover:bg-white/5"
            onClick={useTestProfile}
            disabled={loading !== null}
          >
            {loading === "dev" ? "Setting up…" : "Skip · use a test profile"}
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-left text-sm text-destructive-foreground">
            {error}
          </div>
        )}

        <p className="font-mono-display text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70">
          Phase 1 preview · art & credentials are placeholders
        </p>
      </div>
    </main>
  );
}
