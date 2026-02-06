const TelegramBot = require('node-telegram-bot-api');
const EBirdService = require('../services/ebirdService');
const { toRegionCode, getPopularLocations } = require('../utils/regionCodes');

class BirdBot {
  constructor(telegramToken, ebirdApiKey) {
    this.bot = new TelegramBot(telegramToken, { polling: true });
    this.ebirdService = new EBirdService(ebirdApiKey);
    this.userStates = new Map(); // Track user conversation states
    this.observationsCache = new Map(); // Cache observations for pagination
    this.ITEMS_PER_PAGE = 5; // Number of observations per page
    
    this.setupCommands();
    this.setupHandlers();
  }

  setupCommands() {
    // Set up bot commands for the menu
    this.bot.setMyCommands([
      { command: 'start', description: 'Start the bot and see welcome message' },
      { command: 'help', description: 'Show all available commands' },
      { command: 'sightings', description: 'Search by LOCATION - see all birds in an area' },
      { command: 'species', description: 'Search by SPECIES - find where a bird was seen' },
      { command: 'notable', description: 'Get notable/rare bird sightings' },
      { command: 'nearby', description: 'Get sightings near your location' },
      { command: 'hotspots', description: 'Find birding hotspots' },
      { command: 'regions', description: 'Learn about region codes' }
    ]);
  }

  setupHandlers() {
    // Command handlers
    this.bot.onText(/\/start/, (msg) => this.handleStart(msg));
    this.bot.onText(/\/help/, (msg) => this.handleHelp(msg));
    this.bot.onText(/\/sightings(.*)/, (msg, match) => this.handleSightings(msg, match));
    this.bot.onText(/\/notable(.*)/, (msg, match) => this.handleNotable(msg, match));
    this.bot.onText(/\/nearby/, (msg) => this.handleNearby(msg));
    this.bot.onText(/\/hotspots(.*)/, (msg, match) => this.handleHotspots(msg, match));
    this.bot.onText(/\/species(.*)/, (msg, match) => this.handleSpecies(msg, match));
    this.bot.onText(/\/regions/, (msg) => this.handleRegions(msg));

    // Handle location sharing
    this.bot.on('location', (msg) => this.handleLocation(msg));

    // Handle callback queries (button presses)
    this.bot.on('callback_query', (callbackQuery) => this.handleCallback(callbackQuery));

    // Handle text messages for conversation flow
    this.bot.on('message', (msg) => this.handleMessage(msg));

    console.log('🤖 Bird Sighting Bot is running...');
  }

  async handleStart(msg) {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name || 'Birder';

    const welcomeMessage = `
🦅 *Welcome to the Bird Sighting Bot, ${userName}!*

I can help you discover bird sightings using data from eBird, the world's largest biodiversity database.

*🔍 Two Ways to Search:*

📍 *By Location* - /sightings
   See all birds spotted in an area
   Example: "Singapore", "New York", "Malaysia"

🐦 *By Species* - /species
   Find where a specific bird was seen
   Example: "House Sparrow", "Common Myna"

*Other Commands:*
⭐ /notable - Rare and unusual sightings
📍 /nearby - Birds near your GPS location
🗺️ /hotspots - Popular birding spots

Type /help for more details. Happy birding! 🐦
    `;

    await this.sendMessage(chatId, welcomeMessage);
  }

  async handleHelp(msg) {
    const chatId = msg.chat.id;

    const helpMessage = `
*🐦 Bird Sighting Bot - Help*

*🔍 Two Ways to Search:*

━━━━━━━━━━━━━━━━━━━━
📍 *SEARCH BY LOCATION*
━━━━━━━━━━━━━━━━━━━━
Use /sightings to see ALL birds in an area

Examples:
• \`/sightings Singapore\`
• \`/sightings New York\`
• \`/sightings Malaysia\`

━━━━━━━━━━━━━━━━━━━━
🐦 *SEARCH BY SPECIES*
━━━━━━━━━━━━━━━━━━━━
Use /species to find a specific bird, then choose a location

Examples:
• \`/species House Sparrow\`
• \`/species Common Myna\`
• \`/species Oriental Magpie-Robin\`

After finding the species, you'll be asked to enter a location.

*Other Commands:*
⭐ /notable [location] - Rare sightings
📍 /nearby - Birds near your GPS
🗺️ /hotspots [location] - Popular spots
📋 /regions - Region code help
    `;

    await this.sendMessage(chatId, helpMessage);
  }

  async handleSightings(msg, match) {
    const chatId = msg.chat.id;
    const userInput = match[1]?.trim();

    if (!userInput) {
      this.userStates.set(chatId, { action: 'awaiting_region_sightings' });
      await this.sendMessage(chatId, 
        `📍 *Enter a location to see recent bird sightings:*

You can type the full name or region code:
• \`Singapore\` or \`SG\`
• \`United States\` or \`US\`
• \`New York\` or \`US-NY\`
• \`California\` or \`US-CA\`
• \`Malaysia\` or \`MY\`

${getPopularLocations()}`
      );
      return;
    }

    const regionCode = toRegionCode(userInput);
    await this.fetchAndSendSightings(chatId, regionCode, userInput);
  }

  async fetchAndSendSightings(chatId, regionCode, originalInput = null, page = 0) {
    const displayName = originalInput || regionCode;
    const cacheKey = `sightings_${chatId}`;
    
    let observations;
    
    // Check cache first (for pagination)
    if (page > 0 && this.observationsCache.has(cacheKey)) {
      observations = this.observationsCache.get(cacheKey).observations;
    } else {
      await this.sendMessage(chatId, `🔍 Searching for recent sightings in *${displayName}* (${regionCode})...`);
      
      try {
        observations = await this.ebirdService.getRecentObservations(regionCode);
        // Cache the observations
        this.observationsCache.set(cacheKey, {
          observations,
          displayName,
          regionCode,
          type: 'sightings'
        });
      } catch (error) {
        await this.sendMessage(chatId, 
          `❌ Could not fetch sightings for *${regionCode}*.\n\nPlease check the region code and try again.\nUse /regions for help with codes.`
        );
        return;
      }
    }

    await this.sendPaginatedObservations(chatId, observations, displayName, 'sightings', page);
  }

  async sendPaginatedObservations(chatId, observations, displayName, type, page = 0, messageId = null) {
    if (!observations || observations.length === 0) {
      await this.sendMessage(chatId, '❌ No observations found for this location.');
      return;
    }

    const totalPages = Math.ceil(observations.length / this.ITEMS_PER_PAGE);
    const startIdx = page * this.ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + this.ITEMS_PER_PAGE, observations.length);
    const pageObservations = observations.slice(startIdx, endIdx);

    let title;
    if (type === 'notable') {
      title = `⭐ Notable Sightings in ${displayName}`;
    } else if (type === 'nearby') {
      title = `🐦 Birds Near ${displayName}`;
    } else if (type === 'species') {
      title = `🔎 ${displayName} Sightings`;
    } else {
      title = `🐦 Recent Sightings in ${displayName}`;
    }
    
    let message = `*${title}*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📊 Showing ${startIdx + 1}-${endIdx} of ${observations.length}\n`;
    message += `📄 Page ${page + 1} of ${totalPages}\n\n`;

    pageObservations.forEach((obs, index) => {
      message += `${startIdx + index + 1}. ${this.ebirdService.formatObservation(obs)}\n`;
    });

    // Create pagination buttons
    const buttons = [];
    const row = [];
    
    if (page > 0) {
      row.push({ text: '⬅️ Previous', callback_data: `page_${type}_${page - 1}` });
    }
    
    row.push({ text: `${page + 1}/${totalPages}`, callback_data: 'page_info' });
    
    if (page < totalPages - 1) {
      row.push({ text: 'Next ➡️', callback_data: `page_${type}_${page + 1}` });
    }
    
    buttons.push(row);

    const replyMarkup = {
      inline_keyboard: buttons
    };

    // If messageId is provided, edit the existing message instead of sending a new one
    if (messageId) {
      try {
        await this.bot.editMessageText(message, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: replyMarkup,
          disable_web_page_preview: true
        });
        return;
      } catch (error) {
        console.error('Error editing message:', error.message);
        // Fall through to send a new message if edit fails
      }
    }

    await this.sendMessage(chatId, message, {
      reply_markup: replyMarkup,
      disable_web_page_preview: true
    });
  }

  async handleNotable(msg, match) {
    const chatId = msg.chat.id;
    const userInput = match[1]?.trim();

    if (!userInput) {
      this.userStates.set(chatId, { action: 'awaiting_region_notable' });
      await this.sendMessage(chatId,
        `⭐ *Enter a location to see notable sightings:*

Notable sightings include rare species and unusual observations.

You can type the full name or region code:
• \`Singapore\` or \`SG\`
• \`United States\` or \`US\`
• \`New York\` or \`US-NY\``
      );
      return;
    }

    const regionCode = toRegionCode(userInput);
    await this.fetchAndSendNotable(chatId, regionCode, userInput);
  }

  async fetchAndSendNotable(chatId, regionCode, originalInput = null, page = 0) {
    const displayName = originalInput || regionCode;
    const cacheKey = `notable_${chatId}`;
    
    let observations;
    
    // Check cache first (for pagination)
    if (page > 0 && this.observationsCache.has(cacheKey)) {
      observations = this.observationsCache.get(cacheKey).observations;
    } else {
      await this.sendMessage(chatId, `🔍 Searching for notable sightings in *${displayName}* (${regionCode})...`);
      
      try {
        observations = await this.ebirdService.getNotableObservations(regionCode);
        // Cache the observations
        this.observationsCache.set(cacheKey, {
          observations,
          displayName,
          regionCode,
          type: 'notable'
        });
      } catch (error) {
        await this.sendMessage(chatId,
          `❌ Could not fetch notable sightings for *${displayName}* (${regionCode}).\n\nPlease check the location and try again.`
        );
        return;
      }
    }

    await this.sendPaginatedObservations(chatId, observations, displayName, 'notable', page);
  }

  async handleNearby(msg) {
    const chatId = msg.chat.id;

    await this.sendMessage(chatId,
      '📍 *Share your location to find nearby bird sightings!*\n\nI\'ll show you birds spotted within 25km of your location.',
      {
        reply_markup: {
          keyboard: [
            [{ text: '📍 Share My Location', request_location: true }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      }
    );
  }

  async handleLocation(msg) {
    const chatId = msg.chat.id;
    const { latitude, longitude } = msg.location;
    const mapsLink = `https://maps.google.com/?q=${latitude},${longitude}`;

    await this.sendMessage(chatId, 
      `📍 Location received!\n\n*Coordinates:* [${latitude.toFixed(4)}, ${longitude.toFixed(4)}](${mapsLink})\n\n🔍 Searching for nearby sightings...`,
      { reply_markup: { remove_keyboard: true } }
    );

    try {
      const [observations, hotspots] = await Promise.all([
        this.ebirdService.getNearbyObservations(latitude, longitude),
        this.ebirdService.getNearbyHotspots(latitude, longitude)
      ]);

      // Cache for pagination
      const cacheKey = `nearby_${chatId}`;
      this.observationsCache.set(cacheKey, {
        observations,
        displayName: 'Your Location',
        type: 'nearby'
      });

      await this.sendPaginatedObservations(chatId, observations, 'Your Location', 'nearby', 0);

      // Also send nearby hotspots
      if (hotspots && hotspots.length > 0) {
        let hotspotsMessage = '*🗺️ Nearby Birding Hotspots:*\n\n';
        hotspots.slice(0, 5).forEach((spot, index) => {
          hotspotsMessage += `${index + 1}. *${spot.locName}*\n`;
          if (spot.numSpeciesAllTime) {
            hotspotsMessage += `   🐦 Species recorded: ${spot.numSpeciesAllTime}\n`;
          }
          hotspotsMessage += '\n';
        });
        await this.sendMessage(chatId, hotspotsMessage);
      }
    } catch (error) {
      await this.sendMessage(chatId,
        '❌ Could not fetch nearby sightings. Please try again later.'
      );
    }
  }

  async handleHotspots(msg, match) {
    const chatId = msg.chat.id;
    const userInput = match[1]?.trim();

    if (!userInput) {
      this.userStates.set(chatId, { action: 'awaiting_region_hotspots' });
      await this.sendMessage(chatId,
        `🗺️ *Enter a location to find birding hotspots:*

You can type the full name or region code:
• \`Singapore\` or \`SG\`
• \`California\` or \`US-CA\`

Or share your location to find hotspots near you!`
      );
      return;
    }

    const regionCode = toRegionCode(userInput);
    await this.sendMessage(chatId, `🔍 Finding hotspots in *${userInput}* (${regionCode})...`);

    try {
      const hotspots = await this.ebirdService.getHotspots(regionCode);
      
      if (!hotspots || hotspots.length === 0) {
        await this.sendMessage(chatId, `❌ No hotspots found for *${userInput}*.`);
        return;
      }

      let message = `*🗺️ Birding Hotspots in ${userInput}*\n`;
      message += '━━━━━━━━━━━━━━━━━━━━\n\n';

      hotspots.slice(0, 10).forEach((spot, index) => {
        message += `${index + 1}. *${spot.locName}*\n`;
        if (spot.numSpeciesAllTime) {
          message += `   🐦 Species: ${spot.numSpeciesAllTime}\n`;
        }
        if (spot.latestObsDt) {
          message += `   📅 Last obs: ${spot.latestObsDt}\n`;
        }
        message += '\n';
      });

      if (hotspots.length > 10) {
        message += `\n_...and ${hotspots.length - 10} more hotspots_`;
      }

      await this.sendMessage(chatId, message);
    } catch (error) {
      await this.sendMessage(chatId,
        `❌ Could not fetch hotspots for *${userInput}*.`
      );
    }
  }

  async handleSpecies(msg, match) {
    const chatId = msg.chat.id;
    const input = match[1]?.trim();

    if (!input) {
      this.userStates.set(chatId, { action: 'awaiting_species_name' });
      await this.sendMessage(chatId,
        `🐦 *Search by Species Name*

Enter the species name you want to find:

*Examples:*
• \`House Sparrow\`
• \`Common Myna\`
• \`Oriental Magpie-Robin\`
• \`American Robin\`
• \`European Robin\`

💡 Use the full species name as it appears in eBird.
After finding the species, you can narrow down by location.`
      );
      return;
    }

    // Check if input contains comma (location, species format)
    if (input.includes(',')) {
      await this.processSpeciesWithLocation(chatId, input);
    } else {
      // Just species name - search globally and show locations
      await this.searchSpeciesGlobally(chatId, input);
    }
  }

  async searchSpeciesGlobally(chatId, speciesName) {
    await this.sendMessage(chatId, `🔍 Searching for *${speciesName}* in eBird database...`);

    try {
      // Search for the species in taxonomy
      const matches = await this.ebirdService.searchSpeciesByName(speciesName);
      
      if (!matches || matches.length === 0) {
        await this.sendMessage(chatId, 
          `❌ Species "*${speciesName}*" not found.\n\n💡 Try the exact species name as it appears in eBird, such as:\n• "House Sparrow"\n• "Common Myna"\n• "Oriental Magpie-Robin"`
        );
        return;
      }

      const species = matches[0];
      
      // Store species info for follow-up location search
      this.userStates.set(chatId, { 
        action: 'awaiting_species_location',
        species: {
          code: species.speciesCode,
          commonName: species.comName,
          scientificName: species.sciName
        }
      });

      let message = `✅ *Found: ${species.comName}*\n`;
      message += `🔬 _${species.sciName}_\n`;
      message += `📋 Species Code: \`${species.speciesCode}\`\n\n`;
      
      if (matches.length > 1) {
        message += `*Similar species:*\n`;
        matches.slice(1, 5).forEach(m => {
          message += `• ${m.comName}\n`;
        });
        message += `\n`;
      }
      
      message += `📍 *Now enter a location* to see sightings of ${species.comName}:\n\n`;
      message += `*Examples:*\n`;
      message += `• \`Singapore\`\n`;
      message += `• \`New York\`\n`;
      message += `• \`California\`\n`;
      message += `• \`Malaysia\`\n`;
      message += `• \`UK\``;

      await this.sendMessage(chatId, message);
    } catch (error) {
      console.error('Species search error:', error);
      await this.sendMessage(chatId, `❌ Error searching for species. Please try again.`);
    }
  }

  async processSpeciesWithLocation(chatId, input) {
    // Parse location and species - separated by comma
    const parts = input.split(',').map(p => p.trim());
    const locationInput = parts[0];
    const speciesInput = parts.slice(1).join(',').trim();

    if (!speciesInput || !locationInput) {
      await this.sendMessage(chatId, 
        `❌ Please provide both a location and a species name.\n\n*Format:* \`location, species name\`\n*Example:* \`Singapore, House Sparrow\``
      );
      return;
    }

    await this.fetchSpeciesInLocation(chatId, locationInput, speciesInput);
  }

  async fetchSpeciesInLocation(chatId, locationInput, speciesName, speciesCode = null) {
    const regionCode = toRegionCode(locationInput);
    
    await this.sendMessage(chatId, `🔍 Searching for *${speciesName}* in *${locationInput}*...`);

    try {
      let species, observations;

      if (speciesCode) {
        // We already have the species code
        observations = await this.ebirdService.getSpeciesObservations(regionCode, speciesCode);
        species = { commonName: speciesName, code: speciesCode };
      } else {
        // Need to look up the species first
        const result = await this.ebirdService.getObservationsBySpeciesName(regionCode, speciesName);
        
        if (!result.species) {
          await this.sendMessage(chatId, 
            `❌ Species "*${speciesName}*" not found in eBird database.\n\n💡 Try the exact species name as it appears in eBird.`
          );
          return;
        }
        
        species = result.species;
        observations = result.observations;
      }
      
      if (!observations || observations.length === 0) {
        await this.sendMessage(chatId, 
          `❌ No recent sightings of *${species.commonName}* in *${locationInput}*.\n\n💡 Try a broader location or different time period.`
        );
        return;
      }

      // Cache for pagination
      const cacheKey = `species_${chatId}`;
      this.observationsCache.set(cacheKey, {
        observations,
        displayName: `${species.commonName} in ${locationInput}`,
        type: 'species'
      });

      await this.sendPaginatedObservations(chatId, observations, `${species.commonName} in ${locationInput}`, 'species', 0);
    } catch (error) {
      console.error('Species location search error:', error);
      await this.sendMessage(chatId,
        `❌ Could not search for species in *${locationInput}*.\n\nPlease check the location name and try again.`
      );
    }
  }

  async handleRegions(msg) {
    const chatId = msg.chat.id;

    const regionsMessage = `
*🌍 Understanding Region Codes*

Region codes are used to specify geographic areas for bird sightings.

*Format:*
• Country: \`XX\` (2-letter ISO code)
• State/Province: \`XX-YY\` 
• County/District: \`XX-YY-ZZZ\`

*Examples:*

🇺🇸 *United States:*
• \`US\` - All of United States
• \`US-CA\` - California
• \`US-NY\` - New York
• \`US-TX\` - Texas
• \`US-CA-037\` - Los Angeles County

🇬🇧 *United Kingdom:*
• \`GB\` - United Kingdom
• \`GB-ENG\` - England
• \`GB-SCT\` - Scotland

🇨🇦 *Canada:*
• \`CA\` - Canada
• \`CA-ON\` - Ontario
• \`CA-BC\` - British Columbia

🇦🇺 *Australia:*
• \`AU\` - Australia
• \`AU-NSW\` - New South Wales
• \`AU-VIC\` - Victoria

🇩🇪 *Germany:*
• \`DE\` - Germany
• \`DE-BY\` - Bavaria
• \`DE-BE\` - Berlin

*Tip:* Start with a country code and add more detail as needed!
    `;

    await this.sendMessage(chatId, regionsMessage);
  }

  async handleCallback(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    // Acknowledge the callback
    await this.bot.answerCallbackQuery(callbackQuery.id);

    // Handle pagination
    if (data.startsWith('page_')) {
      const parts = data.split('_');
      const type = parts[1]; // 'sightings' or 'notable'
      const page = parseInt(parts[2]);
      
      const cacheKey = `${type}_${chatId}`;
      const cached = this.observationsCache.get(cacheKey);
      
      if (cached) {
        // Edit the existing message in place instead of delete+send
        await this.sendPaginatedObservations(chatId, cached.observations, cached.displayName, type, page, messageId);
      }
      return;
    }
    
    if (data === 'page_info') {
      // Just acknowledge, don't do anything
      return;
    }

    if (data.startsWith('sightings_')) {
      const regionCode = data.replace('sightings_', '');
      await this.fetchAndSendSightings(chatId, regionCode);
    } else if (data.startsWith('notable_')) {
      const regionCode = data.replace('notable_', '');
      await this.fetchAndSendNotable(chatId, regionCode);
    } else if (data === 'request_location') {
      await this.handleNearby({ chat: { id: chatId } });
    } else if (data === 'help') {
      await this.handleHelp({ chat: { id: chatId } });
    }
  }

  async handleMessage(msg) {
    // Skip if it's a command or location
    if (msg.text?.startsWith('/') || msg.location) return;

    const chatId = msg.chat.id;
    const userState = this.userStates.get(chatId);

    if (!userState) return;

    const text = msg.text?.trim();
    if (!text) return;

    // Convert location name to region code
    const regionCode = toRegionCode(text);

    switch (userState.action) {
      case 'awaiting_region_sightings':
        this.userStates.delete(chatId);
        await this.fetchAndSendSightings(chatId, regionCode, text);
        break;
      case 'awaiting_region_notable':
        this.userStates.delete(chatId);
        await this.fetchAndSendNotable(chatId, regionCode, text);
        break;
      case 'awaiting_region_hotspots':
        this.userStates.delete(chatId);
        await this.handleHotspots({ chat: { id: chatId } }, [null, ` ${text}`]);
        break;
      case 'awaiting_species_name':
        this.userStates.delete(chatId);
        // Check if input contains comma (location, species format)
        if (text.includes(',')) {
          await this.processSpeciesWithLocation(chatId, text);
        } else {
          await this.searchSpeciesGlobally(chatId, text);
        }
        break;
      case 'awaiting_species_location':
        // User is entering a location after finding a species
        const species = userState.species;
        this.userStates.delete(chatId);
        await this.fetchSpeciesInLocation(chatId, text, species.commonName, species.code);
        break;
    }
  }

  async sendMessage(chatId, text, options = {}) {
    try {
      return await this.bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        ...options
      });
    } catch (error) {
      console.error('Error sending message:', error.message);
      // Try sending without markdown if there's a parse error
      if (error.message.includes('parse')) {
        return await this.bot.sendMessage(chatId, text.replace(/[*_`]/g, ''), options);
      }
    }
  }

  getBot() {
    return this.bot;
  }
}

module.exports = BirdBot;
