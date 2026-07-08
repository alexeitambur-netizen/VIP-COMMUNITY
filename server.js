const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); // for potential future Telegram hash verification

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const parser = new Parser();

// ==================== КОНФИГ ====================
const MASTER_ADMIN = "5817328317";
const USERS_FILE = path.join(__dirname, 'allowed_users.json');

// Белый список (персистентный)
let allowedUsers = [];

// ==================== PERSISTENCE ====================
function loadAllowedUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            allowedUsers = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
            console.log(`[Users] Загружено ${allowedUsers.length} пользователей из файла`);
        } else {
            allowedUsers = ["644265574", "5211910606", "987654321", MASTER_ADMIN];
            saveAllowedUsers();
            console.log('[Users] Создан новый файл allowed_users.json');
        }
    } catch (e) {
        console.error('[Users] Ошибка загрузки:', e.message);
        allowedUsers = [MASTER_ADMIN];
    }
}

function saveAllowedUsers() {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(allowedUsers, null, 2));
    } catch (e) {
        console.error('[Users] Ошибка сохранения:', e.message);
    }
}

// ==================== TELEGRAM INITDATA VERIFICATION (опционально, задел на будущее) ====================
// Если хочешь включить проверку настоящего Telegram пользователя — передавай initData и используй verifyTelegramInitData
function verifyTelegramInitData(initData, botToken) {
    // Полная реализация проверки hash (HMAC-SHA256) initData
    // Пока закомментировано, т.к. требует BOT_TOKEN
    // Можно активировать позже для максимальной безопасности
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

// Проверка доступа (используется в HTML)
app.get('/api/check-access', (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ allowed: false, error: 'userId required' });

    const isAllowed = allowedUsers.some(id => normalizeId(id) === normalizeId(userId));
    res.json({ allowed: isAllowed });
});

// Получение текущего списка разрешённых пользователей (для админ-панелей)
app.get('/api/allowed-users', (req, res) => {
    res.json({ 
        success: true, 
        users: allowedUsers,
        count: allowedUsers.length,
        master: MASTER_ADMIN
    });
});

// Получение выплат
app.get('/api/payouts', (req, res) => {
    res.json(currentPayouts);
});

// Обновление выплат от Python (оставлено для совместимости)
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

// Добавление пользователя (вызывается из HTML Admin Panel / Developer Panel)
app.post('/api/admin/add-user', (req, res) => {
    const { userId, adminId } = req.body;

    if (!adminId || !isMaster(adminId)) {
        return res.status(403).json({ success: false, error: 'Только ROOT ADMIN может добавлять пользователей' });
    }
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

    const normalized = normalizeId(userId);
    if (!allowedUsers.includes(normalized)) {
        allowedUsers.push(normalized);
        saveAllowedUsers();
        console.log(`[Admin] Пользователь ${normalized} добавлен ROOT'ом`);
    }

    res.json({ success: true, users: allowedUsers });
});

// Удаление пользователя
app.post('/api/admin/remove-user', (req, res) => {
    const { userId, adminId } = req.body;

    if (!adminId || !isMaster(adminId)) {
        return res.status(403).json({ success: false, error: 'Только ROOT ADMIN может удалять пользователей' });
    }
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

    const normalized = normalizeId(userId);
    if (normalized === MASTER_ADMIN) {
        return res.status(400).json({ success: false, error: 'Нельзя удалить ROOT администратора' });
    }

    allowedUsers = allowedUsers.filter(id => normalizeId(id) !== normalized);
    saveAllowedUsers();

    console.log(`[Admin] Пользователь ${normalized} удалён ROOT'ом`);
    res.json({ success: true, users: allowedUsers });
});

// ==================== СТАРЫЕ ЭНДПОИНТЫ (для обратной совместимости со старыми версиями HTML) ====================
app.post('/api/add-user', (req, res) => {
    // Автоматически подставляем MASTER_ADMIN для совместимости
    req.body.adminId = MASTER_ADMIN;
    // Перенаправляем логику
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

    const normalized = normalizeId(userId);
    if (!allowedUsers.includes(normalized)) {
        allowedUsers.push(normalized);
        saveAllowedUsers();
    }
    res.json({ success: true, users: allowedUsers, note: 'Используйте /api/admin/add-user для явной проверки' });
});

app.post('/api/remove-user', (req, res) => {
    req.body.adminId = MASTER_ADMIN;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

    const normalized = normalizeId(userId);
    if (normalized === MASTER_ADMIN) {
        return res.status(400).json({ success: false, error: 'Нельзя удалить ROOT' });
    }
    allowedUsers = allowedUsers.filter(id => normalizeId(id) !== normalized);
    saveAllowedUsers();
    res.json({ success: true, users: allowedUsers });
});

// ==================== LIVE NEWS (реал-тайм обновления) ====================
let cachedNews = [];
let lastNewsUpdate = 0;
const NEWS_CACHE_TTL = 2 * 60 * 1000; // 2 минуты — более свежие новости

const RSS_FEEDS = [
    "https://news.google.com/rss/search?q=forex+OR+crypto+OR+stock+market+OR+binary+options&hl=ru&gl=RU&ceid=RU:ru",
    "https://www.investing.com/rss/news.rss",
    "https://rss.app/feeds/v1.1/5qQ2vN2vN2vN2vN2vN2vN2vN2.rss" // запасной (можно заменить)
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
                // тихо пропускаем проблемный фид
            }
        }

        if (allNews.length > 0) {
            cachedNews = allNews.slice(0, 18);
            lastNewsUpdate = now;
            console.log(`[News] Кэш обновлён: ${cachedNews.length} новостей (реал-тайм)`);
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

// Получение новостей (клиент вызывает каждые 90 сек)
app.get('/api/news', async (req, res) => {
    await refreshNewsCache();
    res.json({
        success: true,
        lastUpdated: lastNewsUpdate,
        count: cachedNews.length,
        news: cachedNews
    });
});

// Принудительное обновление новостей (можно вызывать из Developer Panel)
app.post('/api/news/refresh', async (req, res) => {
    await refreshNewsCache(true);
    res.json({ 
        success: true, 
        lastUpdated: lastNewsUpdate, 
        count: cachedNews.length,
        message: "Новости обновлены в реальном времени"
    });
});

// ==================== ЗАПУСК ====================
app.listen(PORT, async () => {
    console.log(`==================================================`);
    console.log(` VIP COMMUNITY PRO AI Backend запущен на порту ${PORT}`);
    console.log(` Master Admin: ${MASTER_ADMIN}`);
    console.log(` Persistence: allowed_users.json`);
    console.log(` News cache: 2 минуты + принудительный refresh`);
    console.log(`==================================================`);
    
    loadAllowedUsers();
    await refreshNewsCache(true);
    setInterval(() => refreshNewsCache(), 2 * 60 * 1000); // авто-обновление каждые 2 минуты
});
