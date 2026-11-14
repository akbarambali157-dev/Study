import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function allowedEndpoint(value: unknown, key: string): string {
  const endpoint = typeof value === "string" ? value.replace(/\/+$/, "") : "";
  if (key.startsWith("sk-ant-") && endpoint === "https://api.anthropic.com") return endpoint;
  if (!key.startsWith("sk-ant-") && endpoint === "https://brewkeg.dev") return endpoint;
  throw new Error(key.startsWith("sk-ant-")
    ? "Anthropic credentials must use https://api.anthropic.com."
    : "Gateway credentials must use the supported BrewKeg endpoint.");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond(405, { error: "Method not allowed." });

  const authClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await authClient.auth.getUser();
  if (authError || !auth.user) return respond(401, { error: "Sign in to manage your provider credential." });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return respond(503, { error: "Secure credential storage is temporarily unavailable." });
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: { action?: string; key?: string; base_url?: string };
  try {
    body = await req.json();
  } catch {
    return respond(400, { error: "A valid request body is required." });
  }
  const action = body.action;
  if (action === "status") {
    const { data, error } = await admin.from("user_provider_credentials")
      .select("base_url,updated_at").eq("user_id", auth.user.id).maybeSingle();
    if (error) return respond(503, { error: "Credential status could not be checked." });
    return respond(200, { configured: Boolean(data), base_url: data?.base_url ?? null, updated_at: data?.updated_at ?? null });
  }

  if (action === "delete") {
    const { error } = await admin.rpc("delete_user_provider_credential", { p_user_id: auth.user.id });
    if (error) return respond(503, { error: "The saved provider credential could not be removed." });
    return respond(200, { configured: false });
  }

  if (action !== "save") return respond(400, { error: "Unsupported credential action." });
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (key.length < 24 || key.length > 500 || /\s/.test(key)) {
    return respond(400, { error: "Enter a valid provider credential." });
  }

  let baseUrl: string;
  try {
    baseUrl = allowedEndpoint(body.base_url, key);
  } catch (error) {
    return respond(400, { error: error instanceof Error ? error.message : "Unsupported provider endpoint." });
  }

  const { error } = await admin.rpc("store_user_provider_credential", {
    p_user_id: auth.user.id,
    p_secret: key,
    p_base_url: baseUrl,
  });
  if (error) {
    console.error("Provider credential vault write failed", { userId: auth.user.id, code: error.code });
    return respond(503, { error: "The provider credential could not be saved securely." });
  }
  return respond(200, { configured: true, base_url: baseUrl });
});
