"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const RATE = 40.15;

export default function HomePage() {
  const [amount, setAmount] = useState("50");
  const [methodIn, setMethodIn] = useState("USDT");
  const [ticketId, setTicketId] = useState("OP-000000");

  useEffect(() => {
    setTicketId("OP-" + Math.floor(100000 + Math.random() * 900000));
  }, []);

  const received = (parseFloat(amount) || 0) * RATE;

  return (
    <>
      <nav>
        <div className="wrap">
          <div className="logo"><span className="dot"></span>Upping</div>
          <div className="nav-links">
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#seguridad">Seguridad</a>
            <a href="#metodos">Métodos</a>
          </div>
          <Link href="/dashboard" className="nav-cta">Crear cuenta</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="wrap">
          <div className="hero-copy">
            <span className="eyebrow">Fiat ⇄ USDT</span>
            <h1>Cambiar jamás <em>fue tan fácil.</em></h1>
            <p className="lede">
              Compra y vende USDT en minutos. Cada operación queda respaldada por un
              proveedor verificado, con liquidez propia comprometida hasta que confirmas
              que todo salió bien.
            </p>
            <div className="hero-ctas">
              <Link href="/dashboard" className="btn-primary">Empezar a cambiar →</Link>
              <Link href="/register-provider" className="btn-ghost">Registrarme como cajero</Link>
            </div>
          </div>

          <div className="ticket-stage">
            <div className="ticket">
              <div className="seal"><span>LIQUIDEZ<br />VERIFICADA</span></div>
              <div className="ticket-head">
                <span className="brand">Upping</span>
                <span className="id">{ticketId}</span>
              </div>
              <div className="tear"></div>
              <div className="ticket-body">
                <div className="field-row">
                  <label>Envías</label>
                  <div className="field-input">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      inputMode="decimal"
                    />
                    <select value={methodIn} onChange={(e) => setMethodIn(e.target.value)}>
                      <option>USDT</option>
                      <option>PayPal</option>
                      <option>Binance</option>
                      <option>Zinli</option>
                      <option>Airtm</option>
                    </select>
                  </div>
                </div>
                <div className="field-row receives">
                  <label>Recibes</label>
                  <div className="field-input">
                    <input
                      type="text"
                      readOnly
                      value={received.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    />
                    <select disabled><option>Bs</option></select>
                  </div>
                </div>
                <div className="rate-line">
                  <span>Tasa aplicada</span>
                  <span>1 {methodIn} ≈ {RATE.toFixed(2)} Bs</span>
                </div>
                <Link href="/dashboard" className="ticket-cta" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                  Cambiar ahora
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="protect">
        <div className="wrap">
          <div className="protect-item">
            <span className="mark">01</span>
            <div>
              <h3>Proveedores verificados</h3>
              <p>Cada proveedor tiene historial público: operaciones completadas, calificación y liquidez disponible.</p>
            </div>
          </div>
          <div className="protect-item">
            <span className="mark">02</span>
            <div>
              <h3>Liquidez comprometida</h3>
              <p>El dinero se bloquea desde que aceptan tu operación — antes de que envíes un pago.</p>
            </div>
          </div>
          <div className="protect-item">
            <span className="mark">03</span>
            <div>
              <h3>Nunca sin garantía</h3>
              <p>Tu operación no se libera hasta que confirmas que recibiste tu pago completo.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="como-funciona">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">El proceso</span>
            <h2>Cuatro pasos y listo.</h2>
            <p>Simple de principio a fin, sin vueltas.</p>
          </div>
          <div className="steps">
            <div className="step">
              <div className="num">01</div>
              <h3>Eliges monto y método</h3>
              <p>Tú decides cuánto y por dónde.</p>
            </div>
            <div className="step">
              <div className="num">02</div>
              <h3>Un proveedor la acepta</h3>
              <p>Confirma la operación al instante.</p>
            </div>
            <div className="step">
              <div className="num">03</div>
              <h3>Haces tu pago</h3>
              <p>Envías y confirmas dentro del chat.</p>
            </div>
            <div className="step">
              <div className="num">04</div>
              <h3>Recibes tu USDT</h3>
              <p>Se libera apenas confirmas. Listo.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section security" id="seguridad">
        <div className="wrap">
          <div className="security-copy">
            <span className="eyebrow">Por qué confiar</span>
            <h2>Cada proveedor tiene algo real en juego.</h2>
            <p>
              <strong>No es una promesa, es dinero comprometido.</strong> Antes de aceptar tu
              operación, el proveedor ya bloqueó la liquidez que te va a pagar. Su historial
              es público, así que ves con quién estás tratando antes de empezar.
            </p>
          </div>
          <div className="liq-card">
            <span className="example-tag">Ejemplo de perfil de proveedor</span>
            <div className="liq-top">
              <span className="liq-name">María G. ✓</span>
              <span className="liq-stars">★★★★★</span>
            </div>
            <div className="liq-stats">
              <div className="liq-stat"><div className="v">$420</div><div className="l">Liquidez disponible</div></div>
              <div className="liq-stat"><div className="v">128</div><div className="l">Operaciones completadas</div></div>
              <div className="liq-stat"><div className="v">0</div><div className="l">Disputas perdidas</div></div>
              <div className="liq-stat"><div className="v">4 min</div><div className="l">Respuesta promedio</div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="metodos">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">Métodos soportados</span>
            <h2>Entra y sal por donde ya operas.</h2>
          </div>
          <div className="methods-grid">
            <div className="method-chip">PayPal</div>
            <div className="method-chip">Binance</div>
            <div className="method-chip">Zinli</div>
            <div className="method-chip">Wally</div>
            <div className="method-chip">Airtm</div>
            <div className="method-chip">USDT</div>
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="wrap">
          <span className="eyebrow">Empieza hoy</span>
          <h2>Tu próximo cambio, con alguien que responde.</h2>
          <Link href="/dashboard" className="btn-primary">Crear cuenta gratis →</Link>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="logo"><span className="dot"></span>Upping</div>
          <div className="foot-links">
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#seguridad">Seguridad</a>
            <Link href="/register-provider">Ser cajero</Link>
            <Link href="/admin/disputes">Admin</Link>
          </div>
          <span style={{ fontSize: 13, color: "var(--ink-faint)" }}>© 2026 Upping</span>
        </div>
      </footer>
    </>
  );
}
