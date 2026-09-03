import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

/**
 * POST /api/providers/register
 * body: { userId, registrationEmail, paypalEmail, paymentMethods }
 *
 * Regla anti-fraude central: el correo de PayPal declarado por el cajero
 * DEBE coincidir exactamente con el correo con el que se registró en Upping.
 * Esto evita el fraude clásico: alguien pide que le paguen a un correo
 * distinto del que usó para registrarse, generalmente porque esa segunda
 * cuenta no es realmente suya.
 *
 * Si no coincide:
 *  1. Se rechaza el registro con un error claro para el cajero.
 *  2. Se registra en `fraud_flags` para trazabilidad.
 *  3. Se crea una alerta en `admin_alerts` para que el admin lo revise.
 */
export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const body = await req.json();
  const { userId, registrationEmail, paypalEmail, paymentMethods } = body;

  if (!userId || !registrationEmail || !paypalEmail) {
    return NextResponse.json({ error: "Faltan campos requeridos." }, { status: 400 });
  }

  const normalize = (email: string) => email.trim().toLowerCase();
  const emailsMatch = normalize(registrationEmail) === normalize(paypalEmail);

  if (!emailsMatch) {
    // 1. Registrar la alerta de fraude
    const { data: flag } = await supabase
      .from("fraud_flags")
      .insert({
        actor_id: userId,
        flag_type: "email_mismatch",
        details: {
          registration_email: registrationEmail,
          declared_paypal_email: paypalEmail,
        },
      })
      .select()
      .single();

    // 2. Notificar al admin
    await supabase.from("admin_alerts").insert({
      kind: "fraud_flag",
      message: `Posible estafador: intentó registrar PayPal (${paypalEmail}) distinto a su correo de cuenta (${registrationEmail}).`,
      related_id: flag?.id ?? null,
    });

    // 3. Responder con el error — sin dar pistas de cómo evadir la validación
    return NextResponse.json(
      { error: "Correo no compatible. El correo de PayPal debe coincidir con tu correo de registro." },
      { status: 400 }
    );
  }

  // Evitar que dos cuentas reclamen el mismo correo de PayPal
  const { data: existing } = await supabase
    .from("liquidators")
    .select("id")
    .eq("paypal_email", normalize(paypalEmail))
    .maybeSingle();

  if (existing) {
    await supabase.from("fraud_flags").insert({
      actor_id: userId,
      flag_type: "duplicate_paypal_email",
      details: { paypal_email: paypalEmail },
    });
    await supabase.from("admin_alerts").insert({
      kind: "fraud_flag",
      message: `Correo de PayPal (${paypalEmail}) ya está registrado por otro cajero. Posible cuenta duplicada.`,
    });
    return NextResponse.json(
      { error: "Este correo de PayPal ya está en uso por otra cuenta." },
      { status: 409 }
    );
  }

  const { data: provider, error } = await supabase
    .from("liquidators")
    .insert({
      profile_id: userId,
      paypal_email: normalize(paypalEmail),
      payment_methods: paymentMethods ?? ["paypal"],
      status: "pending", // requiere aprobación manual del admin, como ya tenías
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ provider }, { status: 201 });
}
