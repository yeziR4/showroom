import { NextResponse } from "next/server";
import { refresh } from "@/lib/models";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const record = await refresh(id);
  if (!record) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ record });
}
