const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); // for potential future Telegram hash verification
const { Telegraf, Markup } = require('telegraf'); // Подключили Telegraf
const { createClient } = require('@supabase/supabase-js'); // Supabase для хранения allowed users

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const parser = new Parser();

// ==================== КОНФИГ ====================
const MASTER_ADMIN = "5817328317";

// Твой токен от BotFather (замени на настоящий)
const BOT_TOKEN = "8988084203:AAGMNH763cv170X0lRGczjTwUY6Ir-TWlFI"; 

// Ссылка на приветственную GIF-анимацию (внешняя, postimg.cc)
const WELCOME_GIF_URL = "https://i.postimg.cc/ryWPSfVL/89a66af6cb2045bab65e10448563532b.gif";

// ==================== SUPABASE CONFIG ====================
const SUPABASE_URL = 'https://rjhnlzayhwidycqdroms.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2BKzk8OP3abRq8l6wiLbkA_8fJFzh3x';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const bot = new Telegraf(BOT_TOKEN);

// Белый список (персистентный)
let allowedUsers = [];

// ==================== ЛОГИКА ТЕЛЕГРАМ БОТА ====================

bot.start(async (ctx) => {
    const welcomeText = 
        `👋 *Привет, трейдер! Добро пожаловать в VIP Community!* 💎\n\n` +
        `Здесь тебя ждет мощная аналитика рынка, приватное обучение и лучшие торговые инструменты. 🚀\n\n` +
        `⚠️ *Важно:* Чтобы получить полный доступ к боту и начать зарабатывать с командой, тебе необходимо обязательно зарегистрироваться по нашей ссылке на Pocket Option.\n\n` +
        `Нажимай на кнопку ниже, регистрируйся и пиши администратору для подтверждения!`;

    try {
        // Отправляем приветственную GIF-анимацию по URL (внешняя ссылка)
        await ctx.replyWithAnimation(WELCOME_GIF_URL);
        
        // Отправляем текст с красивыми кнопками-ссылками
        await ctx.replyWithMarkdown(welcomeText, Markup.inlineKeyboard([
            [Markup.button.url('🔗 Зарегистрироваться в Pocket Option', 'https://u3.shortink.io/login?social=Google&utm_campaign=848628&utm_source=affiliate&utm_medium=sr&a=yueyrPjXG4Zw24&al=1774254&ac=alifavip&cid=963312')],
            [Markup.button.url('👨‍💻 Написать Администратору VIP', 'https://t.me/alifavip')]
        ]));
    } catch (error) {
        console.error('[Bot Error] Не удалось отправить приветствие:', error.message);
    }
});

// Запуск бота
bot.launch().then(() => {
    console.log('[Bot] Telegram бот успешно запущен и обрабатывает /start');
}).catch((err) => {
    console.error('[Bot Init Error] Ошибка запуска бота:', err.message);
});

// ==================== SUPABASE PERSISTENCE (замена file-based на БД) ====================
async function loadAllowedUsers() {
    try {
        const { data, error } = await supabase
            .from('allowed_users')
            .select('user_id')
            .order('created_at', { ascending: true });

        if (error) throw error;

        allowedUsers = data.map(row => row.user_id);

        // Если база пустая — добавляем дефолтных пользователей (один раз)
        if (allowedUsers.length === 0) {
            const defaultUsers = ["644265574", "5211910606", "987654321", MASTER_ADMIN];
            for (const uid of defaultUsers) {
                await supabase.from('allowed_users').insert({ user_id: uid }).select();
            }
            allowedUsers = defaultUsers;
            console.log('[Users] Добавлены дефолтные пользователи в Supabase');
        }

        console.log(`[Users] Загружено ${allowedUsers.length} пользователей из Supabase`);
    } catch (e) {
        console.error('[Users] Ошибка загрузки из Supabase:', e.message);
        allowedUsers = [MASTER_ADMIN];
    }
}

async function addUserToSupabase(userId) {
    const normalized = normalizeId(userId);
    if (allowedUsers.includes(normalized)) return { success: true, alreadyExists: true };

    const { error } = await supabase
        .from('allowed_users')
        .insert({ user_id: normalized });

    if (error) {
        console.error('[Supabase] Ошибка добавления пользователя:', error.message);
        return { success: false, error: error.message };
    }

    allowedUsers.push(normalized);
    console.log(`[Admin] Пользователь ${normalized} добавлен в Supabase`);
    return { success: true };
}

async function removeUserFromSupabase(userId) {
    const normalized = normalizeId(userId);
    if (normalized === MASTER_ADMIN) {
        return { success: false, error: 'Нельзя удалить ROOT администратора' };
    }

    const { error } = await supabase
        .from('allowed_users')
        .delete()
        .eq('user_id', normalized);

    if (error) {
        console.error('[Supabase] Ошибка удаления пользователя:', error.message);
        return { success: false, error: error.message };
    }

    allowedUsers = allowedUsers.filter(id => normalizeId(id) !== normalized);
    console.log(`[Admin] Пользователь ${normalized} удалён из Supabase`);
    return { success: true };
}

// ==================== TELEGRAM INITDATA VERIFICATION ====================
function verifyTelegramInitData(initData, botToken) {
    return true; // заглушка
}

// ==================== ДАННЫЕ РЫНКА ====================
let currentPayouts = { 
    status: "ONLINE", 
    timestamp: Date.now(),
    categories: {
        currencies: [],
        crypto: [],
        commodities: [],
        stocks: [],
        indices: []
    }
};

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function isMaster(adminId) {
    return String(adminId) === MASTER_ADMIN;
}

function normalizeId(id) {
    return String(id).trim();
}

// ==================== ОСНОВНЫЕ ЭНДПОИНТЫ ====================

app.get('/', (req, res) => {
    res.send('<h1>VIP COMMUNITY PRO AI Backend — OK</h1><p>Endpoints: /api/check-access, /api/allowed-users, /api/admin/add-user, /api/admin/remove-user, /api/news, /api/news/refresh</p>');
});

app.get('/api/check-access', (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ allowed: false, error: 'userId required' });

    const isAllowed = allowedUsers.some(id => normalizeId(id) === normalizeId(userId));
    res.json({ allowed: isAllowed });
});

app.get('/api/allowed-users', (req, res) => {
    res.json({ 
        success: true, 
        users: allowedUsers,
        count: allowedUsers.length,
        master: MASTER_ADMIN
    });
});

app.get('/api/payouts', (req, res) => {
    res.json(currentPayouts);
});

app.post('/api/update-payouts', (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).json({ success: false, error: 'data required' });

    currentPayouts = {
        status: "ONLINE",
        timestamp: Date.now(),
        categories: data
    };
    console.log('[Market] Данные обновлены от Python');
    res.json({ success: true });
});

// ==================== АДМИН ЭНДПОИНТЫ (защищённые) ====================

app.post('/api/admin/add-user', async (req, res) => {
    const { userId, adminId } = req.body;

    if (!adminId || !isMaster(adminId)) {
        return res.status(403).json({ success: false, error: 'Только ROOT ADMIN может добавлять пользователей' });
    }
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

    const result = await addUserToSupabase(userId);
    if (!result.success) {
        return res.status(500).json({ success: false, error: result.error });
    }

    res.json({ success: true, users: allowedUsers, alreadyExists: result.alreadyExists || false });
});

app.post('/api/admin/remove-user', async (req, res) => {
    const { userId, adminId } = req.body;

    if (!adminId || !isMaster(adminId)) {
        return res.status(403).json({ success: false, error: 'Только ROOT ADMIN может удалять пользователей' });
    }
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

    const result = await removeUserFromSupabase(userId);
    if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true, users: allowedUsers });
});

// ==================== СТАРЫЕ ЭНДПОИНТЫ ====================
app.post('/api/add-user', async (req, res) => {
    req.body.adminId = MASTER_ADMIN;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

    await addUserToSupabase(userId);
    res.json({ success: true, users: allowedUsers, note: 'Используйте /api/admin/add-user для явной проверки' });
});

app.post('/api/remove-user', async (req, res) => {
    req.body.adminId = MASTER_ADMIN;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

    await removeUserFromSupabase(userId);
    res.json({ success: true, users: allowedUsers });
});

// ==================== LIVE NEWS ====================
let cachedNews = [];
let lastNewsUpdate = 0;
const NEWS_CACHE_TTL = 2 * 60 * 1000;

const RSS_FEEDS = [
    "https://news.google.com/rss/search?q=forex+OR+crypto+OR+stock+market+OR+binary+options&hl=ru&gl=RU&ceid=RU:ru",
    "https://www.investing.com/rss/news.rss"
];

async function refreshNewsCache(force = false) {
    const now = Date.now();
    if (!force && (now - lastNewsUpdate < NEWS_CACHE_TTL) && cachedNews.length > 0) {
        return;
    }

    try {
        const allNews = [];
        let idCounter = 1000;

        for (const feedUrl of RSS_FEEDS) {
            try {
                const feed = await parser.parseURL(feedUrl);
                
                feed.items.slice(0, 8).forEach(item => {
                    const pubDate = new Date(item.pubDate || Date.now());
                    const timeAgo = getTimeAgo(pubDate);
                    
                    let category = "google";
                    const content = ((item.title || "") + " " + (item.contentSnippet || "")).toLowerCase();
                    if (content.includes("crypto") || content.includes("bitcoin") || content.includes("ethereum") || content.includes("solana")) {
                        category = "tv";
                    } else if (content.includes("pocket option") || content.includes("binary option")) {
                        category = "pocket";
                    }

                    allNews.push({
                        id: idCounter++,
                        title: (item.title || "Без заголовка").substring(0, 115),
                        pair: "Рынок • Новости",
                        text: (item.contentSnippet || item.title || "").replace(/<[^>]+>/g, '').substring(0, 165) + "...",
                        source: feed.title || "Финансовые новости",
                        category: category,
                        time: timeAgo,
                        image: item.enclosure?.url || item.thumbnail || "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80",
                        full: (item.contentSnippet || item.title || "").replace(/<[^>]+>/g, ''),
                        link: item.link || "#"
                    });
                });
            } catch (feedErr) {
                // тихо пропускаем
            }
        }

        if (allNews.length > 0) {
            cachedNews = allNews.slice(0, 18);
            lastNewsUpdate = now;
            console.log(`[News] Кэш обновлён: ${cachedNews.length} новостей`);
        }
    } catch (err) {
        console.error("[News] Ошибка обновления кэша:", err.message);
    }
}

function getTimeAgo(date) {
    const now = new Date();
    const diffMin = Math.floor((now - date) / 60000);
    if (diffMin < 1) return "только что";
    if (diffMin < 60) return `${diffMin} мин назад`;
    const diffH = Math.floor(diffMin / 60);
    return diffH < 24 ? `${diffH} ч назад` : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

app.get('/api/news', async (req, res) => {
    await refreshNewsCache();
    res.json({
        success: true,
        lastUpdated: lastNewsUpdate,
        count: cachedNews.length,
        news: cachedNews
    });
});

app.post('/api/news/refresh', async (req, res) => {
    await refreshNewsCache(true);
    res.json({ 
        success: true, 
        lastUpdated: lastNewsUpdate, 
        count: cachedNews.length,
        message: "Новости обновлены"
    });
});

// ==================== ЗАПУСК ====================
app.listen(PORT, async () => {
    console.log(`==================================================`);
    console.log(` VIP COMMUNITY PRO AI Backend запущен на порту ${PORT}`);
    console.log(`==================================================`);
    
    await loadAllowedUsers();
    await refreshNewsCache(true);
    setInterval(() => refreshNewsCache(), 2 * 60 * 1000);
});

// Корректное завершение работы бота при рестарте сервера
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
