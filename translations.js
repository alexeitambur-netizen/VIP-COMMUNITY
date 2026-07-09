// =============================================
// VIP COMMUNITY PRO AI - TRANSLATIONS
// Полный файл переводов приложения
// =============================================

const TRANSLATIONS = {
    ru: {
        // === APP GENERAL ===
        app_title: "VIP COMMUNITY PRO AI",
        welcome: "POCKET OPTION",
        brand: "PRO AI BOT",

        // === MENU ===
        menu_profile: "Профиль",
        menu_neural: "Нейросеть",
        menu_knowledge: "База знаний",
        menu_patterns: "Паттерны",
        menu_strategies: "Стратегии PRO",
        menu_calculator: "Калькулятор",
        menu_macro: "Макро-данные",
        menu_news: "ИИ Новости",
        menu_notes: "Мои Заметки",
        menu_developer: "DEVELOPER",

        // === COMMON ===
        back_to_terminal: "← НАЗАД В ТЕРМИНАЛ",
        back_to_menu: "← НАЗАД В МЕНЮ",
        save: "СОХРАНИТЬ",
        cancel: "ОТМЕНА",
        loading: "Загрузка...",

        // === PROFILE ===
        profile_title: "ДАННЫЕ ТРЕЙДЕРА",
        profile_callsign: "Позывной",
        profile_telegram_id: "Telegram ID",
        profile_working_capital: "Рабочий капитал",
        profile_ai_directive: "Директива ИИ",

        // === NEWS ===
        news_title: "ИИ НОВОСТИ PRO",
        news_live_tab: "LIVE РЫНОК",
        news_grok_tab: "GROK AI ГЕНЕРАЦИЯ",
        news_grok_generate: "СГЕНЕРИРОВАТЬ НОВОСТИ ОТ GROK",
        news_grok_thinking: "Grok думает над рынком...",

        // === PATTERNS ===
        patterns_title: "ПАТТЕРНЫ РЫНКА",
        patterns_candlestick: "СВЕЧНЫЕ ПАТТЕРНЫ (Японские свечи)",
        patterns_chart: "КЛАССИЧЕСКИЕ ГРАФИЧЕСКИЕ ПАТТЕРНЫ",
        patterns_harmonic: "ГАРМОНИЧЕСКИЕ ПАТТЕРНЫ",

        // === STRATEGIES ===
        strategies_title: "СТРАТЕГИИ PRO — POCKET OPTION M1",
        strategies_search: "Поиск индикатора или стратегии...",

        // === SESSIONS / CALCULATOR ===
        sessions_title: "КАЛЬКУЛЯТОР PRO",

        // === CALENDAR ===
        calendar_title: "МАКРО-ДАННЫЕ",

        // === NOTES ===
        notes_title: "ЖУРНАЛ ТРЕЙДЕРА",
        notes_add_new: "+ НОВАЯ ЗАМЕТКА",
        notes_clear_all: "ОЧИСТИТЬ ВСЁ",
        notes_filter_all: "ВСЕ",
        notes_filter_deals: "СДЕЛКИ",
        notes_filter_ideas: "ИДЕИ",
        notes_filter_errors: "ОШИБКИ",
        notes_filter_observations: "НАБЛЮДЕНИЯ",

        // === LANGUAGE ===
        lang_ru: "Русский",
        lang_en: "English"
    },

    en: {
        // === APP GENERAL ===
        app_title: "VIP COMMUNITY PRO AI",
        welcome: "POCKET OPTION",
        brand: "PRO AI BOT",

        // === MENU ===
        menu_profile: "Profile",
        menu_neural: "Neural Network",
        menu_knowledge: "Knowledge Base",
        menu_patterns: "Patterns",
        menu_strategies: "PRO Strategies",
        menu_calculator: "Calculator",
        menu_macro: "Macro Data",
        menu_news: "AI News",
        menu_notes: "My Notes",
        menu_developer: "DEVELOPER",

        // === COMMON ===
        back_to_terminal: "← BACK TO TERMINAL",
        back_to_menu: "← BACK TO MENU",
        save: "SAVE",
        cancel: "CANCEL",
        loading: "Loading...",

        // === PROFILE ===
        profile_title: "TRADER DATA",
        profile_callsign: "Callsign",
        profile_telegram_id: "Telegram ID",
        profile_working_capital: "Working Capital",
        profile_ai_directive: "AI Directive",

        // === NEWS ===
        news_title: "PRO AI NEWS",
        news_live_tab: "LIVE MARKET",
        news_grok_tab: "GROK AI GENERATION",
        news_grok_generate: "GENERATE NEWS FROM GROK",
        news_grok_thinking: "Grok is thinking about the market...",

        // === PATTERNS ===
        patterns_title: "MARKET PATTERNS",
        patterns_candlestick: "CANDLESTICK PATTERNS",
        patterns_chart: "CLASSIC CHART PATTERNS",
        patterns_harmonic: "HARMONIC PATTERNS",

        // === STRATEGIES ===
        strategies_title: "PRO STRATEGIES — POCKET OPTION M1",
        strategies_search: "Search indicator or strategy...",

        // === SESSIONS / CALCULATOR ===
        sessions_title: "PRO CALCULATOR",

        // === CALENDAR ===
        calendar_title: "MACRO DATA",

        // === NOTES ===
        notes_title: "TRADER'S JOURNAL",
        notes_add_new: "+ NEW NOTE",
        notes_clear_all: "CLEAR ALL",
        notes_filter_all: "ALL",
        notes_filter_deals: "DEALS",
        notes_filter_ideas: "IDEAS",
        notes_filter_errors: "ERRORS",
        notes_filter_observations: "OBSERVATIONS",

        // === LANGUAGE ===
        lang_ru: "Russian",
        lang_en: "English"
    }
};

// =============================================
// CONTENT TRANSLATIONS (Patterns, Strategies, Books)
// =============================================

const CONTENT_TRANSLATIONS = {
    ru: {
        patterns: {
            candlestick: [ /* original Russian data is in index.html */ ],
            chart: [ /* original Russian data is in index.html */ ],
            harmonic: [ /* original Russian data is in index.html */ ]
        }
    },
    en: {
        patterns: {
            candlestick: [
                { name: "Doji", type: "Reversal / Neutral", desc: "Open price ≈ close price. Signal of uncertainty. On M1 often precedes reversal with volume.", signal: "Wait for confirmation from the next candle. Stronger near support/resistance." },
                { name: "Hammer", type: "Bullish Reversal", desc: "Small body on top, long lower shadow (2x+ body). Shows bounce from support.", signal: "Call on the next candle after confirmation. Ideal on M1 at support level." }
                // ... (full list already embedded in index.html for performance)
            ]
        }
    }
};

console.log("%c[PRO AI] Translations module loaded", "color:#00FFAA");
