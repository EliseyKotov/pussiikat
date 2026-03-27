export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { message, from } = req.body.message || {};
    
    if (message?.text === '/start') {
      // URL твоей игры на Vercel
      const gameUrl = 'https://milk-tycoon-xyz.vercel.app'; // Замени на свой URL!
      
      const telegramToken = process.env.TELEGRAM_TOKEN;
      const chatId = from?.id;
      
      const payload = {
        chat_id: chatId,
        text: `👋 Привет, ${from?.first_name}! 🐱\n\nДобро пожаловать в Milk Tycoon!\n\n🎯 Нажимай на кота, зарабатывай молоко и взлетай на вершину! 🚀`,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🎮 Запустить Milk Tycoon',
                web_app: {
                  url: gameUrl
                }
              }
            ]
          ]
        }
      };
      
      try {
        await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        res.status(200).json({ ok: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    } else {
      res.status(200).json({ ok: true });
    }
  } else {
    res.status(200).json({ message: 'Webhook is working!' });
  }
}
