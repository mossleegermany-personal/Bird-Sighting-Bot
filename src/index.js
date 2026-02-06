require('dotenv').config();
const express = require('express');
const BirdBot = require('./bot/telegramBot');
const EBirdService = require('./services/ebirdService');

// Configuration
const PORT = process.env.PORT || 3000;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const EBIRD_API_KEY = process.env.EBIRD_API_KEY;
const WEBSITE_HOSTNAME = process.env.WEBSITE_HOSTNAME; // Azure provides this
const USE_WEBHOOK = process.env.USE_WEBHOOK === 'true' || !!WEBSITE_HOSTNAME;

// Validate required environment variables
if (!EBIRD_API_KEY) {
  console.error('❌ EBIRD_API_KEY is required in .env file');
  process.exit(1);
}

if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === 'your_telegram_bot_token_here') {
  console.warn('⚠️  TELEGRAM_BOT_TOKEN not configured. Bot will not start.');
  console.warn('   Get a token from @BotFather on Telegram and add it to .env');
}

// Initialize Express app
const app = express();
app.use(express.json());

// Initialize eBird service for API routes
const ebirdService = new EBirdService(EBIRD_API_KEY);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    name: 'Bird Sighting Bot',
    version: '1.0.0',
    endpoints: {
      health: 'GET /',
      recentObservations: 'GET /api/observations/:regionCode',
      notableObservations: 'GET /api/observations/:regionCode/notable',
      speciesObservations: 'GET /api/observations/:regionCode/species/:speciesCode',
      nearbyObservations: 'GET /api/nearby?lat=&lng=&dist=',
      hotspots: 'GET /api/hotspots/:regionCode',
      nearbyHotspots: 'GET /api/hotspots/nearby?lat=&lng=&dist='
    }
  });
});

// API Routes for eBird data

/**
 * Get recent observations in a region
 * GET /api/observations/:regionCode
 * Query params: back (days), maxResults
 */
app.get('/api/observations/:regionCode', async (req, res) => {
  try {
    const { regionCode } = req.params;
    const { back = 14, maxResults = 20 } = req.query;
    
    const observations = await ebirdService.getRecentObservations(
      regionCode,
      parseInt(back),
      parseInt(maxResults)
    );
    
    res.json({
      success: true,
      regionCode,
      count: observations.length,
      data: observations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get notable observations in a region
 * GET /api/observations/:regionCode/notable
 * Query params: back (days), maxResults
 */
app.get('/api/observations/:regionCode/notable', async (req, res) => {
  try {
    const { regionCode } = req.params;
    const { back = 14, maxResults = 20 } = req.query;
    
    const observations = await ebirdService.getNotableObservations(
      regionCode,
      parseInt(back),
      parseInt(maxResults)
    );
    
    res.json({
      success: true,
      regionCode,
      count: observations.length,
      data: observations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get observations of a specific species in a region
 * GET /api/observations/:regionCode/species/:speciesCode
 * Query params: back (days)
 */
app.get('/api/observations/:regionCode/species/:speciesCode', async (req, res) => {
  try {
    const { regionCode, speciesCode } = req.params;
    const { back = 14 } = req.query;
    
    const observations = await ebirdService.getSpeciesObservations(
      regionCode,
      speciesCode,
      parseInt(back)
    );
    
    res.json({
      success: true,
      regionCode,
      speciesCode,
      count: observations.length,
      data: observations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get nearby observations based on coordinates
 * GET /api/nearby
 * Query params: lat (required), lng (required), dist, back, maxResults
 */
app.get('/api/nearby', async (req, res) => {
  try {
    const { lat, lng, dist = 25, back = 14, maxResults = 20 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'lat and lng query parameters are required'
      });
    }
    
    const observations = await ebirdService.getNearbyObservations(
      parseFloat(lat),
      parseFloat(lng),
      parseInt(dist),
      parseInt(back),
      parseInt(maxResults)
    );
    
    res.json({
      success: true,
      location: { lat: parseFloat(lat), lng: parseFloat(lng) },
      distance: parseInt(dist),
      count: observations.length,
      data: observations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get hotspots in a region
 * GET /api/hotspots/:regionCode
 */
app.get('/api/hotspots/:regionCode', async (req, res) => {
  try {
    const { regionCode } = req.params;
    
    const hotspots = await ebirdService.getHotspots(regionCode);
    
    res.json({
      success: true,
      regionCode,
      count: hotspots.length,
      data: hotspots
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get nearby hotspots based on coordinates
 * GET /api/hotspots/nearby
 * Query params: lat (required), lng (required), dist
 */
app.get('/api/hotspots/nearby', async (req, res) => {
  try {
    const { lat, lng, dist = 25 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'lat and lng query parameters are required'
      });
    }
    
    const hotspots = await ebirdService.getNearbyHotspots(
      parseFloat(lat),
      parseFloat(lng),
      parseInt(dist)
    );
    
    res.json({
      success: true,
      location: { lat: parseFloat(lat), lng: parseFloat(lng) },
      distance: parseInt(dist),
      count: hotspots.length,
      data: hotspots
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start the server
const server = app.listen(PORT, async () => {
  console.log(`\n🚀 Bird Sighting Bot Server running on port ${PORT}`);
  console.log(`   API available at http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/`);
  console.log(`   Mode: ${USE_WEBHOOK ? 'Webhook (Production)' : 'Polling (Development)'}`);
  console.log('');
});

// Store bot instance globally for webhook endpoint
let birdBot = null;

// Webhook endpoint for Telegram
app.post(`/bot${TELEGRAM_BOT_TOKEN}`, (req, res) => {
  if (birdBot) {
    birdBot.processUpdate(req.body);
  }
  res.sendStatus(200);
});

// Initialize Telegram bot if token is configured
if (TELEGRAM_BOT_TOKEN && TELEGRAM_BOT_TOKEN !== 'your_telegram_bot_token_here') {
  try {
    birdBot = new BirdBot(TELEGRAM_BOT_TOKEN, EBIRD_API_KEY, { useWebhook: USE_WEBHOOK });
    
    if (USE_WEBHOOK) {
      // Set webhook URL for production
      const webhookUrl = WEBSITE_HOSTNAME 
        ? `https://${WEBSITE_HOSTNAME}/bot${TELEGRAM_BOT_TOKEN}`
        : `https://your-app.azurewebsites.net/bot${TELEGRAM_BOT_TOKEN}`;
      
      birdBot.getBot().setWebHook(webhookUrl).then(() => {
        console.log('🤖 Telegram Bot started in WEBHOOK mode!');
        console.log(`   Webhook URL: ${webhookUrl.replace(TELEGRAM_BOT_TOKEN, '***')}`);
      }).catch(err => {
        console.error('❌ Failed to set webhook:', err.message);
      });
    } else {
      // Delete webhook for local polling mode
      birdBot.getBot().deleteWebHook().then(() => {
        console.log('🤖 Telegram Bot started in POLLING mode!');
        console.log('   Send /start to your bot to begin');
      }).catch(err => {
        console.error('❌ Failed to delete webhook:', err.message);
      });
    }
  } catch (error) {
    console.error('❌ Failed to start Telegram bot:', error.message);
  }
} else {
  console.log('⚠️  Telegram Bot not started (token not configured)');
  console.log('   To enable the bot:');
  console.log('   1. Talk to @BotFather on Telegram');
  console.log('   2. Create a new bot with /newbot');
  console.log('   3. Copy the token to your .env file');
}

module.exports = app;
