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

## 8. Liquidez on-chain con MetaMask (contracts/)

Esta es la pieza nueva: los proveedores fondean desde su propia wallet, no
desde tu base de datos. El contrato `UppingEscrow.sol` maneja depósito,
bloqueo y liberación de fondos.

### Probar en TESTNET (obligatorio antes de mainnet)

```bash
npm install
npx hardhat compile

# 1. Despliega un token de prueba (USDT falso) en Base Sepolia
npx hardhat run scripts/deploy-mock-usdt.js --network baseSepolia
# copia la dirección que imprime

# 2. Pega esa dirección en scripts/deploy.js (USDT_ADDRESSES.baseSepolia)
#    y despliega el contrato de escrow:
npm run deploy:testnet
# copia la dirección del contrato a NEXT_PUBLIC_ESCROW_ADDRESS en .env.local
```

Necesitas Base Sepolia ETH de prueba (gratis) para pagar el gas — hay
faucets públicos, busca "Base Sepolia faucet".

### ⚠️ Antes de ir a mainnet con dinero real

1. Prueba el flujo completo en testnet: depósito, varias operaciones,
   liberación, y al menos una disputa forzada.
2. Lee las notas al final de `UppingEscrow.sol` — señalan explícitamente
   qué falta (verificación por firma del proveedor en vez de confiar en el
   backend, límite de tiempo por operación) antes de considerarlo listo
   para producción.
3. Considera una auditoría de seguridad externa. El contrato maneja fondos
   reales de terceros — no solo tuyos.
4. Cuando estés listo: `npm run deploy:mainnet` (usa la dirección real de
   USDT en Base, no la de prueba).

## 8. Cómo y cuándo ganas tú (comisión)

**Respuesta corta: te quedas con tu % automáticamente, dentro del mismo contrato, en el instante en que se libera cada operación — no tienes que cobrar nada a mano.**

Ejemplo con una comisión de 1.5% (`PLATFORM_FEE_BPS=150`, el valor por defecto):

1. Un proveedor acepta una operación de **$100 USDT**.
2. Al aceptarla (`lockForOperation`), el contrato calcula tu comisión de una vez:
   `$100 × 1.5% = $1.50`. Esto queda guardado en la operación, no se puede cambiar después.
3. El proveedor confirma que el pago llegó y libera los fondos (`releaseToClient`).
4. **En esa misma transacción**, el contrato manda `$1.50` a tu wallet de tesorería
   (`TREASURY_ADDRESS`) y `$98.50` al cliente. Automático, sin que tú hagas nada.

Puedes ver tu ganancia acumulada de dos formas:
- **En la blockchain**, revisando las transferencias a tu `TREASURY_ADDRESS` (verdad absoluta).
- **En Supabase**, en la tabla `platform_revenue` — una copia rápida para reportes, que se
  llena cada vez que tu backend detecta un evento `OperationReleased` (ver nota abajo).

**Ajustar tu comisión más adelante:** no necesitas redesplegar nada. Llama a
`setPlatformFee(nuevoBps)` desde la wallet que desplegó el contrato, y aplica a
partir de la siguiente operación (las que ya están en curso mantienen la comisión
con la que se crearon — eso es intencional, para que nadie vea cambiar las reglas
a mitad de una operación que ya aceptó).

**Nota importante — dos sistemas en paralelo:** ahora mismo tienes dos formas de
llevar el registro de una operación: las tablas de Supabase (`collateral_accounts`,
etc., construidas cuando el plan era 100% base de datos) y el contrato on-chain
(`UppingEscrow.sol`, para el modelo con MetaMask). Todavía no están conectados
entre sí — hace falta un "listener" que escuche los eventos del contrato
(`OperationLocked`, `OperationReleased`, etc.) y actualice Supabase automáticamente,
para que tu panel de admin y tus reportes siempre reflejen lo que realmente pasó
en la blockchain. Es el siguiente paso técnico importante, y toca cuando quieras
seguir.

## 10. Registro de cajeros y protección anti-fraude

### Cómo se registra un cajero

`app/register-provider/page.tsx` — flujo de 2 pasos:
1. Crea cuenta con correo + contraseña (Supabase Auth).
2. Confirma su correo de PayPal — **debe ser exactamente el mismo** que el de registro.

Si no coincide, `app/api/providers/register/route.ts`:
- Rechaza el registro con el mensaje "Correo no compatible".
- Guarda la alerta en `fraud_flags`.
- Crea una notificación en `admin_alerts` para que la revises.

También bloquea que dos cuentas reclamen el mismo correo de PayPal
(`duplicate_paypal_email`).

**Por qué importa:** el fraude típico contra cajeros es pedir que le paguen
a un correo de PayPal distinto al de su cuenta — casi siempre porque esa
segunda cuenta no es realmente del cliente. Forzar que coincidan cierra
esa puerta desde el registro, no después de que ya se perdió dinero.

### El widget del cajero

`components/ProviderWidget.tsx` — todo el panel del cajero en un solo
componente: balance (disponible / bloqueado / total), su spread (con
guardado inmediato vía `/api/providers/[id]/spread`), y la cola de
operaciones para tomar. `app/liquidator/page.tsx` ahora es solo el marco
que lo monta.

### Cómo afecta el spread al matching

En `lib/matching.ts`, `findEligibleLiquidators` ahora ordena a los cajeros
elegibles por spread más bajo primero (mejor precio para el cliente), y
usa la reputación como desempate. Esto hace real la frase "un spread más
bajo te hace aparecer primero" que ve el cajero en su panel.

### Pendiente para conectar con el admin

`admin_alerts` hoy es solo una tabla — te falta una pantalla que la lea
(similar a `app/admin/disputes/page.tsx`) y, más adelante, conectarla a
WhatsApp o email para que te enteres sin tener que entrar al panel.

## 12. Distribución de trades (aleatorio → pool general)

Al crear una operación, `assignRandomProvider` (en `lib/matching.ts`) la
asigna al azar a UN cajero elegible, con 2 minutos (`ASSIGNMENT_WINDOW_MS`)
para tomarla antes de que pase al pool general visible para todos
(`expireStaleAssignments`, llamado automáticamente cada vez que se consulta
la cola).

Mientras está en fase `assigned`, solo el cajero asignado puede tomarla —
`app/api/operations/[id]/route.ts` lo valida en la acción `claim`. Si nadie
la toma a tiempo, pasa a `pool_stage = 'general'` y cualquier cajero
elegible puede tomarla (ordenados por spread y reputación, como ya
funcionaba).

**Nota de producción:** la expiración es "perezosa" — se revisa cuando
alguien consulta la cola, no con un reloj real corriendo en el fondo. Para
que sea puntual incluso sin tráfico, conviene moverla a un cron real
(pg_cron en Supabase o un Edge Function programado cada minuto).

## 13. Memo de pago y constancia del cliente

`lib/paymentMemo.ts` — lee los comentarios del archivo, son importantes.

Formato del memo (se muestra al cliente justo después de crear su
operación, en `app/dashboard/page.tsx`, con botón de copiar vía
`components/PaymentInstructions.tsx`):

```
USD 8.00, desde mi cuenta: cliente@correo.com, por la operación de Upping #A1B2C3D4.
Inicié esta operación en mi dispositivo sin influencia externa.
```

Es transparente (dice que es una operación de Upping, no la disfraza) y
la frase final ayuda contra un vector de fraude real: alguien que reclama
después que "lo obligaron" a pagar (ingeniería social).

Flujo real dentro de la app (`app/dashboard/page.tsx`):
1. Cliente crea la operación → ve el memo para copiar en PayPal (`PaymentInstructions`).
2. Clic en "Ya realicé el pago" → aparece el documento de consentimiento
   (`components/ConsentDocument.tsx`): monto, fecha, el texto de
   confirmación, y un campo para escribir su nombre completo como firma.
3. Al firmar, se guarda en `operation_acknowledgments` y la operación
   avanza a verificación del cajero.

Para consultar la constancia firmada de cualquier operación (evidencia
completa: monto, fecha, nombre, texto exacto que confirmó):
`GET /api/operations/[id]/receipt`.

Resumen honesto de qué logra y qué no:

- **Lo que construí:** al marcar "pago enviado", el cliente debe escribir
  su nombre completo. Eso se guarda en `operation_acknowledgments` junto
  con un texto fijo de confirmación. Es un registro con fecha de que el
  cliente confirmó el pago y estuvo de acuerdo con la operación.
- **Para qué sirve de verdad:** evidencia para tus disputas internas
  (sección 5), y para que el cajero tenga algo concreto que mostrar si
  necesita reportar un caso de fraude real ante PayPal.
- **Lo que NO hace:** no le da a Upping ni al cajero ninguna autoridad
  sobre la cuenta de PayPal del cliente. PayPal no es parte de este
  acuerdo y sus disputas se resuelven con sus propias reglas,
  independientemente de lo que diga este documento.
- **Riesgo a evitar:** si el memo que le pides al cliente describe la
  operación como algo distinto de lo que es (para "camuflarla"), eso
  puede leerse como violación de los Términos de Uso de PayPal — el
  resultado más probable no es "protección", es que le congelen la
  cuenta al cajero. `buildPaymentMemo()` describe la operación tal como
  es (intercambio P2P), a propósito.

Esto no es asesoría legal — si quieres blindarte más en serio contra
disputas de PayPal, vale la pena consultar con un abogado que conozca
los términos de PayPal para negocios en tu país.

## 15. Registro de cliente y wallet vinculada

Igual que con el correo de PayPal de los cajeros, ahora el **cliente**
también fija su wallet (o pago móvil) una sola vez, en
`app/register-client/page.tsx` → `app/api/clients/register-wallet/route.ts`.

Cuando crea un trade, `app/api/operations/route.ts` compara el destino
contra `profiles.wallet_address`. Si no coincide, bloquea la operación,
guarda la alerta en `fraud_flags` (`wallet_mismatch`) y notifica en
`admin_alerts` — mismo mecanismo que ya tenías para los cajeros, ahora
también del lado del cliente.

## 16. Dashboard estilo neobanco

`app/dashboard/page.tsx` — rediseñado de cero como una sola tarjeta tipo
app bancaria: monto que envías, lo que recibes calculado en vivo, botón
"Aplicar". El flujo completo:

1. **Aplicar** → crea la operación y entra en modo "Buscando cajero…"
   (con polling simple cada 3 segundos a `GET /api/operations/[id]`).
2. Cuando el estado cambia (un cajero la tomó), aparece el **memo para
   copiar** en la nota de PayPal/Zinli/Wally — generado por
   `buildPaymentMemo()` con el formato exacto que pediste: monto,
   nombre, correo, ID de operación, y la declaración de voluntad propia.
3. El cliente firma escribiendo su nombre → se guarda en
   `operation_acknowledgments` y pasa a verificación del cajero.

**Nota de producción:** el polling cada 3 segundos funciona para probar,
pero para muchos usuarios simultáneos conviene cambiarlo a Supabase
Realtime (suscripción a cambios en la tabla `operations`) en vez de
seguir preguntando cada pocos segundos.

## 17. Nota de cumplimiento

El sistema mantiene verificación de identidad (KYC) como parte del diseño,
a diferencia de plataformas "no-KYC". Esto es intencional: operas como casa
de cambio real con obligaciones legales, y un modelo sin ninguna verificación
te expone a riesgo de lavado de dinero. Si más adelante quieres explorar
verificación tipo "ZK-KYC" (verificar sin almacenar datos sensibles tú mismo),
es una fase posterior — no cambies esto sin asesoría legal primero.
