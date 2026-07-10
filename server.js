const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// ==================== КОНФИГ ====================
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN || "8988084203:AAGMNH763cv170X0lRGczjTwUY6Ir-TWlFI";

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rjhnlzayhwidycqdroms.supabase.co';

// === ВАЖНО: Приоритет service_role ключа ===
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || null;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_2BKzk8OP3abRq8l6wiLbkA_8fJFzh3x';

const MASTER_ADMIN = process.env.MASTER_ADMIN || "5817328317";

// ==================== ИНИЦИАЛИЗАЦИЯ SUPABASE ====================
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

let supabase = null;
let supabaseEnabled = false;
let keyType = 'NONE';

function initSupabase() {
    const keyToUse = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_PUBLISHABLE_KEY;
    
    if (!SUPABASE_URL || !keyToUse) {
        log('Supabase URL или Key не заданы в переменных окружения', 'ERROR');
        return;
    }

    try {
        supabase = createClient(SUPABASE_URL, keyToUse, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
        supabaseEnabled = true;
        keyType = SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'PUBLISHABLE';
        
        log(`Supabase подключён успешно | Тип ключа: ${keyType}`, 'SUPABASE');
        
        if (keyType === 'PUBLISHABLE') {
            log('⚠️ ВНИМАНИЕ: Используется PUBLISHABLE ключ. Для записи в Supabase рекомендуется SERVICE_ROLE_KEY', 'WARNING');
        }
    } catch (e) {
        log(`Ошибка инициализации Supabase: ${e.message}`, 'ERROR');
    }
}

initSupabase();

let allowedUsers = [];
let videoLessons = [];

// ==================== ЛОГИРОВАНИЕ ====================
function log(message, type = 'INFO') {
    console.log(`[${new Date().toISOString()}] [${type}] ${message}`);
}

function isMaster(userId) {
    return String(userId || '').trim() === String(MASTER_ADMIN).trim();
}

// ==================== SUPABASE — ПОЛЬЗОВАТЕЛИ ====================
async function loadAllowedUsers() {
    if (!supabaseEnabled) {
        allowedUsers = [MASTER_ADMIN];
        return;
    }
    try {
        const { data, error } = await supabase.from('allowed_users').select('user_id');
        if (error) throw error;
        allowedUsers = (data || []).map(r => r.user_id);
        if (allowedUsers.length === 0) {
            await supabase.from('allowed_users').upsert({ user_id: MASTER_ADMIN });
            allowedUsers = [MASTER_ADMIN];
        }
        log(`Загружено ${allowedUsers.length} пользователей`, 'SUPABASE');
    } catch (e) {
        log(`Ошибка загрузки пользователей: ${e.message}`, 'ERROR');
        allowedUsers = [MASTER_ADMIN];
    }
}

// ==================== SUPABASE — ВИДЕОУРОКИ ====================
async function loadVideoLessons() {
    if (!supabaseEnabled) {
        videoLessons = [];
        return;
    }
    try {
        const { data, error } = await supabase
            .from('video_lessons')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            log(`Ошибка SELECT video_lessons: ${error.message} | code=${error.code}`, 'ERROR');
            videoLessons = [];
            return;
        }
        videoLessons = data || [];
        log(`Загружено ${videoLessons.length} видеоуроков из Supabase`, 'SUPABASE');
    } catch (e) {
        log(`Критическая ошибка loadVideoLessons: ${e.message}`, 'ERROR');
        videoLessons = [];
    }
}

async function addVideoLessonToSupabase(lesson, adminId = MASTER_ADMIN) {
    if (!isMaster(adminId)) {
        return { success: false, error: 'Access denied (только ROOT ADMIN)' };
    }
    if (!supabaseEnabled) {
        return { success: false, error: 'Supabase не инициализирован' };
    }

    try {
        const payload = {
            title: lesson.title,
            category: lesson.category || 'basics',
            duration: lesson.duration || '15 мин',
            level: lesson.level || 'Средний',
            description: lesson.desc || lesson.description || 'Добавленный урок разработчика.',
            youtube: lesson.youtube,
            isCustom: lesson.isCustom ? 'true' : 'false',
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('video_lessons')
            .insert([payload])
            .select()
            .single();

        if (error) {
            log(`Supabase INSERT FAILED: ${error.message} | code=${error.code} | details=${error.details || ''}`, 'ERROR');
            return { success: false, error: error.message };
        }

        await loadVideoLessons();
        log(`✅ Успешно добавлен урок: "${payload.title}"`, 'SUPABASE');
        return { success: true, lesson: data };
    } catch (e) {
        log(`Критическая ошибка addVideoLesson: ${e.message}`, 'ERROR');
        return { success: false, error: e.message };
    }
}

async function deleteVideoLessonFromSupabase(lessonId, adminId = MASTER_ADMIN) {
    if (!isMaster(adminId)) {
        return { success: false, error: 'Access denied (только ROOT ADMIN)' };
    }
    if (!supabaseEnabled) {
        return { success: false, error: 'Supabase не инициализирован' };
    }
    if (!lessonId) {
        return { success: false, error: 'lessonId обязателен' };
    }

    try {
        const { error } = await supabase
            .from('video_lessons')
            .delete()
            .eq('id', lessonId);

        if (error) {
            log(`Supabase DELETE FAILED: ${error.message}`, 'ERROR');
            return { success: false, error: error.message };
        }

        await loadVideoLessons();
        log(`🗑️ Удалён урок id=${lessonId}`, 'SUPABASE');
        return { success: true };
    } catch (e) {
        log(`Критическая ошибка delete: ${e.message}`, 'ERROR');
        return { success: false, error: e.message };
    }
}

// ==================== ЭНДПОИНТЫ ====================
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'VIP COMMUNITY PRO AI',
        version: '3.0-final-fixed',
        supabase: supabaseEnabled ? 'connected' : 'disabled',
        keyType: keyType
    });
});

app.get('/api/health', (req, res) => res.json({ status: 'healthy' }));

app.get('/api/check-access', (req, res) => {
    const userId = req.query.userId;
    res.json({ allowed: !!userId && allowedUsers.some(id => String(id) === String(userId)) });
});

app.get('/api/allowed-users', (req, res) => res.json({ success: true, users: allowedUsers }));

// Видеоуроки
app.get('/api/video-lessons', (req, res) => {
    res.json(videoLessons);
});

app.post('/api/video-lessons', async (req, res) => {
    const lesson = req.body;
    const adminId = lesson.adminId || MASTER_ADMIN;

    if (!lesson?.title || !lesson?.youtube) {
        return res.status(400).json({ success: false, error: 'title и youtube обязательны' });
    }

    const result = await addVideoLessonToSupabase(lesson, adminId);
    if (!result.success) {
        return res.status(403).json({ success: false, error: result.error });
    }
    res.json({ success: true, lesson: result.lesson });
});

app.delete('/api/video-lessons', async (req, res) => {
    const lessonId = req.query.id || req.body.id;
    const adminId = req.query.adminId || req.body.adminId || MASTER_ADMIN;

    if (!lessonId) {
        return res.status(400).json({ success: false, error: 'id обязателен' });
    }

    const result = await deleteVideoLessonFromSupabase(lessonId, adminId);
    if (!result.success) {
        return res.status(403).json({ success: false, error: result.error });
    }
    res.json({ success: true });
});

// ==================== ЗАПУСК ====================
app.listen(PORT, async () => {
    log(`Backend запущен на порту ${PORT}`, 'START');
    await loadAllowedUsers();
    await loadVideoLessons();
    setInterval(loadVideoLessons, 5 * 60 * 1000);
});
