const MINI_APP_URL = 'https://hippoundefined101r-spec.github.io/oneway-miniapp/autoblesk/v5/';
const DEFAULT_ADMIN_CHAT_ID = '6046743044';

async function tg(token, method, payload) {
  if (!token) throw new Error('BOT_TOKEN is missing');
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await r.json();
  if (!data.ok) throw new Error(`${method}: ${JSON.stringify(data)}`);
  return data.result;
}

function esc(v = '') {
  return String(v).replace(/[&<>]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[s]));
}

function leadText(d) {
  const car = d?.car_text || [d?.car?.make, d?.car?.model, d?.car?.year, d?.car?.color].filter(Boolean).join(' · ');
  const when = d?.when_text || [d?.date, d?.time].filter(Boolean).join(' · ') || 'уточнить';
  return [
    '🚘 <b>Новая заявка АВТОБЛЕСК</b>', '',
    `🚗 <b>Авто:</b> ${esc(car || 'не указано')}`,
    `🛠 <b>Услуга:</b> ${esc(d?.problem || 'не указано')}`,
    d?.note ? `📝 <b>Комментарий:</b> ${esc(d.note)}` : null,
    `📷 <b>Фото:</b> ${esc(d?.photos || 0)}`,
    `🕒 <b>Когда:</b> ${esc(when)}`, '',
    `👤 <b>Клиент:</b> ${esc(d?.name || 'не указано')}`,
    `📞 <b>Телефон:</b> ${esc(d?.phone || 'не указано')}`,
    `💬 <b>Связаться:</b> ${esc(d?.messenger || 'не указано')}`
  ].filter(Boolean).join('\n');
}

const cors = {
  'access-control-allow-origin': 'https://hippoundefined101r-spec.github.io',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type'
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (request.method === 'GET') {
      return Response.json({
        ok: true,
        service: 'AUTOBLESK bot worker',
        botTokenConfigured: Boolean(env.BOT_TOKEN),
        adminChatConfigured: Boolean(env.ADMIN_CHAT_ID || DEFAULT_ADMIN_CHAT_ID)
      }, { headers: cors });
    }

    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

    try {
      // Direct Mini App submission. This does not expose the bot token in the browser.
      if (url.pathname === '/lead') {
        const lead = await request.json();
        await tg(env.BOT_TOKEN, 'sendMessage', {
          chat_id: env.ADMIN_CHAT_ID || DEFAULT_ADMIN_CHAT_ID,
          text: leadText(lead),
          parse_mode: 'HTML'
        });
        return Response.json({ ok: true }, { headers: cors });
      }

      // Telegram webhook events.
      const update = await request.json();
      const msg = update.message;
      const text = msg?.text || '';

      if (/^\/start(?:@\w+)?(?:\s|$)/i.test(text)) {
        await tg(env.BOT_TOKEN, 'sendMessage', {
          chat_id: msg.chat.id,
          text: 'Добро пожаловать в АВТОБЛЕСК. Нажмите кнопку ниже, чтобы выбрать услугу и время.',
          reply_markup: {
            keyboard: [[{ text: '🚘 Записаться', web_app: { url: MINI_APP_URL } }]],
            resize_keyboard: true,
            is_persistent: true
          }
        });
      }

      if (msg?.web_app_data?.data) {
        let lead;
        try { lead = JSON.parse(msg.web_app_data.data); }
        catch { lead = { note: msg.web_app_data.data }; }
        await tg(env.BOT_TOKEN, 'sendMessage', {
          chat_id: env.ADMIN_CHAT_ID || DEFAULT_ADMIN_CHAT_ID,
          text: leadText(lead),
          parse_mode: 'HTML'
        });
        await tg(env.BOT_TOKEN, 'sendMessage', {
          chat_id: msg.chat.id,
          text: '✅ Заявка отправлена. С вами свяжутся для подтверждения.'
        });
      }

      return new Response('OK', { headers: cors });
    } catch (e) {
      console.error('Worker error:', e?.stack || String(e));
      return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500, headers: cors });
    }
  }
};