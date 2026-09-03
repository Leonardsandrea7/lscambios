"use client";

import { useState } from "react";
import { CLIENT_ACKNOWLEDGMENT_TEXT } from "@/lib/paymentMemo";

export default function ConsentDocument(params: {
  operationId: string;
  operationNumber: string;
  amount: number;
  currency: string;
  onSigned: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSign() {
    if (fullName.trim().length < 3) {
      setError("Escribe tu nombre completo para firmar.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/operations/${params.operationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_payment_sent", clientFullName: fullName }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }
    params.onSigned();
  }

  const today = new Date().toLocaleDateString("es-VE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="border rounded-lg p-6 space-y-4 bg-white">
      <div className="text-center border-b pb-4">
        <p className="text-xs uppercase tracking-wide text-gray-500">Upping</p>
        <h2 className="text-lg font-semibold">Constancia de pago</h2>
        <p className="text-xs text-gray-500">
          Operación #{params.operationNumber} · {today}
        </p>
      </div>

      <div className="text-sm text-gray-700 space-y-2">
        <p>
          Monto: <strong>{params.currency} {params.amount.toFixed(2)}</strong>
        </p>
        <p className="leading-relaxed">{CLIENT_ACKNOWLEDGMENT_TEXT}</p>
      </div>

      <div>
        <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">
          Escribe tu nombre completo para firmar
        </label>
        <input
          type="text"
          placeholder="Nombre y apellido"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full border rounded-md p-2 font-serif italic text-lg"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handleSign}
        disabled={submitting}
        className="w-full py-2 rounded-md bg-black text-white disabled:opacity-50"
      >
        {submitting ? "Firmando…" : "Firmar y confirmar pago"}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Esta firma queda guardada con fecha como parte del historial de tu operación.
      </p>
    </div>
  );
}
