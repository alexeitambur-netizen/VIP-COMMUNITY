const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');
const { Telegraf, Markup } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');

// ==================== КОНФИГ (лучше всего хранить в .env) ====================
const PORT = process.env.PORT || 3000;

// Telegram
const BOT_TOKEN = process.env.BOT_TOKEN || "8988084203:AAGMNH763cv170X0lRGczjTwUY6Ir-TWlFI";
const WELCOME_GIF_URL = process.env.WELCOME_GIF_URL || "https://i.postimg.cc/ryWPSfVL/89a66af6cb2045bab65e10448563532b.gif";

// Supabase (рекомендуется использовать SERVICE_ROLE_KEY в продакшене!)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rjhnlzayhwidycqdroms.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_2BKzk8OP3abRq8l6wiLbkA_8fJFzh3x';

// Главный админ (ROOT)
const MASTER_ADMIN = process.env.MASTER_ADMIN || "5817328317";

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const parser = new Parser();
const bot = new Telegraf(BOT_TOKEN);

// ==================== SUPABASE ИНИЦИАЛИЗАЦИЯ (защищённая) ====================
let supabase = null;
let supabaseEnabled = false;

try {
    if (SUPABASE_URL && SUPABASE_KEY) {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        supabaseEnabled = true;
        log('Supabase клиент успешно инициализирован', 'SUPABASE');
    } else {
        log('Supabase ключи не найдены — работаем в режиме In-Memory', 'WARN');
    }
} catch (e) {
    log(`Не удалось инициализировать Supabase: ${e.message}`, 'ERROR');
    supabaseEnabled = false;
}

// In-memory кэш пользователей (для быстрых проверок)
let allowedUsers = [];

// In-memory кэш видеоуроков (fallback)
let cachedVideoLessons = [];

// ==================== ЛОГИРОВАНИЕ ====================
function log(message, type = 'INFO') {
    const time = new Date().toISOString();
    console.log(`[${time}] [${type}] ${message}`);
}

// ==================== SUPABASE — РАБОТА С ПОЛЬЗОВАТЕЛЯМИ ====================
async function loadAllowedUsers() {
    if (!supabaseEnabled || !supabase) {
        allowedUsers = [MASTER_ADMIN];
        log('Supabase отключён — загружен только MASTER_ADMIN', 'WARN');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('allowed_users')
            .select('user_id')
            .order('created_at', { ascending: true });

        if (error) throw error;

        allowedUsers = (data || []).map(row => row.user_id);

        if (allowedUsers.length === 0) {
            const defaults = ["644265574", "5211910606", "987654321", MASTER_ADMIN];
            for (const uid of defaults) {
                await supabase.from('allowed_users').upsert({ user_id: uid }, { onConflict: 'user_id' });
            }
            allowedUsers = defaults;
            log('Добавлены дефолтные пользователи в Supabase', 'SUPABASE');
        }

        log(`Загружено ${allowedUsers.length} пользователей из Supabase`, 'SUPABASE');
    } catch (e) {
        log(`Ошибка загрузки из Supabase: ${e.message} → работаем в памяти`, 'ERROR');
        allowedUsers = [MASTER_ADMIN];
    }
}

async function addUserToSupabase(userId) {
    const normalized = String(userId).trim();
    if (allowedUsers.includes(normalized)) {
        return { success: true, alreadyExists: true };
    }

    if (!supabaseEnabled || !supabase) {
        allowedUsers.push(normalized);
        log(`Пользователь ${normalized} добавлен (только в память)`, 'WARN');
        return { success: true, memoryOnly: true };
    }

    const { error } = await supabase
        .from('allowed_users')
        .upsert({ user_id: normalized }, { onConflict: 'user_id' });

    if (error) {
        log(`Ошибка добавления ${normalized} в Supabase: ${error.message}`, 'ERROR');
        return { success: false, error: error.message };
    }

    allowedUsers.push(normalized);
    log(`Пользователь ${normalized} добавлен в Supabase`, 'SUPABASE');
    return { success: true };
}

async function removeUserFromSupabase(userId) {
    const normalized = String(userId).trim();
    if (normalized === MASTER_ADMIN) {
        return { success: false, error: 'Нельзя удалить ROOT администратора' };
    }

    if (!supabaseEnabled || !supabase) {
        allowedUsers = allowedUsers.filter(id => id !== normalized);
        log(`Пользователь ${normalized} удалён (только из памяти)`, 'WARN');
        return { success: true, memoryOnly: true };
    }

    const { error } = await supabase
        .from('allowed_users')
        .delete()
        .eq('user_id', normalized);

    if (error) {
        log(`Ошибка удаления ${normalized} из Supabase: ${error.message}`, 'ERROR');
        return { success: false, error: error.message };
    }

    allowedUsers = allowedUsers.filter(id => id !== normalized);
    log(`Пользователь ${normalized} удалён из Supabase`, 'SUPABASE');
    return { success: true };
}

function isMaster(adminId) {
    return String(adminId) === MASTER_ADMIN;
}

function normalizeId(id) {
    return String(id).trim();
}

// ==================== SUPABASE — ВИДЕОУРОКИ ====================
async function loadVideoLessonsFromSupabase() {
    if (!supabaseEnabled || !supabase) {
        log('Supabase отключён — видеоуроки загружаются только из памяти/локально', 'WARN');
        return cachedVideoLessons;
    }

    try {
        const { data, error } = await supabase
            .from('video_lessons')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        cachedVideoLessons = (data || []).map(lesson => {
            return {
                ...lesson,
                desc: lesson.description || lesson.desc || lesson.описание || '',
                level: lesson.level || lesson.уровень || ''
            };
        });

        log(`Загружено ${cachedVideoLessons.length} видеоуроков из Supabase`, 'SUPABASE');
        return cachedVideoLessons;
    } catch (e) {
        log(`Ошибка загрузки видеоуроков из Supabase: ${e.message}`, 'ERROR');
        return cachedVideoLessons;
    }
}

async function saveVideoLessonToSupabase(lessonData) {
    if (!supabaseEnabled || !supabase) {
        const newLesson = {
            id: Date.now(),
            ...lessonData,
            created_at: new Date().toISOString()
        };
        cachedVideoLessons.unshift(newLesson);
        log('Видеоурок сохранён только в память (Supabase отключён)', 'WARN');
        return { success: true, memoryOnly: true, lesson: newLesson };
    }

    try {
        const { data, error } = await supabase
            .from('video_lessons')
            .insert([{
                title: lessonData.title,
                category: lessonData.category,
                duration: lessonData.duration || '',
                level: lessonData.level || lessonData.уровень || '',
                description: lessonData.description || lessonData.desc || '',
                youtube: lessonData.youtube
            }])
            .select()
            .single();

        if (error) {
            log(`БД Ошибка вставки: ${JSON.stringify(error)}`, 'ERROR');
            throw error;
        }

        await loadVideoLessonsFromSupabase();
        log(`Видеоурок "${lessonData.title}" успешно сохранён в Supabase`, 'SUPABASE');
        return { success: true, lesson: data };
    } catch (e) {
        log(`Ошибка сохранения видеоурока: ${e.message || JSON.stringify(e)}`, 'ERROR');
        return { success: false, error: e.message || JSON.stringify(e) };
    }
}

// ==================== TELEGRAM БОТ ====================
bot.start(async (ctx) => {
    const welcomeText = 
        `👋 *Привет, трейдер! Добро пожаловать в VIP Community!* 💎\n\n` +
        `Здесь тебя ждет мощная аналитика рынка, приватное обучение и лучшие торговые инструменты. 🚀\n\n` +
        `⚠️ *Важно:* Чтобы получить полный доступ к боту и начать зарабатывать с командой, тебе необходимо обязательно зарегистрироваться по нашей ссылке на Pocket Option.\n\n` +
        `Нажимай на кнопку ниже, регистрируйся и пиши администратору для подтверждения!`;

    try {
        await ctx.replyWithAnimation(WELCOME_GIF_URL);
        await ctx.replyWithMarkdown(welcomeText, Markup.inlineKeyboard([
            [Markup.button.url('🔗 Зарегистрироваться в Pocket Option', 'https://u3.shortink.io/login?social=Google&utm_campaign=848628&utm_source=affiliate&utm_medium=sr&a=yueyrPjXG4Zw24&al=1774254&ac=alifavip&cid=963312')],
            [Markup.button.url('👨‍💻 Написать Администратору VIP', 'https://t.me/alifavip')]
        ]));
    } catch (error) {
        log(`Ошибка отправки приветствия: ${error.message}`, 'ERROR');
    }
});

bot.command('help', (ctx) => {
    ctx.replyWithMarkdown(
        `📋 *Доступные команды:*\n\n` +
        `/start — приветствие и регистрация\n` +
        `/myid — узнать свой Telegram ID\n` +
        `/help — эта справка`
    );
});

bot.command('myid', (ctx) => {
    ctx.reply(`Ваш Telegram ID: \`${ctx.from.id}\``);
});

bot.launch()
    .then(() => log('Telegram бот успешно запущен', 'BOT'))
    .catch((err) => log(`Ошибка запуска бота: ${err.message}`, 'ERROR'));

// ==================== ОСНОВНЫЕ ЭНДПОИНТЫ ====================
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'VIP COMMUNITY PRO AI Backend',
        version: '2.1-video-lessons-fixed',
        endpoints: [
            '/api/check-access', 
            '/api/allowed-users', 
            '/api/admin/add-user', 
            '/api/admin/remove-user', 
            '/api/video-lessons',
            '/api/news', 
            '/api/news/refresh', 
            '/api/health'
        ]
    });
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: Date.now(), 
        usersLoaded: allowedUsers.length,
        videoLessonsLoaded: cachedVideoLessons.length,
        supabaseEnabled 
    });
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
        count: allowedUsers.length,
        users: allowedUsers,
        master: MASTER_ADMIN
    });
});

// ==================== ВИДЕОУРОКИ — ЭНДПОИНТЫ ====================

app.get('/api/video-lessons', async (req, res) => {
    try {
        const lessons = await loadVideoLessonsFromSupabase();
        res.json({ 
            success: true, 
            count: lessons.length, 
            lessons: lessons,
            source: supabaseEnabled ? 'supabase' : 'memory'
        });
    } catch (e) {
        log(`Ошибка GET /api/video-lessons: ${e.message}`, 'ERROR');
        res.status(500).json({ success: false, error: e.message, lessons: cachedVideoLessons });
    }
});

app.post('/api/video-lessons', async (req, res) => {
    const { title, category, duration, level, description, desc, youtube, adminId } = req.body;

    if (adminId && !isMaster(adminId)) {
        return res.status(403).json({ 
            success: false, 
            error: 'Только ROOT ADMIN может добавлять видеоуроки' 
        });
    }

    if (!title || !category || !youtube) {
        return res.status(400).json({ 
            success: false, 
            error: 'Обязательные поля: title, category, youtube' 
        });
    }

    const lessonData = {
        title: String(title).trim(),
        category: String(category).trim(),
        duration: duration ? String(duration).trim() : '',
        level: level ? String(level).trim() : '',
        description: description || desc || '',
        youtube: String(youtube).trim()
    };

    const result = await saveVideoLessonToSupabase(lessonData);

    if (!result.success) {
        return res.status(500).json({ success: false, error: result.error || 'Ошибка сохранения (проверьте RLS политики в Supabase)' });
    }

    res.json({ 
        success: true, 
        lesson: result.lesson,
        message: result.memoryOnly 
            ? 'Сохранено только в память сервера (Supabase отключён)' 
            : 'Видеоурок сохранён глобально в Supabase'
    });
});

app.delete('/api/video-lessons/:id', async (req, res) => {
    const { id } = req.params;
    const adminId = req.body?.adminId || req.query?.adminId;

    if (adminId && !isMaster(adminId)) {
        return res.status(403).json({ success: false, error: 'Только ROOT ADMIN может удалять видеоуроки' });
    }

    if (!supabaseEnabled || !supabase) {
        cachedVideoLessons = cachedVideoLessons.filter(l => String(l.id) !== String(id));
        return res.json({ success: true, message: 'Удалено из памяти' });
    }

    try {
        const { error } = await supabase
            .from('video_lessons')
            .delete()
            .eq('id', id);

        if (error) throw error;

        await loadVideoLessonsFromSupabase();
        res.json({ success: true, message: 'Видеоурок удалён из Supabase' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ==================== АДМИН ЭНДПОИНТЫ ====================
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

    res.json({ success: true, users: allowedUsers, alreadyExists: !!result.alreadyExists });
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

app.post('/api/add-user', async (req, res) => {
    req.body.adminId = MASTER_ADMIN;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

    await addUserToSupabase(userId);
    res.json({ success: true, users: allowedUsers, note: 'Используйте /api/admin/add-user' });
});

app.post('/api/remove-user', async (req, res) => {
    req.body.adminId = MASTER_ADMIN;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

    await removeUserFromSupabase(userId);
    res.json({ success: true, users: allowedUsers });
});

// ==================== PAYOUTS ====================
let currentPayouts = {
    status: "ONLINE",
    timestamp: Date.now(),
    categories: { currencies: [], crypto: [], commodities: [], stocks: [], indices: [] }
};

app.get('/api/payouts', (req, res) => res.json(currentPayouts));

app.post('/api/update-payouts', (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).json({ success: false, error: 'data required' });

    currentPayouts = { status: "ONLINE", timestamp: Date.now(), categories: data };
    log('Данные выплат обновлены', 'MARKET');
    res.json({ success: true });
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
    if (!force && (now - lastNewsUpdate < NEWS_CACHE_TTL) && cachedNews.length > 0) return;

    try {
        const allNews = [];
        let idCounter = 1000;

        for (const feedUrl of RSS_FEEDS) {
            try {
                const feed = await parser.parseURL(feedUrl);
                feed.items.slice(0, 8).forEach(item => {
                    const pubDate = new Date(item.pubDate || Date.now());
                    const timeAgo = getTimeAgo(pubDate);
                    const content = ((item.title || "") + " " + (item.contentSnippet || "")).toLowerCase();

                    let category = "google";
                    if (content.includes("crypto") || content.includes("bitcoin") || content.includes("ethereum") || content.includes("solana")) category = "tv";
                    else if (content.includes("pocket option") || content.includes("binary option")) category = "pocket";

                    allNews.push({
                        id: idCounter++,
                        title: (item.title || "Без заголовка").substring(0, 115),
                        pair: "Рынок • Новости",
                        text: (item.contentSnippet || item.title || "").replace(/<[^>]+>/g, '').substring(0, 165) + "...",
                        source: feed.title || "Финансовые новости",
                        category,
                        time: timeAgo,
                        image: item.enclosure?.url || item.thumbnail || "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80",
                        full: (item.contentSnippet || item.title || "").replace(/<[^>]+>/g, ''),
                        link: item.link || "#"
                    });
                });
            } catch (_) {}
        }

        if (allNews.length > 0) {
            cachedNews = allNews.slice(0, 18);
            lastNewsUpdate = now;
            log(`Кэш новостей обновлён: ${cachedNews.length} новостей`, 'NEWS');
        }
    } catch (err) {
        log(`Ошибка обновления новостей: ${err.message}`, 'ERROR');
    }
}

function getTimeAgo(date) {
    const diffMin = Math.floor((new Date() - date) / 60000);
    if (diffMin < 1) return "только что";
    if (diffMin < 60) return `${diffMin} мин назад`;
    const diffH = Math.floor(diffMin / 60);
    return diffH < 24 ? `${diffH} ч назад` : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

app.get('/api/news', async (req, res) => {
    await refreshNewsCache();
    res.json({ success: true, lastUpdated: lastNewsUpdate, count: cachedNews.length, news: cachedNews });
});

app.post('/api/news/refresh', async (req, res) => {
    await refreshNewsCache(true);
    res.json({ success: true, lastUpdated: lastNewsUpdate, count: cachedNews.length, message: "Новости обновлены" });
});

// ==================== ЗАПУСК ====================
app.listen(PORT, async () => {
    log('==================================================', 'START');
    log(`VIP COMMUNITY PRO AI Backend запущен на порту ${PORT}`, 'START');
    log(`Supabase: ${supabaseEnabled ? 'ВКЛЮЧЁН' : 'ОТКЛЮЧЁН (работа в памяти)'}`, 'START');
    log('==================================================', 'START');

    await loadAllowedUsers();
    await loadVideoLessonsFromSupabase();
    await refreshNewsCache(true);
    setInterval(() => refreshNewsCache(), NEWS_CACHE_TTL);
});

// Корректное завершение
process.once('SIGINT', () => { bot.stop('SIGINT'); log('Бот остановлен (SIGINT)', 'SHUTDOWN'); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); log('Бот остановлен (SIGTERM)', 'SHUTDOWN'); });
