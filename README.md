# VIP-COMMUNITY

Торговый сканер берёт живые пары и свечи Pocket Option через этот же сервер.

На Render, в Environment сервиса, добавь `GROQ_API_KEY` (ключ `gsk_…`, без кавычек). Фронт на Vercel ходит в `SERVER_URL` из `index.html` (`https://vip-community.onrender.com`): `/api/payouts`, `/api/candles`, `/api/ai-chat`.

После деплоя сервера выполни `npm install`, чтобы поставилась зависимость `ws`.