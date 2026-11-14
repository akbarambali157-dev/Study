import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond(405, { error: "Method not allowed." });

  let materialId = "";
  try {
    const body = await req.json();
    materialId = typeof body?.materialId === "string" ? body.materialId : "";
  } catch {
    return respond(400, { error: "A valid material ID is required." });
  }
  if (!/^[0-9a-f-]{36}$/i.test(materialId)) {
    return respond(400, { error: "A valid material ID is required." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return respond(503, { error: "Original downloads are temporarily unavailable." });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Do not accept a bucket or object path from the browser. Resolve it only
  // through a public contribution whose owner explicitly shared its source.
  const { data: material, error: materialError } = await admin
    .from("public_materials")
    .select("id, owner_id, title, is_public, share_original, source_document_id")
    .eq("id", materialId)
    .eq("is_public", true)
    .eq("share_original", true)
    .maybeSingle();

  if (materialError || !material?.source_document_id) {
    return respond(404, { error: "This contributor has not made an original PDF available." });
  }

  const { data: document, error: documentError } = await admin
    .from("study_documents")
    .select("storage_path, owner_id, mime_type, size_bytes")
    .eq("id", material.source_document_id)
    .eq("owner_id", material.owner_id)
    .eq("mime_type", "application/pdf")
    .maybeSingle();

  if (documentError || !document?.storage_path || Number(document.size_bytes) > 31457280) {
    return respond(404, { error: "The original PDF is no longer available." });
  }

  const safeTitle = String(material.title || "Study material")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} ._-]/gu, "")
    .trim()
    .slice(0, 120) || "Study material";
  const { data: signed, error: signError } = await admin.storage
    .from("study-documents")
    .createSignedUrl(document.storage_path, 90, { download: safeTitle + ".pdf" });

  if (signError || !signed?.signedUrl) {
    return respond(503, { error: "The original PDF could not be prepared for download." });
  }

  return respond(200, { signedUrl: signed.signedUrl, expiresIn: 90 });
});
