import { NextResponse } from "next/server";
import { quotaStatus } from "@/lib/quota";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return NextResponse.json(await quotaStatus(req));
}
