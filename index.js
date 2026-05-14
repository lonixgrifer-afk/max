const TelegramBot = require('node-telegram-bot-api');
const { chromium } = require('playwright');
const fs = require('fs');

const token = 'ВАШ_ТЕЛЕГРАМ_ТОКЕН';
const bot = new TelegramBot(token, { polling: true });

const SESSION_FILE = './session.json';

// Команда /start
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Бот готов.\n/login — вход по QR\n/open — открыть с сессией");
});

// Команда /login
bot.onText(/\/login/, async (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Запускаю браузер...");

    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await page.goto('https://web.max.ru');

        // Ждем QR-код. Селектор может меняться, обычно это canvas или img
        // Здесь берем скриншот области, где обычно появляется QR
        await page.waitForTimeout(5000); 
        const qrScreenshot = await page.screenshot({ fullPage: false });
        
        await bot.sendPhoto(chatId, qrScreenshot, { caption: "Отсканируй QR код в приложении MAX" });

        bot.sendMessage(chatId, "Жду подтверждения входа...");

        // Ждем успешного входа (например, пока исчезнет форма логина или появится элемент профиля)
        // Замени 'div.profile' на реальный селектор главной страницы после входа
        await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 });

        // Сохраняем состояние (куки, localStorage)
        await context.storageState({ path: SESSION_FILE });
        
        await bot.sendMessage(chatId, "✅ Успешный вход! Сессия сохранена.");
    } catch (error) {
        console.error(error);
        await bot.sendMessage(chatId, "Ошибка или таймаут ожидания входа.");
    } finally {
        await browser.close();
    }
});

// Команда /open
bot.onText(/\/open/, async (msg) => {
    const chatId = msg.chat.id;

    if (!fs.existsSync(SESSION_FILE)) {
        return bot.sendMessage(chatId, "Сначала выполни /login, сессия не найдена.");
    }

    bot.sendMessage(chatId, "Открываю MAX с сохраненной сессией...");

    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    // Загружаем сохраненную сессию
    const context = await browser.newContext({ storageState: SESSION_FILE });
    const page = await context.newPage();

    try {
        await page.goto('https://web.max.ru');
        await page.waitForTimeout(5000); // Даем прогрузиться

        const screen = await page.screenshot();
        await bot.sendPhoto(chatId, screen, { caption: "Страница открыта с твоей сессией" });
    } catch (error) {
        await bot.sendMessage(chatId, "Ошибка при открытии: " + error.message);
    } finally {
        await browser.close();
    }
});
