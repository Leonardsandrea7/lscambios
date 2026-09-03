import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

/**
 * GET /api/operations/[id]/receipt
 * Devuelve la operación junto con su constancia firmada (si existe) —
 * el registro completo de evidencia: monto, fecha, nombre escrito por
 * el cliente, y el texto exacto que confirmó.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getServiceClient();

  const { data: operation, error: opError } = await supabase
    .from("operations")
    .select("*")
    .eq("id", params.id)
    .single();

  if (opError || !operation) {
    return NextResponse.json({ error: "Operación no encontrada." }, { status: 404 });
  }

  const { data: acknowledgment } = await supabase
    .from("operation_acknowledgments")
    .select("*")
    .eq("operation_id", params.id)
    .maybeSingle();

  return NextResponse.json({
    operation,
    acknowledgment: acknowledgment ?? null,
    signed: !!acknowledgment,
  });
}
