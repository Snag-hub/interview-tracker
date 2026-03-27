import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      service: "interview-tracker-app",
      status: "ok",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
