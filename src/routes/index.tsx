import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

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
      if (!session.session) await supabase.auth.signInAnonymously();

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
      await supabase.from("profiles").upsert({
        id: userId,
        username,
        display_name: username,
      });
      navigate({ to: "/create" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create test profile.");
      setLoading(null);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 bg-background">
      <div className="w-full max-w-md text-center space-y-8">
        <div>
          <h1 className="text-5xl font-black tracking-tight">
            Blaze <span className="text-primary">City</span>
          </h1>
          <p className="mt-3 text-muted-foreground">
            A live room for the Blaze.stream community. Walk around, chat, hang out at the bar.
          </p>
        </div>

        <div className="space-y-3">
          <Button size="lg" className="w-full" onClick={signInWithBlaze} disabled={loading !== null}>
            {loading === "blaze" ? "Opening Blaze…" : "Sign in with Blaze"}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={useTestProfile}
            disabled={loading !== null}
          >
            {loading === "dev" ? "Setting up…" : "Skip · use a test profile"}
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
            {error}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Phase 1 preview · art & Blaze credentials are placeholders
        </p>
      </div>
    </main>
  );
}
