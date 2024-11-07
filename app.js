const OpenAI = require('openai');
const express = require('express');
const yahooFinance = require('yahoo-finance2').default;

require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

const OpenAiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? '',
});

async function getStockPrice(stockSymbol) {
  try {
    const result = await yahooFinance.quote(stockSymbol);
    return {
      price: result.regularMarketPrice,
      currency: result.currency,
    };
  } catch (error) {
    console.error('Error fetching stock data:', error);
    return { error: 'Stock symbol not found' };
  }
}

const stockPriceFunction = {
  name: 'get_stock_price',
  description: 'Fetches the stock price for a given company symbol',
  parameters: {
    type: 'object',
    properties: {
      stockSymbol: {
        type: 'string',
        description:
          'The stock symbol of the company (e.g., AAPL for Apple, GOOGL for Google)',
      },
    },
    required: ['stockSymbol'],
  },
};

app.use(express.json());

app.post('/api/converse', async (req, res) => {
  const message = [
    {
      role: 'system',
      content:
        'You are a helpful assistant that will give the information about the stock prices.',
    },
  ];
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.status(401).json({
      message: 'No message was provided.',
    });
  }

  try {
    const response = await OpenAiClient.chat.completions.create({
      model: 'gpt-4',
      messages: [...message, { role: 'user', content: userMessage }],
      functions: [stockPriceFunction],
      function_call: 'auto',
    });

    const messageData = response.choices[0].message;

    if (messageData.function_call) {
      const { stockSymbol } = JSON.parse(messageData.function_call.arguments);

      const stockData = await getStockPrice(stockSymbol);

      if (stockData.error) {
        res.json({ reply: stockData.error });
      } else {
        res.json({
          reply: `The current price of ${stockSymbol} is ${stockData.price} ${stockData.currency}.`,
        });
      }
    } else {
      res.json({ reply: messageData.content });
    }
  } catch (error) {
    console.error('Error in chat completion:', error);
    res
      .status(500)
      .json({ error: 'An error occurred while processing your request.' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
