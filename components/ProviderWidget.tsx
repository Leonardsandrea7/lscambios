"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase";

type Operation = {
  id: string;
  kind: "buy" | "sell";
  payment_method_id: string;
  amount_sent: number;
  amount_received: number;
  status: string;
};

type ProviderInfo = {
  id: string;
  status: string;
  spread_bps: number;
  paypal_email: string | null;
};

type Collateral = {
  total_balance: number;
  locked_balance: number;
};

/**
 * Widget embebible del cajero. Pensado para vivir dentro de una sola
 * pantalla después de iniciar sesión — no es una página aparte con
 * navegación propia, es el panel de control completo del cajero.
 */
export default function ProviderWidget() {
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [collateral, setCollateral] = useState<Collateral | null>(null);
  const [queue, setQueue] = useState<Operation[]>([]);
  const [myOps, setMyOps] = useState<Operation[]>([]);
  const [spreadInput, setSpreadInput] = useState("");
  const [savingSpread, setSavingSpread] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const supabase = getBrowserClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }

    const { data: liq } = await supabase
      .from("liquidators")
      .select("id, status, spread_bps, paypal_email")
      .eq("profile_id", userData.user.id)
      .single();

    if (liq) {
      setProvider(liq);
      setSpreadInput((liq.spread_bps / 100).toString());

      const { data: acc } = await supabase
        .from("collateral_accounts")
        .select("total_balance, locked_balance")
        .eq("liquidator_id", liq.id)
        .maybeSingle();
      if (acc) setCollateral(acc);
    }

    const res = await fetch("/api/operations?status=pending_match");
    const { operations } = await res.json();
    setQueue(operations ?? []);
    setLoading(false);
  }

  async function handleClaim(operationId: string) {
    if (!provider) return;
    setClaiming(operationId);
    try {
      const res = await fetch(`/api/operations/${operationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim", liquidatorId: provider.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQueue((prev) => prev.filter((op) => op.id !== operationId));
      setMyOps((prev) => [...prev, data.operation]);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setClaiming(null);
    }
  }

  async function handleSaveSpread() {
    if (!provider) return;
    const bps = Math.round(parseFloat(spreadInput) * 100);
    if (isNaN(bps) || bps < 0) return;

    setSavingSpread(true);
    const res = await fetch(`/api/providers/${provider.id}/spread`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spreadBps: bps }),
    });
    const data = await res.json();
    setSavingSpread(false);
    if (!res.ok) {
      alert(data.error);
      return;
    }
    setProvider((prev) => (prev ? { ...prev, spread_bps: bps } : prev));
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Cargando tu panel…</div>;

  if (!provider) {
    return (
      <div className="p-6 text-sm text-gray-500">
        No encontramos una cuenta de cajero para este usuario.{" "}
        <a href="/register-provider" className="underline">Regístrate aquí</a>.
      </div>
    );
  }

  if (provider.status === "pending") {
    return (
      <div className="p-6 max-w-md mx-auto text-center space-y-2">
        <p className="text-lg font-medium">Tu cuenta está en revisión</p>
        <p className="text-sm text-gray-500">
          Te avisaremos apenas quede aprobada. Correo PayPal registrado: {provider.paypal_email}
        </p>
      </div>
    );
  }

  const available = collateral ? collateral.total_balance - collateral.locked_balance : 0;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Panel de Cajero</h1>

      {/* Balance */}
      <section className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Disponible</p>
          <p className="text-2xl font-semibold">${available.toFixed(2)}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Bloqueado</p>
          <p className="text-2xl font-semibold">${(collateral?.locked_balance ?? 0).toFixed(2)}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total</p>
          <p className="text-2xl font-semibold">${(collateral?.total_balance ?? 0).toFixed(2)}</p>
        </div>
      </section>

      {/* Spread */}
      <section className="border rounded-lg p-4 flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">
            Tu spread (%)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="10"
            value={spreadInput}
            onChange={(e) => setSpreadInput(e.target.value)}
            className="w-full border rounded-md p-2"
          />
        </div>
        <button
          onClick={handleSaveSpread}
          disabled={savingSpread}
          className="px-4 py-2 rounded-md bg-black text-white text-sm disabled:opacity-50"
        >
          {savingSpread ? "Guardando…" : "Guardar"}
        </button>
      </section>
      <p className="text-xs text-gray-500 -mt-6">
        Un spread más bajo te hace aparecer primero en la cola para los clientes.
      </p>

      {/* Cola de operaciones */}
      <section>
        <h2 className="text-lg font-medium mb-3">Operaciones disponibles</h2>
        {queue.length === 0 && (
          <p className="text-sm text-gray-500">No hay operaciones pendientes por ahora.</p>
        )}
        <ul className="space-y-3">
          {queue.map((op) => (
            <li key={op.id} className="border rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {op.kind === "sell" ? "Cliente vende" : "Cliente compra"} — {op.payment_method_id}
                </p>
                <p className="text-sm text-gray-500">
                  Envía ${op.amount_sent} · Recibe ${op.amount_received}
                </p>
              </div>
              <button
                onClick={() => handleClaim(op.id)}
                disabled={claiming === op.id}
                className="px-4 py-2 rounded-md bg-black text-white text-sm disabled:opacity-50"
              >
                {claiming === op.id ? "Tomando…" : "Tomar"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Mis operaciones activas</h2>
        {myOps.length === 0 && (
          <p className="text-sm text-gray-500">Aún no has tomado ninguna operación.</p>
        )}
        <ul className="space-y-3">
          {myOps.map((op) => (
            <li key={op.id} className="border rounded-lg p-4">
              <p className="font-medium">{op.payment_method_id} — ${op.amount_sent}</p>
              <p className="text-sm text-gray-500">Estado: {op.status}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
