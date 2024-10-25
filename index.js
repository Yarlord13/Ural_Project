require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

//Есть некторые проблемы с этим API. Он не всегда работает, но лучше из бесплатных не было, потому если погода не присылается, или город не находит, то это проблемы API
const weatherApiKey = process.env.OPENWEATHER_API_KEY;

const userData = {};

// Установка команд бота для отображения в меню
bot.setMyCommands([
    { command: '/start', description: 'Запуск бота' },
    { command: '/change_interval', description: 'Изменить интервал получения прогноза' },
    { command: '/change_city', description: 'Изменить город' },
    { command: '/help', description: 'Помощь по командам' }
]);

function initializeUserData(chatId) {
    if (!userData[chatId]) {
        userData[chatId] = { city: '', interval: 0, intervalId: null };
    }
}

// Команда /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    initializeUserData(chatId)

    if (!userData[chatId]) {
        userData[chatId] = { city: '', interval: 0, intervalId: null };
    }

    userData[chatId].city = '';
    userData[chatId].interval = 0;
    clearInterval(userData[chatId].intervalId);
    userData[chatId].intervalId = null;

    bot.sendMessage(chatId, "Введите город для получения прогноза погоды", {
        reply_markup: { remove_keyboard: true }
    });
});

// Команда для помощи /help
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    initializeUserData(chatId)
    const helpMessage = `
Доступные команды:
/start - Запуск бота и ввод города.
/change_interval - Изменить интервал получения прогноза.
/change_city - Изменить город для получения прогноза.
/help - Показать это сообщение.

Для начала введите команду /start, чтобы указать город.
После этого можно будет изменить интервал получения прогноза через команду /change_interval.
    `;
    bot.sendMessage(chatId, helpMessage, { reply_markup: { remove_keyboard: true } });
});

// Команда для изменения интервала
bot.onText(/\/change_interval/, (msg) => {
    const chatId = msg.chat.id;
    initializeUserData(chatId)

    clearInterval(userData[chatId].intervalId);
    userData[chatId].interval = 0;

    if (!userData[chatId].city) {
        bot.sendMessage(chatId, "Сначала укажите город, чтобы изменить интервал");
        return;
    }

    bot.sendMessage(chatId, "Выберите новый интервал для прогноза погоды:", {
        reply_markup: {
            keyboard: [
                [{ text: '1 минута' }],
                [{ text: '12 часов' }],
                [{ text: 'Каждый день' }],
                [{ text: 'Никогда' }]
            ],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });
});

// Команда для изменения города /change_city
bot.onText(/\/change_city/, (msg) => {
    const chatId = msg.chat.id;
    initializeUserData(chatId)
    
    userData[chatId].city = null;
    clearInterval(userData[chatId].intervalId);
    userData[chatId] = 0;
    bot.sendMessage(chatId, "Введите новый город для получения прогноза погоды", {
        reply_markup: { remove_keyboard: true }
    });
});

// Обработка ввода города
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    initializeUserData(chatId)

    if (text === '/start' || text === '/change_interval' || text === '/change_city' || userData[chatId].city) return;

    const weatherData = await getWeather(text);

    if (weatherData && weatherData.cod === 200) {
        userData[chatId].city = text;
        bot.sendMessage(chatId, `Город ${userData[chatId].city} найден. Как часто присылать прогноз погоды?`, {
            reply_markup: {
                keyboard: [
                    [{ text: '1 минута' }],
                    [{ text: '12 часов' }],
                    [{ text: 'Каждый день' }],
                    [{ text: 'Никогда' }]
                ],
                one_time_keyboard: true,
                resize_keyboard: true
            }
        });
    } else {
        bot.sendMessage(chatId, "Город не найден. Попробуйте еще раз", {
            reply_markup: { remove_keyboard: true }
        });
    }
});

// Обработка выбора интервала
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    initializeUserData(chatId)

    if ((!userData[chatId].city || userData[chatId].interval) && text !== '/change_interval') return;

    switch (text) {
        case '1 минута':
            userData[chatId].interval = 1;
            break;
        case '12 часов':
            userData[chatId].interval = 720;
            break;
        case 'Каждый день':
            userData[chatId].interval = 1440;
            break;
        case 'Никогда':
            userData[chatId].interval = 0;
            clearInterval(userData[chatId].intervalId);
            bot.sendMessage(chatId, "Прогноз погоды больше не будет отправляться", {
                reply_markup: { remove_keyboard: true }
            });
            return;
        default:
            bot.sendMessage(chatId, "Простите, бот пока не умеет воспринимать прочие значения. Пожалуйста, выберите один из предложенных вариантов", {
            });
            return;
    }

    bot.sendMessage(chatId, `Вы выбрали интервал ${userData[chatId].interval === 1 ? 'каждую минуту' : userData[chatId].interval === 720 ? 'каждые 12 часов' : userData[chatId].interval === 1440 ? 'каждый день' : 'какого?'}. Прогноз погоды будет присылаться с этим интервалом`, {
        reply_markup: { remove_keyboard: true }
    });

    clearInterval(userData[chatId].intervalId);
    if (userData[chatId].interval > 0) {
        sendWeather(chatId, userData[chatId].city, userData[chatId].interval);
    }
});

// Функция для получения погоды
async function getWeather(city) {
    const url = `http://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${weatherApiKey}&lang=ru&units=metric`;
    try {
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        console.error('Ошибка получения данных о погоде:', error);
        return null;
    }
}

// Функция для отправки погоды через заданные интервалы
function sendWeather(chatId, city, interval) {
    userData[chatId].intervalId = setInterval(async () => {
        const weatherData = await getWeather(city);
        if (weatherData && weatherData.cod === 200) {
            const message = `Погода в ${city}: ${weatherData.weather[0].description}. Температура: ${weatherData.main.temp}°C`;
            bot.sendMessage(chatId, message);
        } else {
            bot.sendMessage(chatId, `Не удалось получить данные о погоде для города ${city}`);
        }
    }, interval * 60 * 1000);
}

bot.on('polling_error', (error) => {
    console.log(`[polling_error] ${error.code}: ${error.message}`);
  });