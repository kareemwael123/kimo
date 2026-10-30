import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyMessageEffect, buildSystemPrompt } from "@/lib/emotion";

export const runtime = "nodejs";

// Cache the ZAI instance to avoid recreating it on every request
let zaiInstance: any = null;
async function getZAI() {
  if (!zaiInstance) {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    // 1. Update the emotional state based on the user's message
    const emotion = await applyMessageEffect(message);

    // 2. Load recent conversation memory (last 20 messages) for context
    const recent = await db.message.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const history = recent.reverse().map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 3. Store the user message
    await db.message.create({
      data: {
        role: "user",
        content: message,
        energy: emotion.energy,
        mood: emotion.mood,
        stress: emotion.stress,
        joy: emotion.joy,
      },
    });

    // 4. Build the system prompt reflecting current emotion
    const systemPrompt = buildSystemPrompt(emotion);

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: message },
    ];

    // 5. Try Groq first (if API key is set and valid), fallback to z-ai-web-dev-sdk
    let reply: string = "";
    let rawText = "";
    const groqKey = process.env.GROQ_API_KEY;
    const groqModel = process.env.GROQ_MODEL || "mistral-saba-llama-3.3-70B";

    let usedGroq = false;
    if (groqKey) {
      try {
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: groqModel,
            messages,
            temperature: 0.85,
            max_tokens: 400,
          }),
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          rawText = groqData.choices?.[0]?.message?.content ?? "";
          if (rawText) usedGroq = true;
        } else {
          console.log("Groq failed, falling back to z-ai SDK");
        }
      } catch (err) {
        console.error("Groq error:", err);
      }
    }

    // Fallback to z-ai-web-dev-sdk (always works in the sandbox)
    if (!rawText) {
      const zai = await getZAI();
      const result = await zai.chat.completions.create({
        messages,
        temperature: 0.85,
      });
      rawText = result.choices?.[0]?.message?.content ?? "...";
      if (rawText.length > 800) rawText = rawText.slice(0, 800);
    }

    // Parse location directive from end of reply: [LOC:name]
    // The LLM is instructed to add this to indicate where it wants to move in the room.
    let moveTo: string | null = null;
    const locMatch = rawText.match(/\[LOC:([a-z_]+)\]/i);
    if (locMatch) {
      moveTo = locMatch[1].toLowerCase();
      rawText = rawText.replace(/\[LOC:[a-z_]+\]/i, '').trim();
    }
    reply = rawText.trim();

    // 6. Store the assistant message
    await db.message.create({
      data: {
        role: "assistant",
        content: reply,
        energy: emotion.energy,
        mood: emotion.mood,
        stress: emotion.stress,
        joy: emotion.joy,
      },
    });

    // 7. Determine dominant emotion label for the 3D robot animation
    let dominant = "neutral";
    if (emotion.energy < 25) dominant = "tired";
    else if (emotion.stress > 65) dominant = "stressed";
    else if (emotion.mood < 35) dominant = "sad";
    else if (emotion.joy > 65 && emotion.mood > 60) dominant = "happy";

    return NextResponse.json({
      reply,
      emotion,
      dominant,
      moveTo,
      provider: usedGroq ? "groq" : "zai",
    });
  } catch (err: any) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: "internal error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
