import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resetBotState } from "@/lib/emotion";

export const runtime = "nodejs";

export async function POST() {
  try {
    await resetBotState();
    await db.message.deleteMany({});
    return NextResponse.json({ ok: true, message: "Bot reset" });
  } catch (err: any) {
    return NextResponse.json(
      { error: "internal error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
