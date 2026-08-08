import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { localizeTarotReading } from "@/lib/tarot-localization";
import { verifyLineAccessToken } from "@/lib/line-auth";

const TAROT_ENDPOINT = "https://json.astrologyapi.com/v1/tarot_predictions";
const DAILY_READING_LIMIT = 3;

function isTarotId(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 78;
}

export async function POST(request: Request) {
  if (process.env.TAROT_ENABLED !== "true") {
    return NextResponse.json(
      { error: "tarot_coming_soon", message: "ฟีเจอร์ดูดวงกำลังจะเปิดให้บริการเร็ว ๆ นี้" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { love, career, finance, lineAccessToken } = (body ?? {}) as Record<string, unknown>;
  if (![love, career, finance].every(isTarotId)) {
    return NextResponse.json({ error: "กรุณาเลือกไพ่ให้ครบ 3 ใบ" }, { status: 400 });
  }
  const loveId = Number(love);
  const careerId = Number(career);
  const financeId = Number(finance);
  if (typeof lineAccessToken !== "string" || !lineAccessToken) {
    return NextResponse.json({ error: "line_auth_required", message: "กรุณาเข้าสู่ระบบด้วย LINE" }, { status: 401 });
  }

  const lineProfile = await verifyLineAccessToken(lineAccessToken);
  if (!lineProfile) return NextResponse.json(
    { error: "invalid_line_session", message: "เซสชัน LINE หมดอายุ กรุณาเข้าสู่ระบบใหม่" },
    { status: 401 },
  );

  const customer = await prisma.customer.findUnique({
    where: { lineUserId: lineProfile.userId },
    select: { id: true },
  });
  if (!customer) {
    return NextResponse.json(
      { error: "customer_not_linked", message: "กรุณาจองคิวหรือสมัครสมาชิกเพื่อเชื่อมต่อบัญชีก่อนดูดวง" },
      { status: 403 },
    );
  }

  const usageDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const usage = await prisma.tarotUsage.upsert({
    where: { lineUserId_usageDate: { lineUserId: lineProfile.userId, usageDate } },
    create: { lineUserId: lineProfile.userId, usageDate, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  if (usage.count > DAILY_READING_LIMIT) {
    return NextResponse.json(
      { error: "daily_limit_reached", message: "คุณใช้สิทธิ์ดูดวงครบ 3 ครั้งสำหรับวันนี้แล้ว กรุณากลับมาใหม่พรุ่งนี้" },
      { status: 429 },
    );
  }

  const accessToken = process.env.ASTROLOGY_API_ACCESS_TOKEN;
  const userId = process.env.ASTROLOGY_API_USER_ID;
  const apiKey = process.env.ASTROLOGY_API_KEY;
  if (!accessToken && (!userId || !apiKey)) {
    return NextResponse.json(
      { error: "tarot_not_configured", message: "ยังไม่ได้ตั้งค่าบัญชี AstrologyAPI" },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(TAROT_ENDPOINT, {
      method: "POST",
      headers: {
        ...(accessToken
          ? { "x-astrologyapi-key": accessToken }
          : { Authorization: `Basic ${Buffer.from(`${userId}:${apiKey}`).toString("base64")}` }),
        "Content-Type": "application/json",
        "Accept-Language": "en",
      },
      body: JSON.stringify({ love: loveId, career: careerId, finance: financeId }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("AstrologyAPI tarot error", response.status, data);
      return NextResponse.json(
        { error: "tarot_provider_error", message: "ไม่สามารถเปิดคำทำนายได้ในขณะนี้" },
        { status: response.status === 429 ? 429 : 502 },
      );
    }

    if (!data || typeof data.love !== "string" || typeof data.career !== "string" || typeof data.finance !== "string") {
      return NextResponse.json({ error: "invalid_provider_response" }, { status: 502 });
    }

    return NextResponse.json(localizeTarotReading({
      loveId,
      careerId,
      financeId,
      provider: { love: data.love, career: data.career, finance: data.finance },
    }));
  } catch (error) {
    console.error("AstrologyAPI tarot request failed", error);
    return NextResponse.json(
      { error: "tarot_unavailable", message: "การเชื่อมต่อคำทำนายใช้เวลานานเกินไป กรุณาลองใหม่" },
      { status: 504 },
    );
  }
}
