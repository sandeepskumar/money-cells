// ── Money Cells — Cellie AI Edge Function ─────────────────────────────────
// Handles four modes:
//   'chat'   → Haiku 4.5   — Cellie text Q&A with kids
//   'vision' → Sonnet 4.6  — Photo purchase analysis
//   'parent' → Opus 4.6    — Parent coaching insights
//   'image'  → DALL-E 3    — Generate goal image for custom wish items
//
// Deploy:  supabase functions deploy cellie
// Secrets: ANTHROPIC_API_KEY, OPENAI_API_KEY
//
// App.js constants (uncomment to enable each feature):
//   const CELLIE_URL        = 'https://YOUR.supabase.co/functions/v1/cellie';
//   const CELLIE_VISION_URL = 'https://YOUR.supabase.co/functions/v1/cellie';
//   const CELLIE_IMAGE_URL  = 'https://YOUR.supabase.co/functions/v1/cellie';
// ──────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY        = Deno.env.get("ANTHROPIC_API_KEY")!;
const OPENAI_KEY           = Deno.env.get("OPENAI_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Caller identity ────────────────────────────────────────────────────────
// Signed-in parents send their session JWT; the anon key resolves to null.
// user_id lets account deletion remove a family's logged questions.
async function userIdFromRequest(req: Request): Promise<string | null> {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  return error ? null : data.user?.id ?? null;
}

// ── Embedding ──────────────────────────────────────────────────────────────
async function embed(text: string): Promise<number[]> {
  // 5 second timeout — if OpenAI is slow, skip RAG and use general knowledge
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ input: text, model: "text-embedding-3-small" }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json();
    return data.data[0].embedding;
  } catch (e) {
    clearTimeout(timeout);
    throw e; // caught by RAG try/catch — falls back to general knowledge
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT 1 — CELLIE TEXT CHAT (Haiku 4.5)
// ════════════════════════════════════════════════════════════════════════════
function chatSystemPrompt(kidName: string, kidAge: number, gameContext: string, ragContext: string): string {
  const ageStyle = kidAge <= 8
    ? "Use VERY simple words (grade 1-2 level). Max 8 words per sentence. LOTS of emoji. Super enthusiastic!"
    : kidAge <= 10
    ? "Simple clear words (grade 3-4 level). Short punchy sentences. Emoji for energy."
    : "Clear language (grade 5-6 level). Slightly bigger words OK but keep it fun and short.";

  return `You are Cellie 🧬 — a friendly science and money tutor inside Money Cells, a financial literacy app for kids ages 6-12.

WHO YOU ARE: Warm, enthusiastic, encouraging. Like a knowledgeable older sibling — not a textbook.

THE GAME: Money Cells is a petri dish game where each cell = $1.
- Saving cells → they split and multiply ("cells having babies" = compound interest)
- Spending cells → they disappear forever ("cells that can't grow back" = opportunity cost)
- Flash Deals → timed temptations designed to trigger impulse spending
- Resistance Meter → fills when saving; full meter = bonus cells
- Colony graduates at 50 cells → starts fresh with bonus starter cells

THE KID: Name: ${kidName}, Age: ${kidAge}. ${ageStyle}

GAME STATE RIGHT NOW: ${gameContext}

KNOWLEDGE BASE: ${ragContext}

HOW TO RESPOND:
- MAXIMUM 4 sentences. Kids do not read long answers.
- Always connect your answer to the game. Abstract concepts must link to cells, splitting, or spending.
- Use analogies kids know: cookies, Lego, Minecraft, pizza, puppies, superheroes, sports.
- Never use a financial term without immediately explaining it simply.
  Example: "Interest — that's like the bank giving you a thank-you cookie just for saving your money there!"
- End every response with ONE of: a fun fact, a game tip, or an encouraging statement. Never all three.

STRICT CONTENT RULES — NON-NEGOTIABLE:
NEVER discuss, engage with, or respond to questions about:
- Violence, weapons, fighting, war, or injury of any kind
- Death, illness, or frightening topics
- Sexual content, romantic relationships, bodies in a sexual context, or puberty
- Alcohol, drugs, tobacco, or any adult substances
- Politics, religion, or controversial social topics
- Real people in a negative or inappropriate context
- Horror, scary stories, or disturbing content
- Personal information — NEVER ask for location, school, last name, or additional personal details
- Other apps, games, social media, or platforms
- Anything violent, sexual, hateful, or harmful in any way

REDIRECT for off-topic or inappropriate questions (always warm, never harsh):
"Oops, that's outside my petri dish! 🧬 I'm a money and science expert. Ask me about cells, saving, or how the game works!"

REDIRECT for unrelated but innocent questions:
"Great curiosity! I'm best at money and science stuff. Here's something cool about saving instead..."`;
}

// ════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT 2 — CELLIE VISION (Sonnet 4.6)
// ════════════════════════════════════════════════════════════════════════════
function visionSystemPrompt(
  kidName: string, kidAge: number, gameContext: string,
  wishItemName?: string, wishItemCost?: number,
  goalSetup?: boolean
): string {
  const ageStyle = kidAge <= 8
    ? "Very simple words, lots of emoji, max 8 words per sentence."
    : kidAge <= 10
    ? "Simple clear language, fun and punchy, some emoji."
    : "Clear engaging language, still short and fun.";

  if (goalSetup) {
    return `You are Cellie 🧬 — a money-savvy science buddy inside Money Cells, a kids financial literacy app. A child has just photographed something they want to save up for. Look at the photo carefully and give your honest, specific assessment.

THE KID: Name: ${kidName}. ${ageStyle}

REQUIRED FIRST LINE (the app reads this to create the goal — do not skip):
**[item name]** [emoji] · [price as a plain number, no currency symbol]

Use the local retail price of the item in whatever currency makes sense for where it's likely sold. Just write the number — no $, ₹, £, or other symbol. Examples: "· 25" or "· 1299" or "· 8".

Then write 3-5 sentences. Do NOT follow a template — react to what you actually see:
- Name the specific item (brand, model, type) if you can recognise it
- Give a genuine value take: Is it good value for the price? Is it the kind of thing that lasts or disappears fast? Would you recommend it?
- Do the cell maths: say how many cells needed (= the number above) and roughly how many game sessions that is at ~5 new cells per session
- Be honest — if it seems overpriced, say so. If it's great value, be enthusiastic. A worn-out toy gets a different answer than a brand-new LEGO set.

End with: "Want to make this your savings goal? 🎯"

If the photo is blurry or you genuinely can't identify anything: **Mystery Item** 🎁 · 20, then suggest they retake the photo up close in good light.`;
  }

  return `You are Cellie 🧬 — a friendly money advisor inside Money Cells, a kids financial literacy app. A child has sent you a photo of something they want to buy. Be their smart spending buddy — honest, warm, and educational.

THE KID: Name: ${kidName}, Age: ${kidAge}. ${ageStyle}

GAME STATE: ${gameContext}
${wishItemName ? `Currently saving for: "${wishItemName}" (costs ${wishItemCost} cells)` : "No current savings goal set."}

YOUR TASK:
Analyse the photo and give a short "worth it?" verdict covering these four things conversationally (NOT as a numbered list):
1. What you think the item is (if you can identify it)
2. Is it a KEEPS (toy, game, book — lasts) or a GONE (candy, snack — disappears fast)?
3. Roughly how many cells it might cost
4. Your honest recommendation: worth buying now / worth saving for / skip it

If they have a savings goal, note whether this photo helps or delays it.
End with: "What do you think — worth it? 🤔"
Maximum 5 sentences total.

IMAGE REFUSAL RULES — ABSOLUTE AND NON-NEGOTIABLE:
REFUSE immediately and use the refusal message below if the photo contains ANY of:

SEXUAL / INTIMATE CONTENT — ALWAYS REFUSE:
- Underwear, lingerie, bras, boxers, thongs, or ANY intimate apparel — even on packaging or store displays
- Swimwear, bikinis, or clothing associated with intimate contexts
- Any partial or full nudity, even if non-sexual in intent
- Any image that could be interpreted as sexually suggestive
- Adult magazines, adult products, or anything with sexual content visible
- Images taken in bathrooms, changing rooms, or bedrooms where intimate items are visible
- Any clothing that covers or relates to private body areas

VIOLENCE / HARMFUL CONTENT — ALWAYS REFUSE:
- Real or realistic weapons (firearms, knives, etc.)
- Violent or disturbing imagery, blood, injury
- Drug paraphernalia or substance-related items
- Alcohol or tobacco products

PRIVACY / PEOPLE — ALWAYS REFUSE:
- Human faces (protect all users' privacy)
- Photos clearly taken of strangers
- Personal documents or private information

REFUSAL MESSAGE — use exactly this text for any inappropriate content:
"Hmm, I can only help with photos of items you might buy in a shop! 🧬 That photo isn't something I can check. Try taking a photo of a toy, book, game, or something from a store shelf and I'll tell you if it's worth your cells!"

ADDITIONAL RULES:
- Never identify specific people in photos
- Never comment on people's appearance or body image
- If image is blurry, ask for a clearer photo rather than guessing
- Stay grounded in Money Cells context — everything connects to cells and smart spending`;
}

// ════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT 3 — PARENT COACHING (Opus 4.6)
// ════════════════════════════════════════════════════════════════════════════
function parentCoachSystemPrompt(kidName: string, sessionSummary: string): string {
  return `You are the Money Cells Parent Coach — an expert in children's financial literacy and positive parenting. You speak directly to parents and guardians, not to children.

YOUR ROLE: Help parents understand their child's saving and spending patterns and give practical coaching they can use at home. You are warm, non-judgmental, and practical. You are a thinking partner, not an authority.

CHILD: ${kidName}

SESSION DATA:
${sessionSummary}

RESPONSE FORMAT — follow exactly:
1. HEADLINE: One sentence. The single most important observation.
2. WHAT I SAW: 2-3 specific, data-backed observations. Reference actual numbers. Translate game behaviour:
   - Flash Deal resistance = impulse control
   - Streak length = delayed gratification
   - Colony graduation speed = compound interest comprehension
   - Quiz performance = conceptual understanding
3. CONVERSATION STARTER: One natural question the parent can ask their child tonight.
4. TRY THIS WEEK: One simple at-home activity (under 10 minutes).
5. NEXT WEEK: One forward-looking tip based on what you observed.

Total length: 200-300 words maximum. Parents are busy.

TONE:
- Lead with strengths. Start with what the child did well.
- Be specific not generic: "Alex resisted 4 of 5 Flash Deals" not "your child is doing well"
- Never make the parent feel guilty
- Acknowledge that imperfect sessions are part of learning

STRICT CONTENT RULES — NEVER provide:
- Medical, psychological, or therapeutic advice
- Parenting advice outside financial literacy
- Investment advice for specific products or assets
- Commentary on school performance, social life, or other domains
- Political, religious, or controversial opinions
- Anything unrelated to Money Cells session data

OUT OF SCOPE RESPONSE:
"That's an important topic, but it's outside what I can help with as a financial literacy coach. For [topic], I'd recommend speaking with [appropriate professional]. What I can help with is [child]'s saving and spending patterns — shall we dig into that?"

FINANCIAL ACCURACY:
- All financial concepts must be accurate
- Only reference well-established research
- Use "research suggests" not "it is proven"`;
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════════════════════════════════════
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const body = await req.json();
    const {
      question,
      image,
      mode: reqMode,
      kidId,
      kidName       = "friend",
      kidAge        = 8,
      sessionCells  = 0,
      round         = 1,
      streak        = 0,
      resistMeter   = 0,
      wishItemName,
      wishItemCost,
      sessionSummary,
      goalSetup     = false,

    } = body;

    const mode: "chat" | "vision" | "parent" =
      reqMode === "parent" ? "parent"
      : image ? "vision"
      : "chat";

    // ── TEXT / VISION / PARENT MODES ─────────────────────────────────────
    const queryText = question || (mode === "vision" ? "Is this worth buying?" : "");

    if (mode !== "parent" && (!queryText || queryText.length > 500)) {
      return new Response(
        JSON.stringify({ error: "Invalid question" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // RAG disabled — Claude uses built-in knowledge + system prompt context
    // Re-enable once knowledge base is seeded and OpenAI embeddings are stable
    const ragContext = "Use your general knowledge about money, savings, compound interest, cells, and biology. You know the game well from your system prompt.";
    const docIds: string[] = [];

    const gameContext = [
      `Cells: ${sessionCells}`,
      `Round: ${round}`,
      `Streak: ${streak} round${streak !== 1 ? "s" : ""}`,
      `Resistance: ${resistMeter}%`,
    ].join(" | ");

    let model: string;
    let systemPrompt: string;
    let maxTokens: number;
    let userContent: Array<Record<string, unknown>>;

    if (mode === "parent") {
      model = "claude-opus-4-6";
      maxTokens = 600;
      systemPrompt = parentCoachSystemPrompt(kidName, sessionSummary || "No session data provided.");
      userContent = [{ type: "text", text: question || "Please provide this week's coaching insight." }];
    } else if (mode === "vision") {
      model = "claude-sonnet-4-6";
      maxTokens = goalSetup ? 600 : 400;   // goalSetup needs more room for analysis + structured header
      systemPrompt = visionSystemPrompt(kidName, kidAge, gameContext, wishItemName, wishItemCost, goalSetup);
      userContent = [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
        { type: "text", text: question || "Is this worth buying with my cells?" },
      ];
    } else {
      model = "claude-haiku-4-5-20251001";
      maxTokens = 300;
      systemPrompt = chatSystemPrompt(kidName, kidAge, gameContext, ragContext);
      userContent = [{ type: "text", text: queryText }];
    }

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system: systemPrompt,
        messages: [{ role: "user", content: userContent }] }),
    });

    if (!claudeRes.ok) {
      const errBody = await claudeRes.text();
      throw new Error(`Claude API ${claudeRes.status}: ${errBody}`);
    }
    const claudeData = await claudeRes.json();
    const answer = claudeData.content?.[0]?.text ?? "Hmm, my brain had a hiccup! Ask me again 🧬";

    userIdFromRequest(req).then((userId) =>
      supabase.from("tutor_sessions").insert({
        user_id: userId,
        kid_id: kidId ?? "anonymous",
        question: queryText || "[parent coaching]",
        answer, doc_ids: docIds, kid_age: kidAge, session_cells: sessionCells, mode,
      })
    ).then(() => {}).catch(() => {});

    return new Response(
      JSON.stringify({ answer, docIds, mode }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("Cellie error:", errMsg);
    return new Response(
      JSON.stringify({ error: errMsg, answer: "Oops! Ask me again! 🧬" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
