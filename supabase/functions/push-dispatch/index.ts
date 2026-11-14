import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const APP_ORIGIN = "https://study-platform-delta.vercel.app";
const categoryForType: Record<string, string> = {
  direct_message: "direct_messages",
  post_reply: "replies",
  post_reaction: "reactions",
  course_update: "course_discussions",
  system: "product_announcements",
  message: "direct_messages",
  research_reply: "replies",
  reply: "replies",
  mention: "mentions",
  research_reaction: "reactions",
  reaction: "reactions",
  collaboration_invite: "collaboration_invites",
  course_discussion: "course_discussions",
  suggested_connection: "suggested_connections",
  product_announcement: "product_announcements",
};

function json(status: number, data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function parseClock(value: unknown): number | null {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d/.test(value)) return null;
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

function isQuietNow(prefs: Record<string, any>): boolean {
  if (prefs.quiet_hours_enabled !== true) return false;
  const start = parseClock(prefs.quiet_hours_start);
  const end = parseClock(prefs.quiet_hours_end);
  if (start === null || end === null || start === end) return false;
  const timeZone = typeof prefs.time_zone === "string" && prefs.time_zone.length < 80 ? prefs.time_zone : "UTC";
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-GB", {
      timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date());
  } catch {
    return false;
  }
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const now = hour * 60 + minute;
  return start < end ? now >= start && now < end : now >= start || now < end;
}

function safeTargetPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  try {
    const url = new URL(value, APP_ORIGIN);
    return url.origin === APP_ORIGIN ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}

function isTrustedPushEndpoint(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    return host === "fcm.googleapis.com" ||
      host === "push.services.mozilla.com" ||
      host.endsWith(".push.services.mozilla.com") ||
      host.endsWith(".push.apple.com") ||
      host.endsWith(".notify.windows.com");
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return json(503, { error: "Push delivery is not configured." });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: config, error: configError } = await admin.rpc("get_push_dispatch_config");
  if (configError || !config?.dispatch_token || !config?.vapid_jwks) {
    console.error("Push dispatch secrets are unavailable", { code: configError?.code });
    return json(503, { error: "Push delivery is not configured." });
  }
  let body: { action?: string; notification_id?: string };
  try { body = await req.json(); } catch { return json(400, { error: "Invalid request body." }); }

  // The VAPID public key is public by design. Keep the private signing key
  // and dispatch token server-only in Vault.
  if (body.action === "public-key") {
    try {
      const keys = await webpush.importVapidKeys(config.vapid_jwks);
      const publicKey = await webpush.exportApplicationServerKey(keys);
      return json(200, { publicKey });
    } catch (error) {
      console.error("VAPID public key export failed", { name: error instanceof Error ? error.name : "unknown" });
      return json(503, { error: "Push registration is not configured." });
    }
  }

  const supplied = req.headers.get("Authorization") ?? "";
  if (supplied !== `Bearer ${config.dispatch_token}`) return json(401, { error: "Unauthorized." });
  const notificationId = typeof body.notification_id === "string" ? body.notification_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(notificationId)) return json(400, { error: "A notification ID is required." });

  const { data: notification, error: notificationError } = await admin.from("notifications")
    .select("id,user_id,notification_type,title,body,target_path").eq("id", notificationId).maybeSingle();
  if (notificationError || !notification) return json(404, { error: "Notification not found." });

  const [{ data: prefs }, { data: subscriptions, error: subscriptionsError }] = await Promise.all([
    admin.from("notification_preferences").select("*").eq("user_id", notification.user_id).maybeSingle(),
    admin.from("push_subscriptions").select("id,endpoint,p256dh,auth_secret,expiration_time")
      .eq("user_id", notification.user_id),
  ]);
  if (subscriptionsError) return json(503, { error: "Push subscriptions could not be loaded." });
  if (!subscriptions?.length) return json(200, { delivered: 0, reason: "no_subscriptions" });

  const category = categoryForType[String(notification.notification_type)] ?? null;
  if (prefs?.pause_all === true || (category && prefs?.[category] === false) || isQuietNow(prefs ?? {})) {
    return json(200, { delivered: 0, reason: "notification_preferences" });
  }

  let vapidKeys: CryptoKeyPair;
  try {
    vapidKeys = await webpush.importVapidKeys(config.vapid_jwks);
  } catch (error) {
    console.error("VAPID key import failed", { name: error instanceof Error ? error.name : "unknown" });
    return json(503, { error: "Push signing configuration is invalid." });
  }
  const applicationServer = await webpush.ApplicationServer.new({
    contactInformation: APP_ORIGIN,
    vapidKeys,
  });

  const targetPath = safeTargetPath(notification.target_path);
  const payload = JSON.stringify({
    title: String(notification.title ?? "Study Hub").slice(0, 100),
    body: notification.notification_type === "direct_message" ? "You have a new message." : String(notification.body ?? "You have a new notification.").slice(0, 240),
    url: targetPath,
    tag: `studyhub-${notification.notification_type}`,
  });
  let delivered = 0;
  let expired = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    const { data: prior } = await admin.from("push_delivery_log").select("status")
      .eq("notification_id", notificationId).eq("subscription_id", subscription.id).maybeSingle();
    if (prior?.status === "sent") continue;

    if (subscription.expiration_time && new Date(subscription.expiration_time).getTime() <= Date.now()) {
      await admin.from("push_subscriptions").delete().eq("id", subscription.id).eq("user_id", notification.user_id);
      await admin.from("push_delivery_log").upsert({
        notification_id: notificationId, subscription_id: subscription.id, status: "expired", attempted_at: new Date().toISOString(),
      }, { onConflict: "notification_id,subscription_id" });
      expired++;
      continue;
    }
    if (!isTrustedPushEndpoint(subscription.endpoint) || !subscription.p256dh || !subscription.auth_secret) {
      await admin.from("push_delivery_log").upsert({
        notification_id: notificationId, subscription_id: subscription.id, status: "failed",
        attempted_at: new Date().toISOString(), error_code: "INVALID_SUBSCRIPTION",
      }, { onConflict: "notification_id,subscription_id" });
      failed++;
      continue;
    }

    try {
      const subscriber = applicationServer.subscribe({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth_secret },
      });
      await subscriber.pushTextMessage(payload, {
        ttl: 3600,
        urgency: webpush.Urgency.Normal,
        topic: notificationId.replace(/-/g, "").slice(0, 32),
      });
      await admin.from("push_delivery_log").upsert({
        notification_id: notificationId, subscription_id: subscription.id, status: "sent", attempted_at: new Date().toISOString(),
      }, { onConflict: "notification_id,subscription_id" });
      delivered++;
    } catch (error) {
      const gone = typeof (error as { isGone?: unknown })?.isGone === "function" &&
        (error as { isGone: () => boolean }).isGone();
      if (gone) {
        await admin.from("push_subscriptions").delete().eq("id", subscription.id).eq("user_id", notification.user_id);
        await admin.from("push_delivery_log").upsert({
          notification_id: notificationId, subscription_id: subscription.id, status: "expired",
          attempted_at: new Date().toISOString(), error_code: "PUSH_ENDPOINT_GONE",
        }, { onConflict: "notification_id,subscription_id" });
        expired++;
      } else {
        console.warn("Push delivery failed", { notificationId, subscriptionId: subscription.id, name: error instanceof Error ? error.name : "unknown" });
        await admin.from("push_delivery_log").upsert({
          notification_id: notificationId, subscription_id: subscription.id, status: "failed",
          attempted_at: new Date().toISOString(), error_code: "PUSH_SEND_FAILED",
        }, { onConflict: "notification_id,subscription_id" });
        failed++;
      }
    }
  }

  return json(200, { delivered, expired, failed });
});
