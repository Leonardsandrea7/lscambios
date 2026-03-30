export default async function handler(req, res) {
  const { record } = req.body; 
  const TOKEN = process.env.TELEGRAM_ADMIN_TOKEN;
  const CHAT_ID = process.env.MI_CHAT_ID;

  const texto = 💬 *Nuevo mensaje P2P*\n\n +
                👤 *Usuario:* ${record.usuario_nombre || 'Cliente'}\n +
                ✉️ *Mensaje:* ${record.contenido};

  await fetch(https://api.telegram.org/bot${TOKEN}/sendMessage, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: texto,
      parse_mode: 'Markdown'
    })
  });

  return res.status(200).json({ status: 'ok' });
}
