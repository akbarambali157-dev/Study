import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: auth, error: authError } = await authClient.auth.getUser();
  if (authError || !auth.user) return json(401, { error: "Sign in to test notifications." });
  if (!serviceKey) return json(503, { error: "Notification service is not configured." });

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { count, error: subscriptionError } = await admin.from("push_subscriptions")
    .select("id", { count: "exact", head: true }).eq("user_id", auth.user.id);
  if (subscriptionError) return json(503, { error: "This device's push registration could not be checked." });
  if (!count) return json(409, { error: "Enable push on this device first, then send a test notification." });

  // Keep the self-test from becoming a notification-spam endpoint.
  const since = new Date(Date.now() - 30_000).toISOString();
  const { data: recent, error: recentError } = await admin.from("notifications")
    .select("id").eq("user_id", auth.user.id).eq("notification_type", "push_test")
    .gte("created_at", since).limit(1).maybeSingle();
  if (recentError) return json(503, { error: "The test-notification rate limit could not be checked." });
  if (recent) return json(429, { error: "Please wait 30 seconds before sending another test notification." });

  const id = crypto.randomUUID();
  const { error: insertError } = await admin.from("notifications").insert({
    user_id: auth.user.id,
    actor_id: auth.user.id,
    notification_type: "push_test",
    entity_id: null,
    title: "Study Hub test notification",
    body: "Push notifications are connected on this device.",
    target_path: "/settings",
    dedupe_key: `push-test:${id}`,
  });
  if (insertError) {
    console.error("Push test notification insert failed", { code: insertError.code });
    return json(503, { error: "The test notification could not be queued." });
  }
  return json(200, { queued: true });
});
