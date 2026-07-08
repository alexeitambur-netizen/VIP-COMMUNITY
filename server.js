const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Telegraf, Markup } = require('telegraf'); // Добавили Telegraf для управления ботом

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const parser = new Parser();

// ==================== КОНФИГ ====================
const MASTER_ADMIN = "5817328317";
const USERS_FILE = path.join(__dirname, 'allowed_users.json');
const BOT_TOKEN = "8988084203:AAGMNH763cv170X0lRGczjTwUY6Ir-TWlFI"; // Сюда вставь токен от BotFather

const bot = new Telegraf(BOT_TOKEN);
const allowedUsers = [];

// Ссылка на гифку, которую мы только что сжали (загрузи её в Telegram или укажи прямой URL)
const WELCOME_GIF_URL = "https://i.postimg.cc/85b5vE10/pocket-option.gif"; 

// ==================== ЛОГИКА ТЕЛЕГРАМ БОТА ====================

// Красивое приветствие при старте (/start) или нажатии Open
bot.start(async (ctx) => {
    const welcomeText = 
        `👋 *Привет, трейдер! Добро пожаловать в VIP Community!*\n\n` +
        `Здесь ты будешь получать наше обучение, приватные торговые инструменты и мощную аналитику рынка. 🚀\n\n` +
        `⚠️ *Важно:* Чтобы полноценно воспользоваться всеми функциями нашего бота, тебе необходимо зарегистрироваться по нашей партнерской ссылке.\n\n` +
        `Нажимай на кнопки ниже, проходи регистрацию и присоединяйся к команде!`;

    try {
        // Сначала отправляем сжатую анимацию (гифку)
        await ctx.replyWithAnimation(WELCOME_GIF_URL);
        
        // Затем отправляем текст с красивыми инлайн-кнопками
        await ctx.replyWithMarkdown(welcomeText, Markup.inlineKeyboard([
            [Markup.button.url('🔗 Зарегистрироваться по ссылке', 'https://u3.shortink.io/login?social=Google&utm_campaign=848628&utm_source=affiliate&utm_medium=sr&a=yueyrPjXG4Zw24&al=1774254&ac=alifavip&cid=963312')],
            [Markup.button.url('👨‍💻 Обратиться к администратору', 'https://t.me/alifavip')]
        ]));
    } catch (error) {
        console.error('[Bot Error] Ошибка отправки приветствия:', error.message);
    }
});

// Запуск бота в режиме long polling
bot.launch().then(() => {
    console.log('[Bot] Telegram бот успешно запущен и слушает команды');
}).catch((err) => {
    console.error('[Bot Init Error] Не удалось запустить бота:', err.message);
});

// ==================== PERSISTENCE ====================
function loadAllowedUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            allowedUsers.push(...JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')));
            console.log(`[Users] Загружено ${allowedUsers.length} пользователей из файла`);
        } else {
            allowedUsers.push("644265574", "5211910606", "987654321", MASTER_ADMIN);
            saveAllowedUsers();
            console.log('[Users] Создан новый файл allowed_users.json');
        }
    } catch (e) {
        console.error('[Users] Ошибка загрузки:', e.message);
        allowedUsers.push(MASTER_ADMIN);
    }
}

function saveAllowedUsers() {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(allowedUsers, null, 2));
    } catch (e) {
        console.error('[Users] Ошибка сохранения:', e.message);
    }
}

// ==================== ДАННЫЕ РЫНКА ====================
let currentPayouts = { 
    status: "ONLINE", 
    timestamp: Date.now(),
    categories: { currencies: [], crypto: [], commodities: [], stocks: [], indices: [] }
};

function isMaster(adminId) { return String(adminId) === MASTER_ADMIN; }
function normalizeId(id) { return String(id).trim(); }

// ==================== API ЭНДПОИНТЫ ====================
app.get('/', (req, res) => {
    res.send('<h1>VIP COMMUNITY PRO AI Backend — OK</h1>');
});

app.get('/api/check-access', (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ allowed: false, error: 'userId required' });
    const isAllowed = allowedUsers.some(id => normalizeId(id) === normalizeId(userId));
    res.json({ allowed: isAllowed });
});

app.get('/api/allowed-users', (req, res) => {
    res.json({ success: true, users: allowedUsers, count: allowedUsers.length, master: MASTER_ADMIN });
});

app.get('/api/payouts', (req, res) => { res.json(currentPayouts); });

app.post('/api/update-payouts', (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).json({ success: false, error: 'data required' });
    currentPayouts = { status: "ONLINE", timestamp: Date.now(), categories: data };
    res.json({ success: true });
});

app.post('/api/admin/add-user', (req, res) => {
    const { userId, adminId } = req.body;
    if (!adminId || !isMaster(adminId)) return res.status(403).json({ success: false, error: 'Только ROOT ADMIN' });
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

    const normalized = normalizeId(userId);
    if (!allowedUsers.includes(normalized)) {
        allowedUsers.push(normalized);
        saveAllowedUsers();
    }
    res.json({ success: true, users: allowedUsers });
});

app.post('/api/admin/remove-user', (req, res) => {
    const { userId, adminId } = req.body;
    if (!adminId || !isMaster(adminId)) return res.status(403).json({ success: false, error: 'Только ROOT ADMIN' });
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

    const normalized = normalizeId(userId);
    if (normalized === MASTER_ADMIN) return res.status(400).json({ success: false, error: 'Нельзя удалить ROOT' });

    allowedUsers = allowedUsers.filter(id => normalizeId(id) !== normalized);
    saveAllowedUsers();
    res.json({ success: true, users: allowedUsers });
});

// ==================== LIVE NEWS ====================
let cachedNews = [];
let lastNewsUpdate = 0;
const NEWS_CACHE_TTL = 2 * 60 * 1000;

const RSS_FEEDS = [
    "https://news.google.com/rss/search?q=forex+OR+crypto+OR+stock+market+OR+binary+options&hl=ru&gl=RU&ceid=RU:ru"
];

async function refreshNewsCache(force = false) {
    const now = Date.now();
    if (!force && (now - lastNewsUpdate < NEWS_CACHE_TTL) && cachedNews.length > 0) return;

    try {
        const allNews = [];
        let idCounter = 1000;
        for (const feedUrl of RSS_FEEDS) {
            try {
                const feed = await parser.parseURL(feedUrl);
                feed.items.slice(0, 8).forEach(item => {
                    allNews.push({
                        id: idCounter++,
                        title: (item.title || "Без заголовка").substring(0, 115),
                        pair: "Рынок • Новости",
                        text: (item.contentSnippet || item.title || "").substring(0, 165) + "...",
                        source: feed.title || "Финансовые новости",
                        category: "google",
                        time: "Недавно",
                        image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80",
                        link: item.link || "#"
                    });
                });
            } catch (e) {}
        }
        if (allNews.length > 0) {
            cachedNews = allNews.slice(0, 18);
            lastNewsUpdate = now;
        }
    } catch (err) {}
}

app.get('/api/news', async (req, res) => {
    await refreshNewsCache();
    res.json({ success: true, news: cachedNews });
});

// ==================== ЗАПУСК СЕРВЕРА ====================
app.listen(PORT, async () => {
    console.log(`VIP COMMUNITY Backend запущен на порту ${PORT}`);
    loadAllowedUsers();
    await refreshNewsCache(true);
});

// Мягкая остановка бота при выключении процесса
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
