import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  component: Callback,
});

function Callback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      if (!code || !state) {
        setError("Missing OAuth parameters.");
        return;
      }
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user.id) {
        setError("No local session; please return to sign-in.");
        return;
      }
      const res = await supabase.functions.invoke("blaze-callback", {
        body: { code, state },
      });
      if (res.error) {
        setError(res.error.message);
        return;
      }
      navigate({ to: "/create" });
    })();
  }, [navigate]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
      {error ? (
        <div className="max-w-sm rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="font-semibold">Sign-in failed</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <a href="/" className="mt-4 inline-block text-primary underline">Back to sign-in</a>
        </div>
      ) : (
        <p className="text-muted-foreground">Finishing sign-in…</p>
      )}
    </main>
  );
}
