"use client";

import { useEffect, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase";
import { buildPaymentMemo } from "@/lib/paymentMemo";

const METHODS = [
  { id: "paypal", label: "PayPal" },
  { id: "zinli", label: "Zinli" },
  { id: "wally", label: "Wally" },
];

const RATE = 40.15; // placeholder — reemplazar por /api/rates

type Phase = "form" | "waiting_match" | "memo" | "signed" | "done";

export default function NeobankDashboard() {
  const [profile, setProfile] = useState<{ full_name: string; wallet_address: string; email: string } | null>(null);
  const [amount, setAmount] = useState("50");
  const [method, setMethod] = useState(METHODS[0].id);
  const [phase, setPhase] = useState<Phase>("form");
  const [operationId, setOperationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [signature, setSignature] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const received = (parseFloat(amount) || 0) * RATE;
  const operationNumber = operationId ? operationId.slice(0, 8).toUpperCase() : "";

  useEffect(() => {
    loadProfile();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function loadProfile() {
    const supabase = getBrowserClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data } = await supabase
      .from("profiles")
      .select("full_name, wallet_address")
      .eq("id", userData.user.id)
      .single();
    setProfile({
      full_name: data?.full_name ?? "",
      wallet_address: data?.wallet_address ?? "",
      email: userData.user.email ?? "",
    });
    setSignature(data?.full_name ?? "");
  }

  async function handleApply() {
    setError(null);
    if (!profile?.wallet_address) {
      setError("Primero registra tu wallet en /register-client.");
      return;
    }

    const supabase = getBrowserClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const amountSent = Number(amount);

    const res = await fetch("/api/operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: userData.user.id,
        kind: "sell",
        paymentMethodId: method,
        amountSent,
        amountReceived: amountSent * RATE,
        rateApplied: RATE,
        payoutDestination: profile.wallet_address,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }

    setOperationId(data.operation.id);
    setPhase("waiting_match");
    startPolling(data.operation.id);
  }

  function startPolling(id: string) {
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/operations/${id}`);
      const data = await res.json();
      if (data.operation && data.operation.status !== "pending_match") {
        setPhase("memo");
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 3000);
  }

  async function handleCopyMemo() {
    if (!profile || !operationId) return;
    const memo = buildPaymentMemo({
      amount: Number(amount),
      currency: "USD",
      fullName: profile.full_name,
      email: profile.email,
      operationNumber,
    });
    await navigator.clipboard.writeText(memo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSign() {
    if (!operationId) return;
    const res = await fetch(`/api/operations/${operationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_payment_sent", clientFullName: signature }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setPhase("signed");
  }

  const memoText = profile && operationId
    ? buildPaymentMemo({
        amount: Number(amount),
        currency: "USD",
        fullName: profile.full_name,
        email: profile.email,
        operationNumber,
      })
    : "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 via-white to-purple-50 flex items-start justify-center py-10 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <p className="text-xl font-serif italic">Upping</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-purple-100 p-6 space-y-5 border border-gray-100">
          {phase === "form" && (
            <>
              <p className="text-xs uppercase tracking-wide text-gray-400">Envías</p>
              <div className="flex items-center justify-between border-b pb-3">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-3xl font-semibold w-2/3 outline-none"
                />
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="text-sm font-semibold bg-gray-100 rounded-full px-3 py-1.5"
                >
                  {METHODS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>

              <p className="text-xs uppercase tracking-wide text-gray-400 pt-2">Recibes</p>
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-3xl font-semibold text-teal-600">
                  {received.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-sm font-semibold bg-gray-100 rounded-full px-3 py-1.5">USDT</span>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 break-all">
                Destino: {profile?.wallet_address || "— registra tu wallet en /register-client —"}
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                onClick={handleApply}
                className="w-full py-3 rounded-full bg-gradient-to-r from-teal-500 to-purple-600 text-white font-semibold shadow-lg shadow-purple-200"
              >
                Aplicar
              </button>
            </>
          )}

          {phase === "waiting_match" && (
            <div className="text-center py-10 space-y-3">
              <div className="w-10 h-10 mx-auto rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
              <p className="font-medium">Buscando cajero…</p>
              <p className="text-xs text-gray-400">Tu operación entró a la pool. Esto no debería tardar mucho.</p>
            </div>
          )}

          {phase === "memo" && (
            <div className="space-y-4">
              <p className="font-medium text-center">¡Un cajero tomó tu operación!</p>
              <p className="text-xs text-gray-500 text-center">
                Copia este mensaje en la nota de tu pago de {METHODS.find((m) => m.id === method)?.label}:
              </p>
              <p className="text-xs bg-gray-50 border rounded-xl p-3 font-mono leading-relaxed">{memoText}</p>
              <button
                onClick={handleCopyMemo}
                className="w-full py-2 rounded-full border border-gray-300 text-sm font-medium"
              >
                {copied ? "¡Copiado!" : "Copiar mensaje"}
              </button>

              <div className="pt-2 border-t space-y-2">
                <p className="text-xs text-gray-500">Después de pagar, firma para confirmar:</p>
                <input
                  type="text"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="Nombre del titular de la cuenta"
                  className="w-full border rounded-xl p-2 text-sm font-serif italic"
                />
                <button
                  onClick={handleSign}
                  disabled={signature.trim().length < 3}
                  className="w-full py-3 rounded-full bg-gradient-to-r from-teal-500 to-purple-600 text-white font-semibold disabled:opacity-50"
                >
                  Ya pagué, firmar y confirmar
                </button>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          )}

          {phase === "signed" && (
            <div className="text-center py-10 space-y-2">
              <p className="text-3xl">✓</p>
              <p className="font-medium">Confirmado</p>
              <p className="text-xs text-gray-400">
                Tu cajero está verificando el pago. Recibirás tu USDT en cuanto confirme.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
