
-- profiles: restrict to own row, exclude anonymous sessions
DROP POLICY IF EXISTS "Authenticated can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  )
  WITH CHECK (
    auth.uid() = id
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

-- blaze_tokens: no client access; service role only (bypasses RLS)
CREATE POLICY "No client access to blaze_tokens"
  ON public.blaze_tokens FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- oauth_states: no client access; service role only (bypasses RLS)
CREATE POLICY "No client access to oauth_states"
  ON public.oauth_states FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);
