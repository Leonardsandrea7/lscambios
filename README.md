# LS Cambios P2P

Plataforma de intercambio P2P con red de liquidadores, reputación y colateral —
la base de código nueva, construida desde cero para reemplazar el modelo manual
de lscambios.com.

## Qué es esto exactamente

Un cliente crea una operación (ej. "vendo $50 por Binance"). La operación entra
a una cola. Un **liquidador** (no tú) la toma, comprometiendo colateral propio
como garantía. Si todo sale bien, se libera el colateral y sube su reputación.
Si hay una disputa, tú (admin) arbitras, y si el liquidador tuvo la culpa, pierde
parte de su colateral.

## 1. Instalación local

```bash
npm install
cp .env.example .env.local
```

## 2. Configurar Supabase

1. Crea un proyecto gratis en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor** → pega y ejecuta todo el contenido de `supabase/schema.sql`.
   Esto crea todas las tablas: perfiles, liquidadores, colateral, reputación,
   operaciones, chat, disputas.
3. Ve a **Project Settings → API** y copia las 3 keys a tu `.env.local`.
4. Activa **Email Auth** en Authentication → Providers (o el proveedor que prefieras).

## 3. Correr en desarrollo

```bash
npm run dev
```

Abre `http://localhost:3000`.

## 4. Estructura del proyecto

```
supabase/schema.sql        ← todo el modelo de datos (ejecutar primero)
lib/matching.ts             ← motor de matching + bloqueo/liberación de colateral
lib/reputation.ts           ← cálculo de score y eventos de reputación
lib/supabase.ts             ← clientes de Supabase (browser + servidor)
app/api/operations/         ← crear operación, listar cola
app/api/operations/[id]/    ← tomar operación, avanzar estados, completar
app/api/disputes/           ← abrir y resolver disputas
app/dashboard/               ← pantalla del cliente (crear operación)
app/liquidator/              ← pantalla del liquidador (cola + mis operaciones)
app/admin/disputes/          ← pantalla del admin (resolver disputas)
```

## 5. La máquina de estados (lo más importante de entender)

```
pending_match → matched → awaiting_payment → payment_sent →
liquidator_verifying → liquidator_paying → completed
```

En cualquier punto después de `matched`, puede pasar a `dispute_opened`.
Toda la lógica de transición vive en `app/api/operations/[id]/route.ts` —
es el archivo más importante para entender el flujo completo.

## 6. Lo que YA funciona en este scaffold

- ✅ Esquema completo de base de datos con RLS básico.
- ✅ Motor de matching: un liquidador puede "tomar" una operación de la cola,
  con verificación de colateral disponible y protección contra condiciones
  de carrera (dos liquidadores tomando la misma operación a la vez).
- ✅ Bloqueo, liberación y penalización (slash) de colateral.
- ✅ Cálculo de reputación con suspensión automática si la tasa de disputas
  es muy alta.
- ✅ Flujo completo de una operación de principio a fin vía API.
- ✅ Pantalla de cliente para crear operaciones.
- ✅ Pantalla de liquidador con cola de pedidos.
- ✅ Pantalla de admin para resolver disputas.

## 7. Lo que FALTA construir (siguiente sesión)

Esto es intencional — es mucho para un solo scaffold. Prioriza en este orden:

1. **Autenticación y registro real** (login/registro con Supabase Auth,
   páginas `app/login` y `app/register` están creadas como carpetas vacías).
2. **Onboarding de liquidador**: formulario para solicitar ser liquidador,
   depositar colateral inicial, y que tú lo apruebes (`status: pending → active`).
3. **Chat P2P en tiempo real**: usar Supabase Realtime sobre la tabla
   `chat_messages` (ya existe la tabla, falta la UI y la suscripción).
4. **KYC**: subida de selfie + cédula (puedes reusar el flujo que ya tenías
   en lscambios.com), guardando en `profiles.kyc_selfie_url`.
5. **API de tasas** (`/api/rates`): ahora mismo el dashboard del cliente usa
   una tasa fija de ejemplo (40 Bs/USD) — hay que conectarlo a la tabla `rates`.
6. **Notificaciones**: cuando cambia el estado de una operación, avisar por
   WhatsApp o push (puedes reusar tu integración de WhatsApp actual).
7. **Diseño visual**: estas pantallas son funcionales pero muy básicas
   (Tailwind sin estilizar a fondo) — falta pulir marca y UX.

## 8. Nota de cumplimiento

El sistema mantiene verificación de identidad (KYC) como parte del diseño,
a diferencia de plataformas "no-KYC". Esto es intencional: operas como casa
de cambio real con obligaciones legales, y un modelo sin ninguna verificación
te expone a riesgo de lavado de dinero. Si más adelante quieres explorar
verificación tipo "ZK-KYC" (verificar sin almacenar datos sensibles tú mismo),
es una fase posterior — no cambies esto sin asesoría legal primero.
