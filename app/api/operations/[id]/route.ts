import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { claimOperation, releaseCollateral } from "@/lib/matching";
import { recordReputationEvent } from "@/lib/reputation";
import { CLIENT_ACKNOWLEDGMENT_TEXT } from "@/lib/paymentMemo";

/**
 * PATCH /api/operations/[id]
 * body: { action: "claim" | "mark_payment_sent" | "verify" | "mark_paid" | "complete" }
 *
 * Implementa la máquina de estados descrita en el documento de diseño:
 * pending_match -> matched -> awaiting_payment -> payment_sent ->
 * liquidator_verifying -> liquidator_paying -> completed
 */
/**
 * GET /api/operations/[id]
 * Consulta el estado actual de una operación — usado por el cliente para
 * saber cuándo un cajero la tomó (poll simple desde el dashboard).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("operations")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Operación no encontrada." }, { status: 404 });
  }
  return NextResponse.json({ operation: data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getServiceClient();
  const body = await req.json();
  const { action } = body;

  const { data: operation, error: fetchError } = await supabase
    .from("operations")
    .select("*")
    .eq("id", params.id)
    .single();

  if (fetchError || !operation) {
    return NextResponse.json({ error: "Operación no encontrada." }, { status: 404 });
  }

  try {
    switch (action) {
      case "claim": {
        // body: { liquidatorId }
        // Si la operación sigue en fase "assigned" y no venció, solo el
        // cajero asignado puede tomarla — así funciona la asignación
        // aleatoria de 2 minutos antes de pasar al pool general.
        const stillAssignedToOther =
          operation.pool_stage === "assigned" &&
          operation.assigned_to !== body.liquidatorId &&
          operation.assignment_expires_at &&
          new Date(operation.assignment_expires_at) > new Date();

        if (stillAssignedToOther) {
          return NextResponse.json(
            { error: "Esta operación está asignada a otro cajero por ahora." },
            { status: 409 }
          );
        }

        const updated = await claimOperation(supabase, {
          operationId: params.id,
          liquidatorId: body.liquidatorId,
          amountUsdEquivalent: operation.amount_sent,
        });
        // Tras tomar la operación, pasa a esperar el pago del cliente
        await supabase
          .from("operations")
          .update({ status: "awaiting_payment" })
          .eq("id", params.id);
        return NextResponse.json({ operation: updated });
      }

      case "mark_payment_sent": {
        // body: { proofUrl, clientFullName }
        // El cliente adjunta comprobante, marca que envió el pago, y escribe
        // su nombre completo como confirmación — queda guardado como
        // constancia (ver lib/paymentMemo.ts para qué significa esto
        // realmente y qué NO significa).
        if (!body.clientFullName || body.clientFullName.trim().length < 3) {
          return NextResponse.json(
            { error: "Debes escribir tu nombre completo para confirmar." },
            { status: 400 }
          );
        }

        const { data: updated, error } = await supabase
          .from("operations")
          .update({
            status: "payment_sent",
            proof_url: body.proofUrl ?? operation.proof_url,
          })
          .eq("id", params.id)
          .eq("status", "awaiting_payment")
          .select()
          .single();
        if (error || !updated) throw new Error("No se pudo actualizar el estado.");

        await supabase.from("operation_acknowledgments").insert({
          operation_id: params.id,
          full_name: body.clientFullName.trim(),
          statement_text: CLIENT_ACKNOWLEDGMENT_TEXT,
        });

        // El liquidador entra a revisar
        await supabase
          .from("operations")
          .update({ status: "liquidator_verifying" })
          .eq("id", params.id);
        return NextResponse.json({ operation: updated });
      }

      case "mark_paying": {
        // El liquidador confirmó el comprobante y va a enviar el pago al cliente
        const { data: updated, error } = await supabase
          .from("operations")
          .update({ status: "liquidator_paying" })
          .eq("id", params.id)
          .eq("status", "liquidator_verifying")
          .select()
          .single();
        if (error || !updated) throw new Error("No se pudo actualizar el estado.");
        return NextResponse.json({ operation: updated });
      }

      case "complete": {
        // Cliente confirma que recibió su pago -> se libera colateral y sube reputación
        const { data: updated, error } = await supabase
          .from("operations")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", params.id)
          .eq("status", "liquidator_paying")
          .select()
          .single();
        if (error || !updated) throw new Error("No se pudo completar la operación.");

        await releaseCollateral(supabase, { operationId: params.id });

        if (operation.liquidator_id) {
          await recordReputationEvent(supabase, {
            liquidatorId: operation.liquidator_id,
            operationId: params.id,
            eventType: "completed",
            volumeUsd: Number(operation.amount_sent),
          });
        }

        return NextResponse.json({ operation: updated });
      }

      default:
        return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
}
