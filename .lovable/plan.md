# Blaze City — Phase 1 Plan

Single-room social demo. End-to-end loop: login (or dev skip) → build avatar → walk in a room → see others move → chat. Placeholder art and stubbed Blaze credentials; everything swappable later.

## 1. Backend (Lovable Cloud / Supabase)

Enable Lovable Cloud. Add three Edge Functions under `supabase/functions/`:

- `blaze-auth-url` — POSTs to `https://blaze.stream/bapi/oauth2/generate-auth-url`, returns `{ authUrl, state, codeVerifier }`. Persists `state → codeVerifier` in a short-lived `oauth_states` table (5-min TTL). Reads `BLAZE_CLIENT_ID`, `BLAZE_CLIENT_SECRET`, `BLAZE_REDIRECT_URI` from secrets; returns a clean `{ error: "not_configured" }` if any are placeholders/missing.
- `blaze-callback` — Validates `state`, exchanges `code + codeVerifier` at `https://blaze.stream/bapi/oauth2/token`. Stores tokens in `blaze_tokens` table keyed by Supabase user id (created via a signInAnonymously-linked profile). Never returns tokens to the client — returns only success + profile info.
- `blaze-me` — Uses stored access token to GET `https://api.blaze.stream/v1/users/profile`, returns `{ userId, username, displayName, avatarUrl }`.

Tables (with GRANTs + RLS):
- `oauth_states(state pk, code_verifier, created_at)` — service_role only.
- `blaze_tokens(user_id pk fk auth.users, access_token, refresh_token, expires_at)` — service_role only.
- `profiles(id pk fk auth.users, blaze_user_id, username, display_name, avatar_url, avatar_config jsonb, created_at)` — user reads/updates own; authenticated can select public columns for presence display.

Secrets required (placeholders acceptable now): `BLAZE_CLIENT_ID`, `BLAZE_CLIENT_SECRET`, `BLAZE_REDIRECT_URI`.

## 2. Frontend structure

- `src/routes/index.tsx` — Login screen. "Sign in with Blaze" (calls `blaze-auth-url`, redirects). "Skip login / Use test profile" button creates an anonymous Supabase session + random dev profile, routes to `/create` or `/room`.
- `src/routes/auth.callback.tsx` — Handles `?code&state`, calls `blaze-callback`, then routes to avatar creator or room.
- `src/routes/create.tsx` — Avatar creator (single screen, steppers).
- `src/routes/room.tsx` — Room canvas + chat panel.

## 3. Avatar system (`src/avatar/`)

- `types.ts` — `AvatarConfig`, enums for gender/body_type/direction/state, slot option id catalogs.
- `manifest.ts` — Declarative list of option ids per slot; per-slot path builder function so paths follow spec exactly. Slots that are gender/body-agnostic omit those segments.
- `placeholders.ts` — Programmatically generates colored-rectangle PNGs as data URLs at module load for every referenced path, so the loader hits real image URLs but no binary assets ship. Distinct hue per layer, subtle variation per option id, small shape hint per state (idle vs walk) so compositing is visibly testable.
- `loader.ts` — `loadImage(url)` with in-memory cache; returns `HTMLImageElement`.
- `compositor.ts` — Given `AvatarConfig + direction + frameIndex`, draws layers bottom→top onto an offscreen canvas in the exact order: body → pants → shirt → head_shape → mouth → eyes → eyebrows → hair. LRU-caches composited frames keyed by full tuple. For `side` direction facing left, flips horizontally at draw time.
- `AvatarSprite.tsx` — React component that renders composited frames to a `<canvas>`, ticks a 2-frame walk cycle when `state=walk`.
- `AvatarCreator.tsx` — Left/right steppers per slot with live preview using `AvatarSprite`. Saves to `profiles.avatar_config`.

## 4. Room (`src/room/`)

- `Room.tsx` — Fixed logical size (e.g. 1280×720) rendered responsively. Solid placeholder background color exposed as a single `BACKGROUND_URL | BACKGROUND_COLOR` constant (swap to image = one line). Renders zone rects (bar/dance/games) with labels, all remote + local avatars via `AvatarSprite`, and click handler for movement.
- `zones.ts` — `{ id, rect, label, actionLabel }` config. Hit-test helper.
- `movement.ts` — Smooth interpolation from current → target position at fixed speed; direction derived from delta (up/down/side + facing).
- `ZoneAction.tsx` — Floating button when local avatar's position is inside a zone.
- `Chat.tsx` — Message list + input, wired to realtime broadcast.

## 5. Realtime (`src/realtime/`)

- `useRoomChannel.ts` — Subscribes to `room:main` channel. Uses Supabase Presence for `{ user_id, username, avatar_config, x, y, direction, state }`. Broadcasts: `move`, `chat`, `emote`, `join`, `leave`. Consumers get `players` map (from presence sync/join/leave) and `messages` list. Local moves update presence via `channel.track(...)` (throttled ~10 Hz).

## 6. Design system

Minimal but non-generic — dark, warm bar/nightclub palette in `src/styles.css` via oklch tokens. Tokens for background, room-floor, zone-bar, zone-dance, zone-games, accent, chat surface. Custom Tailwind classes only through the token pipeline.

## Out of scope for Phase 1
Minigames, real art, EventSub, achievements, moderation, persistent chat history, mobile controls polish.

## Technical notes
- Placeholder PNGs: use `OffscreenCanvas` (fallback `document.createElement('canvas')`) to generate then `toDataURL()`. Precompute once and register into loader cache by URL so real files can drop into `/public/assets/avatars/...` later and the same URLs resolve.
- Anonymous auth for the dev-skip path so RLS still works uniformly.
- Bearer middleware wired via `attachSupabaseAuth` in `src/start.ts` for future authenticated server fns (edge functions here won't need it, but adding profile writes will).

Ready to implement on approval.
