// ── Money Cells — Delete User Edge Function ───────────────────────────────
// Deletes the auth.users entry for a given user ID.
// Must be a separate Edge Function because the Supabase admin API
// (deleteUser) requires the service role key, which is not safe in the app.
//
// Deploy: supabase functions deploy delete-user
// ──────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    // Verify the request comes from an authenticated user
    // and that they are only deleting their own account
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Get the requesting user from their JWT
    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user: requestingUser }, error: authError } =
      await userClient.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !requestingUser) {
      return new Response(JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { userId } = await req.json();

    // Security check — users can only delete their own account
    if (userId !== requestingUser.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Delete the auth user — cascade handles all related data
    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      console.error("deleteUser error:", error);
      return new Response(JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );

  } catch (err) {
    console.error("delete-user error:", err);
    return new Response(
      JSON.stringify({ error: "Something went wrong" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
