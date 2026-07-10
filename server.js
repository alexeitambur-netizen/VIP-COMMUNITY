const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');
const { Telegraf, Markup } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');

// ==================== КОНФИГ ====================
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN || "8988084203:AAGMNH763cv170X0lRGczjTwUY6Ir-TWlFI";
const WELCOME_GIF_URL = process.env.WELCOME_GIF_URL || "https://i.postimg.cc/ryWPSfVL/89a66af6cb2045bab65e10448563532b.gif";

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rjhnlzayhwidycqdroms.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_2BKzk8OP3abRq8l6wiLbkA_8fJFzh3x';

const MASTER_ADMIN = process.env.MASTER_ADMIN || "5817328317";

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const parser = new Parser();
const bot = new Telegraf(BOT_TOKEN);

let supabase = null;
let supabaseEnabled = false;

try {
    if (SUPABASE_URL && SUPABASE_KEY) {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        supabaseEnabled = true;
        log('Supabase клиент успешно инициализирован', 'SUPABASE');
    }
} catch (e) {
    log(`Ошибка инициализации Supabase: ${e.message}`, 'ERROR');
}

let allowedUsers = [];
let videoLessons = []; // Глобальный кэш видеоуроков

// ==================== ЛОГИРОВАНИЕ ====================
function log(message, type = 'INFO') {
    console.log(`[${new Date().toISOString()}] [${type}] ${message}`);
}

// ==================== SUPABASE — ПОЛЬЗОВАТЕЛИ ====================
async function loadAllowedUsers() {
    if (!supabaseEnabled || !supabase) {
        allowedUsers = [MASTER_ADMIN];
        return;
    }
    try {
        const { data, error } = await supabase.from('allowed_users').select('user_id');
        if (error) throw error;
        allowedUsers = (data || []).map(row => row.user_id);
        if (allowedUsers.length === 0) {
            const defaults = [MASTER_ADMIN];
            for (const uid of defaults) {
                await supabase.from('allowed_users').upsert({ user_id: uid });
            }
            allowedUsers = defaults;
        }
        log(`Загружено ${allowedUsers.length} пользователей`, 'SUPABASE');
    } catch (e) {
        log(`Ошибка загрузки пользователей: ${e.message}`, 'ERROR');
        allowedUsers = [MASTER_ADMIN];
    }
}

async function addUserToSupabase(userId) {
    const normalized = String(userId).trim();
    if (allowedUsers.includes(normalized)) return { success: true, alreadyExists: true };

    if (!supabaseEnabled) {
        allowedUsers.push(normalized);
        return { success: true, memoryOnly: true };
    }

    const { error } = await supabase.from('allowed_users').upsert({ user_id: normalized });
    if (error) return { success: false, error: error.message };

    allowedUsers.push(normalized);
    return { success: true };
}

async function removeUserFromSupabase(userId) {
    const normalized = String(userId).trim();
    if (normalized === MASTER_ADMIN) return { success: false, error: 'Нельзя удалить ROOT' };

    if (!supabaseEnabled) {
        allowedUsers = allowedUsers.filter(id => id !== normalized);
        return { success: true, memoryOnly: true };
    }

    const { error } = await supabase.from('allowed_users').delete().eq('user_id', normalized);
    if (error) return { success: false, error: error.message };

    allowedUsers = allowedUsers.filter(id => id !== normalized);
    return { success: true };
}

// ==================== SUPABASE — ВИДЕОУРОКИ ====================
async function loadVideoLessons() {
    if (!supabaseEnabled || !supabase) {
        videoLessons = [];
        return;
    }
    try {
        const { data, error } = await supabase
            .from('video_lessons')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        videoLessons = data || [];
        log(`Загружено ${videoLessons.length} видеоуроков из Supabase`, 'SUPABASE');
    } catch (e) {
        log(`Ошибка загрузки видеоуроков: ${e.message}`, 'ERROR');
        videoLessons = [];
    }
}

async function saveVideoLessonsToSupabase(lessons, adminId) {
    if (!isMaster(adminId)) {
        return { success: false, error: 'Access denied' };
    }
    if (!supabaseEnabled || !supabase) {
        return { success: false, error: 'Supabase не подключён' };
    }

    try {
        // Удаляем старые
        await supabase.from('video_lessons').delete().neq('id', 0);

        // Вставляем новые
        const formatted = lessons.map(l => ({
            title: l.title,
            category: l.category,
            duration: l.duration,
            level: l.level,
            description: l.desc || l.description,
            youtube: l.youtube
        }));

        const { error } = await supabase.from('video_lessons').insert(formatted);
        if (error) throw error;

        videoLessons = lessons;
        log(`Сохранено ${lessons.length} видеоуроков в Supabase`, 'SUPABASE');
        return { success: true };
    } catch (e) {
        log(`Ошибка сохранения видеоуроков: ${e.message}`, 'ERROR');
        return { success: false, error: e.message };
    }
}

// ==================== TELEGRAM БОТ ====================
bot.start(async (ctx) => {
    // ... (оставь как было)
});

bot.command('myid', (ctx) => ctx.reply(`Ваш Telegram ID: \`${ctx.from.id}\``));

bot.launch()
    .then(() => log('Telegram бот запущен', 'BOT'))
    .catch(err => log(`Ошибка запуска бота: ${err.message}`, 'ERROR'));

// ==================== ЭНДПОИНТЫ ====================
app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'VIP COMMUNITY PRO AI', version: '2.1-video-supabase' });
});

app.get('/api/health', (req, res) => res.json({ status: 'healthy' }));

app.get('/api/check-access', (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ allowed: false });
    res.json({ allowed: allowedUsers.some(id => String(id) === String(userId)) });
});

app.get('/api/allowed-users', (req, res) => {
    res.json({ success: true, users: allowedUsers });
});

// ==================== ВИДЕОУРОКИ ====================
app.get('/api/video-lessons', (req, res) => {
    res.json({ success: true, lessons: videoLessons });
});

app.post('/api/admin/video-lessons', async (req, res) => {
    const { lessons, adminId } = req.body;

    if (!adminId || !isMaster(adminId)) {
        return res.status(403).json({ success: false, error: 'Только ROOT ADMIN' });
    }
    if (!Array.isArray(lessons)) {
        return res.status(400).json({ success: false, error: 'lessons должен быть массивом' });
    }

    const result = await saveVideoLessonsToSupabase(lessons, adminId);
    if (!result.success) {
        return res.status(500).json({ success: false, error: result.error });
    }

    res.json({ success: true, count: lessons.length });
});

// ==================== АДМИН ПОЛЬЗОВАТЕЛИ ====================
app.post('/api/admin/add-user', async (req, res) => {
    const { userId, adminId } = req.body;
    if (!adminId || !isMaster(adminId)) return res.status(403).json({ success: false, error: 'Access denied' });
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

    const result = await addUserToSupabase(userId);
    res.json({ success: result.success, users: allowedUsers });
});

app.post('/api/admin/remove-user', async (req, res) => {
    const { userId, adminId } = req.body;
    if (!adminId || !isMaster(adminId)) return res.status(403).json({ success: false, error: 'Access denied' });
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

    const result = await removeUserFromSupabase(userId);
    res.json({ success: result.success, users: allowedUsers });
});

// ==================== ЗАПУСК ====================
app.listen(PORT, async () => {
    log(`Backend запущен на порту ${PORT}`, 'START');
    await loadAllowedUsers();
    await loadVideoLessons();
    setInterval(() => loadVideoLessons(), 5 * 60 * 1000); // обновляем кэш каждые 5 минут
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
