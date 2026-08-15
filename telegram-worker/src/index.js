const MINI_APP_URL = 'https://hippoundefined101r-spec.github.io/oneway-miniapp/autoblesk/v4/';

async function tg(token, method, payload) {
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
  const car = [d?.car?.make, d?.car?.model, d?.car?.year, d?.car?.color].filter(Boolean).join(' · ');
  const when = [d?.date, d?.time].filter(Boolean).join(' · ') || 'уточнить';
  return [
    '🚘 <b>Новая заявка АВТОБЛЕСК</b>',
    '',
    `🚗 <b>Авто:</b> ${esc(car || 'не указано')}`,
    `🛠 <b>Услуга:</b> ${esc(d?.problem || 'не указано')}`,
    d?.note ? `📝 <b>Комментарий:</b> ${esc(d.note)}` : null,
    `📷 <b>Фото:</b> ${esc(d?.photos || 0)}`,
    `🕒 <b>Когда:</b> ${esc(when)}`,
    '',
    `👤 <b>Клиент:</b> ${esc(d?.name || 'не указано')}`,
    `📞 <b>Телефон:</b> ${esc(d?.phone || 'не указано')}`,
    `💬 <b>Связаться:</b> ${esc(d?.messenger || 'не указано')}`
  ].filter(Boolean).join('\n');
}

export default {
  async fetch(request, env) {
    if (request.method === 'GET') return new Response('AUTOBLESK bot worker: OK');
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    const update = await request.json();
    const msg = update.message;

    try {
      if (msg?.text === '/start') {
        await tg(env.BOT_TOKEN, 'sendMessage', {
          chat_id: msg.chat.id,
          text: 'Добро пожаловать в АВТОБЛЕСК. Нажмите кнопку ниже, чтобы выбрать услугу и время.',
          reply_markup: {
            keyboard: [[{ text: '🚘 Записаться', web_app: { url: MINI_APP_URL } }]],
            resize_keyboard: true
          }
        });
      }

      if (msg?.web_app_data?.data) {
        let lead;
        try { lead = JSON.parse(msg.web_app_data.data); }
        catch { lead = { note: msg.web_app_data.data }; }

        await tg(env.BOT_TOKEN, 'sendMessage', {
          chat_id: env.ADMIN_CHAT_ID,
          text: leadText(lead),
          parse_mode: 'HTML'
        });

        await tg(env.BOT_TOKEN, 'sendMessage', {
          chat_id: msg.chat.id,
          text: '✅ Заявка отправлена. С вами свяжутся для подтверждения.'
        });
      }
    } catch (e) {
      console.error(e);
    }

    return new Response('OK');
  }
};