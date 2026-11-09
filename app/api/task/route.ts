import { NextResponse } from "next/server";
import { refresh, type ModelRecord } from "@/lib/models";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const record = await refresh(id);
  if (!record) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ record });
}

// Same, but the client sends the record it holds so polling works on any instance.
export async function POST(req: Request) {
  const { record: known } = (await req.json()) as { record: ModelRecord };
  if (!known?.id) return NextResponse.json({ error: "record is required" }, { status: 400 });
  const record = await refresh(known.id, known);
  if (!record) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ record });
}
