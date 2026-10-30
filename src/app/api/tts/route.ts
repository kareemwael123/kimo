import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Cache the ZAI instance
let zaiInstance: any = null;
async function getZAI() {
  if (!zaiInstance) {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// Detect language: "ar" if Arabic chars dominate, otherwise "en"
function detectLanguage(text: string): "ar" | "en" {
  const arabicCount = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const latinCount = (text.match(/[a-zA-Z]/g) || []).length;
  return arabicCount > latinCount ? "ar" : "en";
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    // Truncate to ElevenLabs limit (1000 chars to be safe)
    const truncated = text.length > 1000 ? text.slice(0, 1000) : text;
    const lang = detectLanguage(truncated);

    // Pick voice per language — defaults are well-known public ElevenLabs voices
    const voiceId = lang === "ar"
      ? (process.env.ELEVENLABS_VOICE_AR || "pNInz6obpgDQGcFmaJgB") // Adam — deep male, handles Arabic well
      : (process.env.ELEVENLABS_VOICE_EN || "21m00Tcm4TlvDqIKefM2"); // Rachel — clear English female

    // Try ElevenLabs first if key is configured
    const elevenKey = process.env.ELEVENLABS_API_KEY;
    if (elevenKey) {
      try {
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": elevenKey,
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text: truncated,
            model_id: "eleven_multilingual_v2", // supports Arabic + English + 30+ languages
            voice_settings: {
              // Natural conversational settings
              stability: 0.45,             // moderate — allows emotional variety
              similarity_boost: 0.85,      // high — keeps voice identity
              style: 0.25,                 // low-mid — natural, not theatrical
              use_speaker_boost: true,     // enhances clarity
            },
          }),
        });

        if (res.ok) {
          const audioBuf = Buffer.from(await res.arrayBuffer());
          const base64 = audioBuf.toString("base64");
          const dataUrl = `data:audio/mpeg;base64,${base64}`;
          return NextResponse.json({
            audio: dataUrl,
            provider: "elevenlabs",
            lang,
            voice: voiceId,
          });
        }
        console.log(`ElevenLabs failed (lang=${lang}), falling back to z-ai SDK`);
      } catch (err) {
        console.error("ElevenLabs error:", err);
      }
    }

    // Fallback: z-ai-web-dev-sdk TTS (always works in the sandbox)
    const zai = await getZAI();
    const response = await zai.audio.tts.create({
      input: truncated,
      voice: 'tongtong',
      speed: 1.0,
      response_format: 'wav',
      stream: false,
    });
    const arrayBuffer = await response.arrayBuffer();
    const audioBuf = Buffer.from(new Uint8Array(arrayBuffer));
    const base64 = audioBuf.toString("base64");
    const dataUrl = `data:audio/wav;base64,${base64}`;

    return NextResponse.json({ audio: dataUrl, provider: "zai", lang });
  } catch (err: any) {
    console.error("TTS API error:", err);
    return NextResponse.json(
      { error: "internal error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
