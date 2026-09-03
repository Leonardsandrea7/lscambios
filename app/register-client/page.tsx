"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase";

type Step = "account" | "wallet";

export default function RegisterClientPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [wallet, setWallet] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreateAccount() {
    setError(null);
    setLoading(true);
    const supabase = getBrowserClient();
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError || !data.user) {
      setError(signUpError?.message ?? "No se pudo crear la cuenta.");
      setLoading(false);
      return;
    }

    setStep("wallet");
    setLoading(false);
  }

  async function handleRegisterWallet() {
    setError(null);
    setLoading(true);
    const supabase = getBrowserClient();
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      setError("Sesión no encontrada. Intenta de nuevo.");
      setLoading(false);
      return;
    }

    await supabase.from("profiles").update({ full_name: fullName }).eq("id", userData.user.id);

    const res = await fetch("/api/clients/register-wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userData.user.id, walletAddress: wallet }),
    });

    const result = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(result.error);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Crear cuenta</h1>

      {step === "account" && (
        <div className="space-y-4">
          <input
            type="email"
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-md p-2"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-md p-2"
          />
          <button
            onClick={handleCreateAccount}
            disabled={loading || !email || !password}
            className="w-full py-2 rounded-md bg-black text-white disabled:opacity-50"
          >
            {loading ? "Creando cuenta…" : "Continuar"}
          </button>
        </div>
      )}

      {step === "wallet" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Esta wallet quedará fija en tu cuenta. Si en un trade intentas recibir en una
            wallet distinta, la operación se bloqueará automáticamente — es para protegerte
            a ti y a los cajeros.
          </p>
          <input
            type="text"
            placeholder="Nombre completo (para el memo de pago)"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full border rounded-md p-2"
          />
          <input
            type="text"
            placeholder="Dirección de wallet (0x...) o pago móvil"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            className="w-full border rounded-md p-2"
          />
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
              {error}
            </p>
          )}
          <button
            onClick={handleRegisterWallet}
            disabled={loading || !wallet || !fullName}
            className="w-full py-2 rounded-md bg-black text-white disabled:opacity-50"
          >
            {loading ? "Guardando…" : "Confirmar y entrar"}
          </button>
        </div>
      )}
    </div>
  );
}
