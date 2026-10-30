import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBotState } from "@/lib/emotion";

export const runtime = "nodejs";

export async function GET() {
  try {
    const state = await getBotState();
    let dominant = "neutral";
    if (state.energy < 25) dominant = "tired";
    else if (state.stress > 65) dominant = "stressed";
    else if (state.mood < 35) dominant = "sad";
    else if (state.joy > 65 && state.mood > 60) dominant = "happy";

    return NextResponse.json({
      energy: state.energy,
      mood: state.mood,
      stress: state.stress,
      joy: state.joy,
      conversationCount: state.conversationCount,
      dominant,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "internal error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
