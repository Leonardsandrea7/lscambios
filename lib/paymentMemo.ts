/**
 * Memo y constancia de pago — pensado para dejar un registro claro de la
 * operación, NO para "controlar" a PayPal.
 *
 * Importante (léelo antes de usar esto en producción):
 * - PayPal no es parte de este texto ni de la constancia que firma el
 *   cliente. Un acuerdo privado entre cliente y cajero no le da a Upping
 *   ni al cajero autoridad para que PayPal congele o quite fondos de nadie.
 * - Si el memo describe la operación de forma que oculte que es un cambio
 *   de divisas/cripto (ej. decir "pago por servicio" para disimularlo),
 *   eso puede leerse como una violación de los Términos de Uso de PayPal,
 *   y el riesgo real es que le suspendan la cuenta al cajero — lo
 *   contrario de protegerlo.
 * - Lo que SÍ logra esto: un registro claro, con fecha y datos, de que el
 *   cliente confirmó el pago y estuvo de acuerdo con los términos de la
 *   operación. Sirve como evidencia para las disputas internas de Upping,
 *   y como respaldo si el cajero necesita reportar un caso de fraude real
 *   ante PayPal (con la verdad, no con una versión disfrazada).
 */

export function buildPaymentMemo(params: {
  amount: number;
  currency: string;
  fullName: string;
  email: string;
  operationNumber: string;
}) {
  return (
    `${params.currency} ${params.amount.toFixed(2)}, ${params.fullName}, correo: ${params.email}. ` +
    `Hago un pago a través de Upping con el ID de transacción #${params.operationNumber}. ` +
    `Hago este pago bajo mi propia voluntad y sin influencia externa. ` +
    `No solicitaré reembolso ni apelación. Firma: ${params.fullName}`
  );
}

export const CLIENT_ACKNOWLEDGMENT_TEXT =
  "Confirmo que envié el pago correspondiente a esta operación de intercambio P2P en Upping " +
  "y estoy conforme con los términos acordados. Entiendo que esta confirmación queda registrada " +
  "como parte del historial de la operación.";
