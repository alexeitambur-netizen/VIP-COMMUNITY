const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rjhnlzayhwidycqdroms.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MASTER_ADMIN = process.env.MASTER_ADMIN || "5817328317";

const app = express();
app.use(cors());
app.use(express.json());

let supabase = null;
let supabaseEnabled = false;

if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
    supabaseEnabled = true;
    console.log('[SUPABASE] Подключён с SERVICE_ROLE ключом');
} else {
    console.log('[SUPABASE] ВНИМАНИЕ: SERVICE_ROLE_KEY не найден!');
}

let videoLessons = [];

async function loadVideoLessons() {
    if (!supabaseEnabled) return;
    try {
        const { data, error } = await supabase.from('video_lessons').select('*').order('created_at', { ascending: false });
        if (error) {
            console.error('[SUPABASE] loadVideoLessons error:', error.message);
            return;
        }
        videoLessons = data || [];
        console.log(`[SUPABASE] Загружено ${videoLessons.length} уроков`);
    } catch (e) {
        console.error('[SUPABASE] load error:', e.message);
    }
}

async function addLesson(lesson) {
    if (!supabaseEnabled) return { success: false, error: 'Supabase не подключён' };

    // Минимальный безопасный payload (только то, что точно есть в таблице)
    const payload = {
        title: lesson.title,
        category: lesson.category || 'basics',
        youtube: lesson.youtube,
        duration: lesson.duration || '15 мин',
        level: lesson.level || 'Средний',
        description: lesson.desc || lesson.description || '',
        isCustom: 'true',
        created_at: new Date().toISOString()
    };

    try {
        const { data, error } = await supabase
            .from('video_lessons')
            .insert([payload])
            .select()
            .single();

        if (error) {
            console.error('[SUPABASE] INSERT ERROR:', error);
            return { success: false, error: error.message + ' | code: ' + error.code };
        }

        await loadVideoLessons();
        console.log('[SUPABASE] Урок успешно добавлен:', payload.title);
        return { success: true, lesson: data };
    } catch (e) {
        console.error('[SUPABASE] addLesson exception:', e);
        return { success: false, error: e.message };
    }
}

async function deleteLesson(id) {
    if (!supabaseEnabled) return { success: false, error: 'Supabase не подключён' };
    try {
        const { error } = await supabase.from('video_lessons').delete().eq('id', id);
        if (error) {
            console.error('[SUPABASE] DELETE ERROR:', error);
            return { success: false, error: error.message };
        }
        await loadVideoLessons();
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// === ЭНДПОИНТЫ ===
app.get('/api/video-lessons', (req, res) => res.json(videoLessons));

app.post('/api/video-lessons', async (req, res) => {
    const lesson = req.body;
    if (!lesson?.title || !lesson?.youtube) {
        return res.status(400).json({ success: false, error: 'title и youtube обязательны' });
    }
    const result = await addLesson(lesson);
    res.json(result);
});

app.delete('/api/video-lessons', async (req, res) => {
    const id = req.query.id || req.body.id;
    if (!id) return res.status(400).json({ success: false, error: 'id обязателен' });
    const result = await deleteLesson(id);
    res.json(result);
});

app.listen(PORT, async () => {
    console.log(`Server started on port ${PORT}`);
    await loadVideoLessons();
});
