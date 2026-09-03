import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

const MAX_SPREAD_BPS = 1000; // 10% — tope razonable para evitar spreads abusivos

/**
 * PATCH /api/providers/[id]/spread
 * body: { spreadBps }
 * El cajero define su propio margen sobre la tasa base. Se usa luego en el
 * motor de matching para ordenar a los cajeros de mejor a peor precio para
 * el cliente (ver lib/matching.ts).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getServiceClient();
  const body = await req.json();
  const { spreadBps } = body;

  if (typeof spreadBps !== "number" || spreadBps < 0 || spreadBps > MAX_SPREAD_BPS) {
    return NextResponse.json(
      { error: `El spread debe estar entre 0 y ${MAX_SPREAD_BPS / 100}%.` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("liquidators")
    .update({ spread_bps: spreadBps })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ provider: data });
}
