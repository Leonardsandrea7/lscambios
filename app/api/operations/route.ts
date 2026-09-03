import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { assignRandomProvider, expireStaleAssignments } from "@/lib/matching";

/**
 * POST /api/operations
 * Crea una operación nueva y la asigna al azar a un cajero elegible,
 * con una ventana de 2 minutos antes de pasar al pool general.
 */
export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const body = await req.json();

  const { clientId, kind, paymentMethodId, amountSent, amountReceived, rateApplied, payoutDestination } = body;

  if (!clientId || !kind || !paymentMethodId || !amountSent || !amountReceived || !payoutDestination) {
    return NextResponse.json({ error: "Faltan campos requeridos." }, { status: 400 });
  }

  // ===== Validación anti-fraude: la wallet/destino debe coincidir con la registrada =====
  const { data: profile } = await supabase
    .from("profiles")
    .select("wallet_address")
    .eq("id", clientId)
    .single();

  const normalizedDestination = payoutDestination.trim().toLowerCase();

  if (profile?.wallet_address && profile.wallet_address !== normalizedDestination) {
    await supabase.from("fraud_flags").insert({
      actor_id: clientId,
      flag_type: "wallet_mismatch",
      details: { registered_wallet: profile.wallet_address, attempted_destination: normalizedDestination },
    });
    await supabase.from("admin_alerts").insert({
      kind: "fraud_flag",
      message: `Cliente intentó recibir en una wallet distinta a la registrada (${normalizedDestination} vs ${profile.wallet_address}).`,
    });
    return NextResponse.json(
      { error: "El destino no coincide con tu wallet registrada. Operación bloqueada." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("operations")
    .insert({
      client_id: clientId,
      kind,
      payment_method_id: paymentMethodId,
      amount_sent: amountSent,
      amount_received: amountReceived,
      rate_applied: rateApplied,
      payout_destination: normalizedDestination,
      status: "pending_match",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const assignment = await assignRandomProvider(supabase, {
    operationId: data.id,
    paymentMethodId,
    amountUsdEquivalent: Number(amountSent),
  });

  return NextResponse.json({ operation: { ...data, ...assignment } }, { status: 201 });
}

/**
 * GET /api/operations?status=pending_match&paymentMethodId=binance&providerId=xxx
 *
 * Antes de listar, expira las asignaciones individuales vencidas (>2 min)
 * hacia el pool general. Si se pasa providerId, se ve: el pool general +
 * lo que esté asignado específicamente a ese cajero (y aún no venció).
 * Si no se pasa providerId, solo se ve el pool general (vista de admin).
 */
export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  await expireStaleAssignments(supabase);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const paymentMethodId = searchParams.get("paymentMethodId");
  const providerId = searchParams.get("providerId");

  let query = supabase.from("operations").select("*").order("created_at", { ascending: true });
  if (status) query = query.eq("status", status);
  if (paymentMethodId) query = query.eq("payment_method_id", paymentMethodId);

  if (providerId) {
    query = query.or(`pool_stage.eq.general,and(pool_stage.eq.assigned,assigned_to.eq.${providerId})`);
  } else {
    query = query.eq("pool_stage", "general");
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ operations: data });
}
