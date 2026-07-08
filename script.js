const WebSocket = require('ws');
const http = require('http');

// Глобальное хранилище для отсканированных валютных пар
let currentPairs = {}; 

// Настройка HTTP сервера со стабильным API[cite: 8]
const server = http.createServer((req, res) => {
    // Новый маршрут API для получения отсканированных пар
    if (req.url === '/api/pairs' && req.method === 'GET') {
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*' 
        });
        res.end(JSON.stringify({ 
            status: "success", 
            timestamp: Date.now(),
            total_pairs: Object.keys(currentPairs).length,
            data: currentPairs 
        }));
        return;
    }

    // Базовый ответ сервера[cite: 8]
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Pocket Option Scanner API is running. Endpoint: /api/pairs');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`API URL: http://localhost:${PORT}/api/pairs`);
});

// Класс для работы с Pocket Option (аналог логики из Python)[cite: 8]
class PocketOptionClient {
    constructor(sessionToken) {
        this.sessionToken = sessionToken;
        this.ws = null;
        this.pingInterval = null;
    }

    connect() {
        // Подключение к WebSocket[cite: 8]
        this.ws = new WebSocket('wss://pocketoption.com/socket.io/?EIO=3&transport=websocket', {
            headers: {
                "Origin": "https://pocketoption.com",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        });

        this.ws.on('open', () => {
            console.log('Connected to Pocket Option');
            this.sendAuth();
            this.startPing();
        });

        this.ws.on('message', (data) => {
            const messageString = data.toString();
            
            // Если получаем данные выплат, передаем в сканер[cite: 9]
            if (messageString.includes('[[5,"')) {
                this.scanPairs(messageString);
            }
        });

        this.ws.on('close', () => {
            console.log('Connection closed. Reconnecting...');
            clearInterval(this.pingInterval);
            setTimeout(() => this.connect(), 5000);
        });
        
        this.ws.on('error', (err) => {
            console.error('WebSocket Error:', err.message);
        });
    }

    sendAuth() {
        // Логика авторизации: платформа 2, демо или реал[cite: 9]
        const authPayload = `42["auth",{"session":"${this.sessionToken}","isDemo":1,"platform":2,"isFastHistory":true,"isOptimized":true}]`;
        this.ws.send(authPayload);
        console.log('Auth payload sent');
    }

    startPing() {
        // Поддержание соединения (пинги)[cite: 8]
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send('2'); // Стандартный пинг Socket.IO[cite: 8]
            }
        }, 25000); // 25 секунд[cite: 8]
    }

    scanPairs(message) {
        try {
            // Очищаем префикс Socket.IO (например, '42')
            const jsonString = message.replace(/^\d+/, '');
            if (!jsonString) return;

            const parsedData = JSON.parse(jsonString);

            // Ищем строку массива данных о выплатах
            if (Array.isArray(parsedData) && parsedData.length > 0) {
                // Ищем строку, которая содержит маркер выплат (например акции)
                const payloadString = parsedData.find(item => typeof item === 'string' && item.includes('[[5,'));
                
                if (payloadString) {
                    const pairsArray = JSON.parse(payloadString);
                    let scannedData = {};

                    // Перебор активов и извлечение данных по логике стабильного API[cite: 9]
                    pairsArray.forEach(pair => {
                        // Проверяем длину массива и статус активности пары[cite: 9]
                        if (pair.length === 19 && pair[14] === true) {
                            scannedData[pair[1]] = {
                                id: pair[0],
                                payout: pair[5],
                                type: pair[3],
                                active: pair[14]
                            };
                        }
                    });

                    // Обновляем глобальный объект
                    currentPairs = scannedData;
                    console.log(`[Сканнер]: Обновлены данные. Активных пар в памяти: ${Object.keys(currentPairs).length}`);
                }
            }
        } catch (error) {
            console.error('Ошибка парсинга пар:', error.message);
        }
    }
}

// Запуск клиента[cite: 8]
const token = process.env.PO_TOKEN || "ВАШ_ТОКЕН_ЗДЕСЬ";
const client = new PocketOptionClient(token);
client.connect();
