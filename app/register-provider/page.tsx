"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase";

type Step = "account" | "paypal" | "done";

export default function RegisterProviderPage() {
  const [step, setStep] = useState<Step>("account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
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

    setStep("paypal");
    setLoading(false);
  }

  async function handleRegisterProvider() {
    setError(null);
    setLoading(true);
    const supabase = getBrowserClient();
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      setError("Sesión no encontrada. Intenta iniciar sesión de nuevo.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/providers/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: userData.user.id,
        registrationEmail: email,
        paypalEmail,
        paymentMethods: ["paypal"],
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setStep("done");
    setLoading(false);
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Registro de cajero</h1>

      {step === "account" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Este será tu correo de cuenta. Debe ser el mismo correo con el que
            recibes pagos en PayPal — lo vamos a verificar en el siguiente paso.
          </p>
          <input
            type="email"
            placeholder="Correo (el mismo de tu PayPal)"
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

      {step === "paypal" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Confirma tu correo de PayPal. <strong>Debe ser exactamente el mismo</strong>{" "}
            que usaste para registrarte ({email}).
          </p>
          <input
            type="email"
            placeholder="Correo de PayPal"
            value={paypalEmail}
            onChange={(e) => setPaypalEmail(e.target.value)}
            className="w-full border rounded-md p-2"
          />
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
              {error}
            </p>
          )}
          <button
            onClick={handleRegisterProvider}
            disabled={loading || !paypalEmail}
            className="w-full py-2 rounded-md bg-black text-white disabled:opacity-50"
          >
            {loading ? "Verificando…" : "Confirmar y enviar a revisión"}
          </button>
        </div>
      )}

      {step === "done" && (
        <div className="text-center space-y-2">
          <p className="text-lg font-medium">¡Listo! 🎉</p>
          <p className="text-sm text-gray-500">
            Tu solicitud está en revisión. Te avisamos cuando quede aprobada
            para que empieces a operar.
          </p>
        </div>
      )}
    </div>
  );
}
