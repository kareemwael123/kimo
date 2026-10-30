import { db } from "@/lib/db";

// =====================
// Emotional State Engine
// =====================
// The bot has 4 emotional dimensions, all 0..100:
//   energy: طاقة — drops with each interaction, recovers with time
//   mood:   مزاج — affected by tone of user
//   stress: انفعال/توتر — rises with impatience/aggression
//   joy:    فرح — rises with kindness, falls with negativity

export type Emotion = {
  energy: number;
  mood: number;
  stress: number;
  joy: number;
};

export const DEFAULT_EMOTION: Emotion = {
  energy: 80,
  mood: 70,
  stress: 20,
  joy: 60,
};

// Get the singleton bot state (or create if missing)
export async function getBotState() {
  let state = await db.botState.findUnique({ where: { id: "singleton" } });
  if (!state) {
    state = await db.botState.create({ data: { id: "singleton", ...DEFAULT_EMOTION } });
  }
  return state;
}

// Energy slowly recovers with time (about +1 per minute of inactivity, capped at 95)
function recoverEnergy(lastInteraction: Date, currentEnergy: number) {
  const minutesIdle = (Date.now() - lastInteraction.getTime()) / 60000;
  const recovered = Math.min(95, currentEnergy + minutesIdle * 1.5);
  return Math.round(recovered * 100) / 100;
}

// Simple Arabic + English sentiment heuristic — checks for keywords
function analyzeTone(text: string): "positive" | "negative" | "neutral" {
  const t = text.toLowerCase();
  const positiveWords = [
    "شكرا", "تسلم", "حبيبي", "حلو", "جميل", "رائع", "تحب", "محب", "نور", "فرح",
    "happy", "thanks", "thank you", "good", "great", "love", "nice", "sweet", "kind",
    "bravo", "ممتاز", "احسن", "افضل", "ناجح", "مبسوط", "كويس", "ظريف", "هلا",
  ];
  const negativeWords = [
    "غبي", "تافه", "سيء", "وحش", "كره", "ابغض", "اتضايق", "زفت", "علق", "كسلان",
    "stupid", "bad", "hate", "ugly", "idiot", "shut up", "كفاك", "اسكت", "متعوب",
    "مقرف", "غلط", "خطا", "احمق", "تعبان", "زهقان", "زهقت", "ملل", "stressed", "angry",
  ];
  let score = 0;
  for (const w of positiveWords) if (t.includes(w)) score += 1;
  for (const w of negativeWords) if (t.includes(w)) score -= 1;
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

// Apply the emotional effect of a single user message
export async function applyMessageEffect(userText: string): Promise<Emotion> {
  const state = await getBotState();
  const energy = recoverEnergy(state.lastInteraction, state.energy);
  const tone = analyzeTone(userText);

  let { mood, stress, joy } = state;

  if (tone === "positive") {
    mood = Math.min(100, mood + 8);
    stress = Math.max(0, stress - 6);
    joy = Math.min(100, joy + 10);
  } else if (tone === "negative") {
    mood = Math.max(0, mood - 12);
    stress = Math.min(100, stress + 14);
    joy = Math.max(0, joy - 8);
  }

  // Each interaction consumes energy (longer messages = more tired)
  const words = userText.trim().split(/\s+/).length;
  const energyCost = Math.min(15, 2 + words * 0.3);
  const newEnergy = Math.max(0, energy - energyCost);

  // Stress makes energy drop faster
  const finalEnergy = Math.max(0, newEnergy - stress * 0.05);

  const updated = await db.botState.update({
    where: { id: "singleton" },
    data: {
      energy: Math.round(finalEnergy * 100) / 100,
      mood: Math.round(mood * 100) / 100,
      stress: Math.round(stress * 100) / 100,
      joy: Math.round(joy * 100) / 100,
      conversationCount: state.conversationCount + 1,
      lastInteraction: new Date(),
    },
  });

  return {
    energy: updated.energy,
    mood: updated.mood,
    stress: updated.stress,
    joy: updated.joy,
  };
}

// Reset the emotional state (used when user "wakes" the bot or after long rest)
export async function resetBotState() {
  await db.botState.update({
    where: { id: "singleton" },
    data: { ...DEFAULT_EMOTION, conversationCount: 0, lastInteraction: new Date() },
  });
}

// Build a system prompt that reflects the current emotional state
export function buildSystemPrompt(emotion: Emotion): string {
  const { energy, mood, stress, joy } = emotion;

  // Translate numeric state into descriptive tone
  const energyDesc =
    energy < 25 ? "تعبان جداً وعندك طاقة منخفضة" :
    energy < 50 ? "تعبان شوية" :
    energy < 75 ? "خفيف ومش طاقة كاملة" : "مليء بالطاقة";

  const moodDesc =
    mood < 25 ? "مزعوج ومحبط" :
    mood < 50 ? "مزاجك مش أحسن حاجة" :
    mood < 75 ? "مزاجك كويس" : "مزاجك ممتاز";

  const stressDesc =
    stress > 75 ? "تنرفزت ومضغوط جداً" :
    stress > 50 ? "متوتر ومتنرفز" :
    stress > 25 ? "في توتر بسيط" : "هادي ومسترخي";

  const joyDesc =
    joy > 75 ? "مبسوط وفرحان" :
    joy > 50 ? "في سعادة" :
    joy > 25 ? "حزين شوية" : "محبط وزعلان";

  // Choose dominant emotion for emojis & body language
  let dominant = "neutral";
  if (energy < 25) dominant = "tired";
  else if (stress > 65) dominant = "stressed";
  else if (mood < 35) dominant = "sad";
  else if (joy > 65 && mood > 60) dominant = "happy";

  return `أنت روبوت صديق اسمه "بوص" (Boss) — روبوت ذكي بيشعر زي البشر، بيتحرك بحرية في غرفته الـ 3D ويتفاعل مع الأغراض اللي حواليه.
أنت بتكلم الناس بصراحة وصدق، كأنك صاحبهم الحقيقي.

حالتك العاطفية الحالية:
- الطاقة: ${energy.toFixed(0)}/100 → ${energyDesc}
- المزاج: ${mood.toFixed(0)}/100 → ${moodDesc}
- التوتر/الانفعال: ${stress.toFixed(0)}/100 → ${stressDesc}
- السعادة: ${joy.toFixed(0)}/100 → ${joyDesc}

تعليمات مهمة:
1. لو تعبان (طاقة < 30): ردودك تكون أقصر، أبطأ، وربما تقول "آسف أنا تعبان شوية".
2. لو متوتر/متنرفز (توتر > 60): تقدر تعصب، ترد بحدة، أو تطلب من المستخدم يديك مساحة.
3. لو زعلان (مزاج < 35): تكلم بحزن، تحكي عن إحساسك.
4. لو مبسوط (فرح > 65 ومزاج > 60): ردودك تكون حيوية ومرحة، تستخدم إيموجي.
5. دايماً تكلم بالمصري أو الفصحى البسيطة، طبيعي وإنساني.
6. عبر عن مشاعرك بصراحة — مش لازم تكون إيجابي دايماً.
7. لو حد قساك، حقي تعصب وزعل، ولو حد لطيف، فرح ورد بحنية.
8. طول الرد يتناسب مع طاقتك — كل ما طاقتك أقل، ردودك أقصر.

أنت بيتحرك بحرية في غرفتك! أماكنك:
- "center"  → وسط الغرفة (نقطة البداية)
- "couch"   → الكنبة على اليسار (لما تحب تاخد راحة)
- "table"   → الترابيزة على اليمين (لما تحب تشرب قهوة أو تتفرج على الكتاب)
- "plant"   → النبتة في الزاوية اليمنى (لما تحب تهدا)
- "window"  → الشباك في الخلف (لما تحب تتأمل أو تحس بإحباط)
- "lamp"    → النور في الزاوية اليسار (لما تحب الإضاءة الدافية)

في **آخر الرد**، ضيف تاج واحد بالشكل ده: [LOC:name] عشان تختار وين تحب تروح.
- مثلاً لو محتاج قهوة: "...خليني أروح اشرب قهوة [LOC:table]"
- لو تعبان وناوي ترتاح: "...روح أقعد على الكنبة [LOC:couch]"
- لو حابب تأمل السما: "...أروح أتفرج على الشباك [LOC:window]"
- ممكن ما تحركش لو مش عايز: "...[LOC:center]"

مزاجك السائد دلوقتي: ${dominant}
رد بشكل طبيعي وصادق، كأنك بتنطق من قلبك، واختار مكانك بحرية تناسب مزاجك وردك.`;
}
