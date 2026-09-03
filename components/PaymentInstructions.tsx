"use client";

import { useState } from "react";
import { buildPaymentMemo } from "@/lib/paymentMemo";

export default function PaymentInstructions(params: {
  amount: number;
  currency: string;
  clientEmail: string;
  operationNumber: string;
}) {
  const [copied, setCopied] = useState(false);
  const memo = buildPaymentMemo(params);

  async function handleCopy() {
    await navigator.clipboard.writeText(memo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
      <p className="text-sm font-medium">
        Copia este mensaje en la nota de tu pago de PayPal:
      </p>
      <p className="text-sm bg-white border rounded-md p-3 font-mono">{memo}</p>
      <button
        onClick={handleCopy}
        className="text-sm px-4 py-2 rounded-md bg-black text-white"
      >
        {copied ? "¡Copiado!" : "Copiar mensaje"}
      </button>
      <p className="text-xs text-gray-500">
        Este mensaje deja un registro claro de tu operación — inclúyelo tal
        cual en la nota del pago.
      </p>
    </div>
  );
}
