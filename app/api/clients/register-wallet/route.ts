import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

/**
 * POST /api/clients/register-wallet
 * body: { userId, walletAddress }
 *
 * Igual que con el correo de PayPal de los cajeros: la wallet del cliente
 * se fija UNA vez al registrarse. Si en un trade futuro llega una wallet
 * distinta, se bloquea — evita que alguien reciba fondos en una wallet
 * que no es realmente suya (cuenta robada, error, o intento de desviar
 * el pago de otra persona).
 */
export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const body = await req.json();
  const { userId, walletAddress } = body;

  if (!userId || !walletAddress) {
    return NextResponse.json({ error: "Faltan campos requeridos." }, { status: 400 });
  }

  const normalized = walletAddress.trim().toLowerCase();

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("wallet_address", normalized)
    .maybeSingle();

  if (existing && existing.id !== userId) {
    await supabase.from("fraud_flags").insert({
      actor_id: userId,
      flag_type: "duplicate_wallet",
      details: { wallet_address: normalized },
    });
    await supabase.from("admin_alerts").insert({
      kind: "fraud_flag",
      message: `Wallet ${normalized} ya está registrada por otra cuenta. Posible intento de desvío de fondos.`,
    });
    return NextResponse.json(
      { error: "Esta wallet ya está registrada en otra cuenta." },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ wallet_address: normalized })
    .eq("id", userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ profile: data });
}
