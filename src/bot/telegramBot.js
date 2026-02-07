const TelegramBot = require('node-telegram-bot-api');
const EBirdService = require('../services/ebirdService');
const { toRegionCode, getPopularLocations } = require('../utils/regionCodes');
const {
  getDatePreset,
  parseDate,
  daysBackFromToday,
  formatDateDDMMYYYY,
  filterObservationsByDateRange,
  getDateRangeDescription,
  getStartOfDay,
  getEndOfDay
} = require('../utils/dateUtils');

class BirdBot {
  constructor(telegramToken, ebirdApiKey, options = {}) {
    const useWebhook = options.useWebhook || false;
    
    // Configure bot based on mode
    if (useWebhook) {
      // Webhook mode for production (Azure)
      this.bot = new TelegramBot(telegramToken, { webHook: true });
    } else {
      // Polling mode for local development
      this.bot = new TelegramBot(telegramToken, { polling: true });
    }
    
    this.ebirdService = new EBirdService(ebirdApiKey);
    this.userStates = new Map(); // Track user conversation states
    this.observationsCache = new Map(); // Cache observations for pagination
    this.lastPrompts = new Map(); // Store last prompt messages for error recovery
    this.ITEMS_PER_PAGE = 5; // Number of observations per page
    
    this.setupCommands();
    this.setupHandlers();
  }

  // Process incoming webhook updates
  processUpdate(update) {
    this.bot.processUpdate(update);
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

*By Region:*
• \`/sightings Singapore\`
• \`/sightings New York\`

*By Specific Place:*
• \`/sightings Botanic Gardens, Singapore\`
• \`/sightings Central Park, USA\`

💡 Use /hotspots to discover location names

━━━━━━━━━━━━━━━━━━━━
🐦 *SEARCH BY SPECIES*
━━━━━━━━━━━━━━━━━━━━
Use /species to find a specific bird

Examples:
• \`/species House Sparrow\`
• \`/species Common Myna\`

*Other Commands:*
⭐ /notable - Rare sightings
📍 /nearby - Birds near your GPS
🗺️ /hotspots - Find location names
📋 /regions - Region code help
    `;

    await this.sendMessage(chatId, helpMessage);
  }

  async handleSightings(msg, match) {
    const chatId = msg.chat.id;
    const userInput = match[1]?.trim();

    if (!userInput) {
      this.userStates.set(chatId, { action: 'awaiting_region_sightings' });
      const promptMessage = `📍 *Enter a location to see recent bird sightings:*

You can type:
• Region: \`Singapore\`, \`New York\`, \`Malaysia\`
• Specific place: \`Botanic Gardens, Singapore\`
• Region code: \`SG\`, \`US-NY\`, \`MY\`

${getPopularLocations()}`;
      
      // Store for error recovery
      this.lastPrompts.set(chatId, { message: promptMessage, action: 'awaiting_region_sightings' });
      await this.sendMessage(chatId, promptMessage);
      return;
    }

    // Check if input contains comma (specific place + region format)
    if (userInput.includes(',')) {
      await this.handlePlaceSearch(chatId, userInput, 'sightings');
    } else {
      const regionCode = toRegionCode(userInput);
      await this.showDateSelection(chatId, regionCode, userInput, 'sightings');
    }
  }

  /**
   * Handle place search (e.g., "Botanic Gardens, Singapore")
   * Format: Location, Country
   */
  async handlePlaceSearch(chatId, input, type) {
    const parts = input.split(',').map(p => p.trim());
    const placeName = parts[0];
    const regionInput = parts.slice(1).join(',').trim();

    if (!placeName || !regionInput) {
      await this.sendMessage(chatId, 
        `❌ Please provide both place and region.\n\n*Format:* \`Location, Country\`\n*Example:* \`Botanic Gardens, Singapore\``
      );
      return;
    }

    const regionCode = toRegionCode(regionInput);
    
    await this.sendMessage(chatId, `🔍 Searching for "*${placeName}*" in *${regionInput}*...`);

    try {
      const hotspots = await this.ebirdService.searchHotspotsByName(regionCode, placeName);
      
      if (!hotspots || hotspots.length === 0) {
        // Try to show popular hotspots as alternatives
        const popularHotspots = await this.ebirdService.getPopularHotspots(regionCode, 5);
        
        let message = `❌ No locations found matching "*${placeName}*" in *${regionInput}*.`;
        
        if (popularHotspots && popularHotspots.length > 0) {
          message += `\n\n💡 *Popular birding spots in ${regionInput}:*\n`;
          popularHotspots.forEach((h, i) => {
            message += `${i + 1}. ${h.locName}`;
            if (h.numSpeciesAllTime) message += ` (${h.numSpeciesAllTime} species)`;
            message += `\n`;
          });
          message += `\n_Try searching for one of these locations, or search the entire region with just_ \`${regionInput}\``;
        } else {
          message += `\n\n💡 Try searching the entire region with just \`${regionInput}\``;
        }
        
        await this.sendMessage(chatId, message);
        
        // Resend last prompt if available
        await this.resendLastPrompt(chatId);
        return;
      }

      if (hotspots.length === 1) {
        // Only one match - proceed directly
        const hotspot = hotspots[0];
        await this.showDateSelection(chatId, hotspot.locId, hotspot.locName, type, {
          isHotspot: true,
          hotspotData: hotspot
        });
      } else {
        // Multiple matches - show selection
        await this.showHotspotSelection(chatId, hotspots, type, regionInput);
      }
    } catch (error) {
      console.error('Place search error:', error);
      await this.sendMessage(chatId, 
        `❌ Error searching for locations. Please try again.\n\n💡 You can also search the entire region with just \`${regionInput}\``
      );
      await this.resendLastPrompt(chatId);
    }
  }

  /**
   * Show hotspot selection to user
   */
  async showHotspotSelection(chatId, hotspots, type, regionName) {
    let message = `📍 *Found ${hotspots.length} locations in ${regionName}:*\n\n`;
    message += `Select a location:\n`;

    const buttons = hotspots.slice(0, 8).map((hotspot, index) => {
      const speciesInfo = hotspot.numSpeciesAllTime ? ` (${hotspot.numSpeciesAllTime} species)` : '';
      return [{
        text: `${index + 1}. ${hotspot.locName}${speciesInfo}`,
        callback_data: `hotspot_${type}_${hotspot.locId}`
      }];
    });

    // Store hotspots for callback
    this.userStates.set(chatId, {
      action: 'hotspot_selection',
      hotspots: hotspots.slice(0, 8),
      type
    });

    await this.sendMessage(chatId, message, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  /**
   * Resend last prompt message for error recovery
   */
  async resendLastPrompt(chatId) {
    const lastPrompt = this.lastPrompts.get(chatId);
    if (lastPrompt) {
      await this.sendMessage(chatId, `\n${lastPrompt.message}`);
      this.userStates.set(chatId, { action: lastPrompt.action });
    }
  }

  /**
   * Show date selection options to the user
   */
  async showDateSelection(chatId, regionCode, displayName, type, options = {}) {
    const { isHotspot = false, hotspotData = null } = options;
    
    const message = `📅 *Select date for ${displayName}:*

Choose a preset or enter a custom date.
_All sightings from 00:00 to 23:59 of selected date(s)_

*Quick Options:*`;

    const buttons = [
      [
        { text: '📅 Today', callback_data: `date_${type}_today_${regionCode}` },
        { text: '📅 Yesterday', callback_data: `date_${type}_yesterday_${regionCode}` }
      ],
      [
        { text: '📅 Last 3 Days', callback_data: `date_${type}_last_3_days_${regionCode}` },
        { text: '📅 Last Week', callback_data: `date_${type}_last_week_${regionCode}` }
      ],
      [
        { text: '📅 Last 14 Days', callback_data: `date_${type}_last_14_days_${regionCode}` },
        { text: '📅 Last Month', callback_data: `date_${type}_last_month_${regionCode}` }
      ],
      [
        { text: '📆 Custom Date', callback_data: `date_${type}_custom_${regionCode}` }
      ]
    ];

    // Store the pending query info
    this.userStates.set(chatId, {
      action: 'date_selection',
      regionCode,
      displayName,
      type,
      isHotspot,
      hotspotData
    });

    // Store for error recovery
    this.lastPrompts.set(chatId, { 
      message, 
      action: 'date_selection',
      regionCode,
      displayName,
      type
    });

    await this.sendMessage(chatId, message, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  async fetchAndSendSightings(chatId, regionCode, originalInput = null, page = 0, dateFilter = null, isHotspot = false) {
    const displayName = originalInput || regionCode;
    const cacheKey = `sightings_${chatId}`;
    
    let observations;
    let dateLabel = '';
    
    // Check cache first (for pagination)
    if (page > 0 && this.observationsCache.has(cacheKey)) {
      const cached = this.observationsCache.get(cacheKey);
      observations = cached.observations;
      dateLabel = cached.dateLabel || '';
    } else {
      // Use date filter to determine how many days back to fetch
      const backDays = dateFilter?.backDays || 14;
      dateLabel = dateFilter?.label || 'Last 14 Days';
      
      const locationLabel = isHotspot ? '📍 Hotspot' : '🗺️ Region';
      await this.sendMessage(chatId, `🔍 Searching for sightings in *${displayName}*\n${locationLabel}: ${regionCode}\n📅 ${dateLabel}...`);
      
      try {
        // Use different API method for hotspots vs regions
        if (isHotspot) {
          observations = await this.ebirdService.getHotspotObservations(regionCode, backDays, 100);
        } else {
          observations = await this.ebirdService.getRecentObservations(regionCode, backDays, 100);
        }
        
        // Apply date range filter if specified
        if (dateFilter?.startDate && dateFilter?.endDate) {
          observations = filterObservationsByDateRange(
            observations,
            dateFilter.startDate,
            dateFilter.endDate
          );
        }
        
        // Cache the observations with full display name including date
        const fullDisplayName = dateLabel ? `${displayName} (${dateLabel})` : displayName;
        this.observationsCache.set(cacheKey, {
          observations,
          displayName: fullDisplayName,
          regionCode,
          type: 'sightings',
          dateLabel,
          dateFilter,
          isHotspot
        });
      } catch (error) {
        await this.sendMessage(chatId, 
          `❌ Could not fetch sightings for *${displayName}*.\n\nPlease check the location and try again.`
        );
        // Resend last prompt for error recovery
        await this.resendLastPrompt(chatId);
        return;
      }
    }

    if (!observations || observations.length === 0) {
      await this.sendMessage(chatId, `❌ No observations found for *${displayName}* in the selected time range.`);
      await this.resendLastPrompt(chatId);
      return;
    }

    const titleSuffix = dateLabel ? ` (${dateLabel})` : '';
    await this.sendPaginatedObservations(chatId, observations, `${displayName}${titleSuffix}`, 'sightings', page);
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

    pageObservations.forEach((obs) => {
      message += `${this.ebirdService.formatObservation(obs)}\n`;
    });

    // Create pagination buttons
    const buttons = [];
    
    // First row: First, Previous, Page Info, Next, Last
    const navRow = [];
    
    // First page button (only show if not on first page)
    if (page > 0) {
      navRow.push({ text: '⏮️ First', callback_data: `page_${type}_0` });
      navRow.push({ text: '⬅️ Prev', callback_data: `page_${type}_${page - 1}` });
    }
    
    navRow.push({ text: `${page + 1}/${totalPages}`, callback_data: 'page_info' });
    
    // Next and Last page buttons (only show if not on last page)
    if (page < totalPages - 1) {
      navRow.push({ text: 'Next ➡️', callback_data: `page_${type}_${page + 1}` });
      navRow.push({ text: 'Last ⏭️', callback_data: `page_${type}_${totalPages - 1}` });
    }
    
    buttons.push(navRow);
    
    // Second row: Jump to page (only show if more than 2 pages)
    if (totalPages > 2) {
      buttons.push([{ text: '🔢 Jump to Page', callback_data: `jump_${type}` }]);
    }
    
    // Third row: Share button
    buttons.push([{ text: '📤 Share All', callback_data: `share_${type}` }]);

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

  /**
   * Send the complete list as forwardable messages (no pagination buttons)
   */
  async sendForwardableMessage(chatId, observations, displayName, type) {
    const MAX_MESSAGE_LENGTH = 4000; // Telegram limit is 4096, leave some buffer
    
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
    
    // Build header
    let header = `📤 *Shared Bird Sightings*\n`;
    header += `━━━━━━━━━━━━━━━━━━━━\n`;
    header += `*${title}*\n`;
    header += `📊 Total: ${observations.length} sightings\n\n`;
    
    // Build all observation lines (without numbering)
    const allLines = observations.map((obs) => 
      this.ebirdService.formatObservation(obs)
    );
    
    // Split into multiple messages if needed
    const messages = [];
    let currentMessage = header;
    let currentPart = 1;
    
    for (const line of allLines) {
      // Check if adding this line would exceed the limit
      if (currentMessage.length + line.length + 2 > MAX_MESSAGE_LENGTH) {
        // Save current message and start a new one
        messages.push(currentMessage);
        currentPart++;
        currentMessage = `📤 *Shared Bird Sightings (Part ${currentPart})*\n`;
        currentMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      }
      currentMessage += line + '\n';
    }
    
    // Add footer to last message
    currentMessage += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    currentMessage += `🤖 _Shared via Bird Sighting Bot_\n`;
    currentMessage += `📱 _Forward this message to share!_`;
    messages.push(currentMessage);
    
    // Send all messages (no buttons so they can be forwarded cleanly)
    for (const msg of messages) {
      await this.sendMessage(chatId, msg, {
        disable_web_page_preview: true
      });
    }
  }

  async handleNotable(msg, match) {
    const chatId = msg.chat.id;
    const userInput = match[1]?.trim();

    if (!userInput) {
      this.userStates.set(chatId, { action: 'awaiting_region_notable' });
      const promptMessage = `⭐ *Enter a location to see notable sightings:*

Notable sightings include rare species and unusual observations.

You can type:
• Region: \`Singapore\`, \`New York\`, \`US\`
• Specific place: \`Botanic Gardens, Singapore\``;

      // Store for error recovery
      this.lastPrompts.set(chatId, { message: promptMessage, action: 'awaiting_region_notable' });
      await this.sendMessage(chatId, promptMessage);
      return;
    }

    // Check if input contains comma (specific place + region format)
    if (userInput.includes(',')) {
      await this.handlePlaceSearch(chatId, userInput, 'notable');
    } else {
      const regionCode = toRegionCode(userInput);
      await this.showDateSelection(chatId, regionCode, userInput, 'notable');
    }
  }

  async fetchAndSendNotable(chatId, regionCode, originalInput = null, page = 0, dateFilter = null, isHotspot = false) {
    const displayName = originalInput || regionCode;
    const cacheKey = `notable_${chatId}`;
    
    let observations;
    let dateLabel = '';
    
    // Check cache first (for pagination)
    if (page > 0 && this.observationsCache.has(cacheKey)) {
      const cached = this.observationsCache.get(cacheKey);
      observations = cached.observations;
      dateLabel = cached.dateLabel || '';
    } else {
      // Use date filter to determine how many days back to fetch
      const backDays = dateFilter?.backDays || 14;
      dateLabel = dateFilter?.label || 'Last 14 Days';
      
      const locationLabel = isHotspot ? '📍 Hotspot' : '🗺️ Region';
      await this.sendMessage(chatId, `🔍 Searching for notable sightings in *${displayName}*\n${locationLabel}: ${regionCode}\n📅 ${dateLabel}...`);
      
      try {
        // Use different API method for hotspots vs regions
        // Note: eBird doesn't have a specific notable endpoint for hotspots,
        // so we fetch all observations and the notable ones will be included
        if (isHotspot) {
          observations = await this.ebirdService.getHotspotObservations(regionCode, backDays, 100);
        } else {
          observations = await this.ebirdService.getNotableObservations(regionCode, backDays, 100);
        }
        
        // Apply date range filter if specified
        if (dateFilter?.startDate && dateFilter?.endDate) {
          observations = filterObservationsByDateRange(
            observations,
            dateFilter.startDate,
            dateFilter.endDate
          );
        }
        
        // Cache the observations with full display name including date
        const fullDisplayName = dateLabel ? `${displayName} (${dateLabel})` : displayName;
        this.observationsCache.set(cacheKey, {
          observations,
          displayName: fullDisplayName,
          regionCode,
          type: 'notable',
          dateLabel,
          dateFilter,
          isHotspot
        });
      } catch (error) {
        await this.sendMessage(chatId,
          `❌ Could not fetch notable sightings for *${displayName}*.\n\nPlease check the location and try again.`
        );
        // Resend last prompt for error recovery
        await this.resendLastPrompt(chatId);
        return;
      }
    }

    if (!observations || observations.length === 0) {
      await this.sendMessage(chatId, `❌ No notable observations found for *${displayName}* in the selected time range.`);
      await this.resendLastPrompt(chatId);
      return;
    }

    const titleSuffix = dateLabel ? ` (${dateLabel})` : '';
    await this.sendPaginatedObservations(chatId, observations, `${displayName}${titleSuffix}`, 'notable', page);
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
        `🗺️ *Enter a region to find birding hotspots:*

You can type the full name or region code:
• \`Singapore\` or \`SG\`
• \`California\` or \`US-CA\`

💡 Use /hotspots to discover location names you can search with /sightings`
      );
      return;
    }

    const regionCode = toRegionCode(userInput);
    await this.sendMessage(chatId, `🔍 Finding popular birding hotspots in *${userInput}* (${regionCode})...`);

    try {
      const hotspots = await this.ebirdService.getPopularHotspots(regionCode, 15);
      
      if (!hotspots || hotspots.length === 0) {
        await this.sendMessage(chatId, `❌ No hotspots found for *${userInput}*.`);
        return;
      }

      let message = `*🗺️ Popular Birding Hotspots in ${userInput}*\n`;
      message += '━━━━━━━━━━━━━━━━━━━━\n';
      message += `_Sorted by number of species recorded_\n\n`;

      hotspots.slice(0, 10).forEach((spot, index) => {
        message += `${index + 1}. *${spot.locName}*\n`;
        if (spot.numSpeciesAllTime) {
          message += `   🐦 ${spot.numSpeciesAllTime} species recorded\n`;
        }
        message += '\n';
      });

      message += `\n💡 *To search a specific location:*\n`;
      message += `Type: \`Location Name, ${userInput}\`\n`;
      message += `Example: \`${hotspots[0]?.locName?.split('--')[0]?.trim() || 'Park Name'}, ${userInput}\``;

      // Create buttons for top 5 hotspots to view sightings
      const buttons = hotspots.slice(0, 5).map((spot) => [{
        text: `📍 ${spot.locName.substring(0, 35)}${spot.locName.length > 35 ? '...' : ''}`,
        callback_data: `hotspot_sightings_${spot.locId}`
      }]);

      await this.sendMessage(chatId, message, {
        reply_markup: { inline_keyboard: buttons }
      });
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

    // Search for the species first
    await this.sendMessage(chatId, `🔍 Looking up *${speciesInput}*...`);
    
    try {
      const matches = await this.ebirdService.searchSpeciesByName(speciesInput);
      
      if (!matches || matches.length === 0) {
        await this.sendMessage(chatId, 
          `❌ Species "*${speciesInput}*" not found.\n\n💡 Try the exact species name as it appears in eBird.`
        );
        return;
      }
      
      const species = matches[0];
      
      // Show date selection
      await this.showSpeciesDateSelection(chatId, locationInput, {
        code: species.speciesCode,
        commonName: species.comName,
        scientificName: species.sciName
      });
    } catch (error) {
      console.error('Species search error:', error);
      await this.sendMessage(chatId, `❌ Error searching for species. Please try again.`);
    }
  }

  async fetchSpeciesInLocation(chatId, locationInput, speciesName, speciesCode = null, dateFilter = null) {
    const regionCode = toRegionCode(locationInput);
    
    // Use date filter to determine how many days back to fetch
    const backDays = dateFilter?.backDays || 14;
    const dateLabel = dateFilter?.label || 'Last 14 Days';
    
    await this.sendMessage(chatId, `🔍 Searching for *${speciesName}* in *${locationInput}*\n📅 ${dateLabel}...`);

    try {
      let species, observations;

      if (speciesCode) {
        // We already have the species code
        observations = await this.ebirdService.getSpeciesObservations(regionCode, speciesCode, backDays);
        species = { commonName: speciesName, code: speciesCode };
      } else {
        // Need to look up the species first
        const result = await this.ebirdService.getObservationsBySpeciesName(regionCode, speciesName, backDays);
        
        if (!result.species) {
          await this.sendMessage(chatId, 
            `❌ Species "*${speciesName}*" not found in eBird database.\n\n💡 Try the exact species name as it appears in eBird.`
          );
          return;
        }
        
        species = result.species;
        observations = result.observations;
      }
      
      // Apply date range filter if specified
      if (dateFilter?.startDate && dateFilter?.endDate) {
        observations = filterObservationsByDateRange(
          observations,
          dateFilter.startDate,
          dateFilter.endDate
        );
      }
      
      if (!observations || observations.length === 0) {
        await this.sendMessage(chatId, 
          `❌ No recent sightings of *${species.commonName}* in *${locationInput}*.\n\n💡 Try a broader location or different time period.`
        );
        return;
      }

      // Cache for pagination
      const cacheKey = `species_${chatId}`;
      const displayName = `${species.commonName} in ${locationInput} (${dateLabel})`;
      this.observationsCache.set(cacheKey, {
        observations,
        displayName,
        type: 'species',
        dateLabel,
        dateFilter
      });

      await this.sendPaginatedObservations(chatId, observations, displayName, 'species', 0);
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

    // Handle date selection callbacks
    if (data.startsWith('date_')) {
      await this.handleDateCallback(chatId, data, messageId);
      return;
    }

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

    // Handle jump to page
    if (data.startsWith('jump_')) {
      const type = data.split('_')[1];
      const cacheKey = `${type}_${chatId}`;
      const cached = this.observationsCache.get(cacheKey);
      
      if (cached) {
        const totalPages = Math.ceil(cached.observations.length / this.ITEMS_PER_PAGE);
        this.userStates.set(chatId, { 
          action: 'awaiting_jump_page', 
          type,
          totalPages,
          messageId
        });
        await this.sendMessage(chatId, `🔢 *Enter a page number (1-${totalPages}):*`);
      }
      return;
    }

    // Handle share button - show forward options
    if (data.startsWith('share_')) {
      const parts = data.split('_');
      const type = parts[1];
      
      const cacheKey = `${type}_${chatId}`;
      const cached = this.observationsCache.get(cacheKey);
      
      if (cached) {
        // Show share options
        const shareMessage = `📤 *Share Bird Sightings*\n\nHow would you like to share?\n\nOnce I send the list, you can:\n• Long-press the message → Forward\n• Or tap the forward icon ↗️`;
        
        const shareButtons = [
          [{ text: '📋 Generate Shareable List', callback_data: `generate_share_${type}` }],
          [{ text: '❌ Cancel', callback_data: 'cancel_share' }]
        ];
        
        await this.sendMessage(chatId, shareMessage, {
          reply_markup: { inline_keyboard: shareButtons }
        });
      } else {
        await this.sendMessage(chatId, '❌ Unable to share. Please perform a new search.');
      }
      return;
    }

    // Handle generate shareable list
    if (data.startsWith('generate_share_')) {
      const type = data.replace('generate_share_', '');
      const cacheKey = `${type}_${chatId}`;
      const cached = this.observationsCache.get(cacheKey);
      
      if (cached) {
        await this.sendMessage(chatId, '📤 *Generating shareable list...*\n\n_Long-press or use the forward button ↗️ to share these messages:_');
        await this.sendForwardableMessage(chatId, cached.observations, cached.displayName, type);
      } else {
        await this.sendMessage(chatId, '❌ Unable to share. Please perform a new search.');
      }
      return;
    }

    // Handle cancel share
    if (data === 'cancel_share') {
      await this.sendMessage(chatId, '✅ Share cancelled.');
      return;
    }

    if (data.startsWith('sightings_')) {
      const regionCode = data.replace('sightings_', '');
      await this.showDateSelection(chatId, regionCode, regionCode, 'sightings');
    } else if (data.startsWith('notable_')) {
      const regionCode = data.replace('notable_', '');
      await this.showDateSelection(chatId, regionCode, regionCode, 'notable');
    } else if (data.startsWith('hotspot_')) {
      // Handle hotspot selection: hotspot_{type}_{locId}
      const parts = data.split('_');
      const type = parts[1];
      const locId = parts.slice(2).join('_');
      
      // Get hotspot details from stored state
      const userState = this.userStates.get(chatId);
      const hotspot = userState?.hotspots?.find(h => h.locId === locId);
      
      if (hotspot) {
        await this.showDateSelection(chatId, locId, hotspot.locName, type, {
          isHotspot: true,
          hotspotData: hotspot
        });
      } else {
        await this.showDateSelection(chatId, locId, locId, type, { isHotspot: true });
      }
    } else if (data === 'request_location') {
      await this.handleNearby({ chat: { id: chatId } });
    } else if (data === 'help') {
      await this.handleHelp({ chat: { id: chatId } });
    }
  }

  /**
   * Handle date selection callback
   */
  async handleDateCallback(chatId, data, messageId) {
    // Parse the callback data: date_{type}_{preset}_{regionCode}
    const parts = data.split('_');
    // Format: date_sightings_today_SG or date_notable_last_week_US-NY
    const type = parts[1]; // sightings, notable, or species
    
    // Find where the preset ends and region code begins
    // Presets can have underscores: today, yesterday, last_3_days, last_week, last_14_days, last_month, custom
    let preset, regionCode;
    
    if (parts[2] === 'custom') {
      preset = 'custom';
      regionCode = parts.slice(3).join('_');
    } else if (parts[2] === 'last') {
      // Handles last_3_days, last_week, last_14_days, last_month
      preset = `${parts[2]}_${parts[3]}`;
      if (parts[3] === '3' || parts[3] === '14') {
        preset = `${parts[2]}_${parts[3]}_${parts[4]}`;
        regionCode = parts.slice(5).join('_');
      } else {
        // last_week, last_month
        regionCode = parts.slice(4).join('_');
      }
    } else {
      // today, yesterday
      preset = parts[2];
      regionCode = parts.slice(3).join('_');
    }

    // Get the stored state for display name
    const userState = this.userStates.get(chatId);
    const displayName = userState?.displayName || regionCode;
    const isHotspot = userState?.isHotspot || false;

    // Clear the state
    this.userStates.delete(chatId);

    if (preset === 'custom') {
      // Ask for custom date range
      this.userStates.set(chatId, {
        action: 'awaiting_custom_date',
        regionCode,
        displayName,
        type,
        isHotspot
      });
      
      const customMessage = `📆 *Enter custom date:*

*Option 1: Single Date*
Enter a date to see all sightings for that day:
_(from 00:00 to 23:59 of that date)_
Format: \`DD/MM/YYYY\` or \`YYYY-MM-DD\`

*Option 2: Multiple Days*
Enter start and end dates separated by " to ":
Format: \`DD/MM/YYYY to DD/MM/YYYY\`
_(from 00:00 of start date to 23:59 of end date)_

*Examples:*
• \`01/02/2026\` - All sightings on 1 Feb 2026
• \`01/02/2026 to 07/02/2026\` - Sightings from 1-7 Feb 2026

⚠️ Note: eBird API limits data to the last 30 days.`;

      // Store for error recovery
      this.lastPrompts.set(chatId, { 
        message: customMessage, 
        action: 'awaiting_custom_date',
        regionCode,
        displayName,
        type,
        isHotspot
      });
      
      await this.sendMessage(chatId, customMessage);
      return;
    }

    // Get the date preset
    const dateFilter = getDatePreset(preset);
    
    // Fetch and send based on type
    if (type === 'sightings') {
      await this.fetchAndSendSightings(chatId, regionCode, displayName, 0, dateFilter, isHotspot);
    } else if (type === 'notable') {
      await this.fetchAndSendNotable(chatId, regionCode, displayName, 0, dateFilter, isHotspot);
    } else if (type === 'species') {
      const speciesInfo = userState?.species;
      if (speciesInfo) {
        await this.fetchSpeciesInLocation(chatId, displayName, speciesInfo.commonName, speciesInfo.code, dateFilter);
      }
    }
  }

  /**
   * Handle custom date input from user
   */
  async handleCustomDateInput(chatId, text, userState) {
    const { regionCode, displayName, type, species, isHotspot = false } = userState;
    
    // Check if it's a date range (contains " to ")
    let startDate, endDate, label;
    
    if (text.toLowerCase().includes(' to ')) {
      const [startStr, endStr] = text.split(/\s+to\s+/i);
      startDate = parseDate(startStr);
      endDate = parseDate(endStr);
      
      if (!startDate || !endDate) {
        await this.sendMessage(chatId, 
          `❌ Invalid date format. Please use:\n• Single date: \`DD/MM/YYYY\`\n• Date range: \`DD/MM/YYYY to DD/MM/YYYY\``
        );
        return;
      }
      
      // Ensure start is before end
      if (startDate > endDate) {
        [startDate, endDate] = [endDate, startDate];
      }
      
      label = getDateRangeDescription(startDate, endDate);
    } else {
      // Single date
      startDate = parseDate(text);
      
      if (!startDate) {
        await this.sendMessage(chatId, 
          `❌ Invalid date format. Please use:\n• Single date: \`DD/MM/YYYY\`\n• Date range: \`DD/MM/YYYY to DD/MM/YYYY\``
        );
        return;
      }
      
      endDate = startDate;
      label = formatDateDDMMYYYY(startDate);
    }
    
    // Check if dates are within eBird's 30-day limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    if (startDate < thirtyDaysAgo) {
      await this.sendMessage(chatId, 
        `⚠️ eBird API only provides data for the last 30 days.\n\n📅 Available range: ${formatDateDDMMYYYY(thirtyDaysAgo)} to ${formatDateDDMMYYYY(today)}\n\nPlease enter a date within this range.`
      );
      return;
    }
    
    // Set to full day range (00:00 - 23:59)
    startDate = getStartOfDay(startDate);
    endDate = getEndOfDay(endDate);
    
    // Calculate days back
    const backDays = daysBackFromToday(startDate);
    
    const dateFilter = {
      startDate,
      endDate,
      backDays: Math.min(backDays, 30),
      label
    };
    
    // Clear the state
    this.userStates.delete(chatId);
    
    // Fetch and send based on type
    if (type === 'sightings') {
      await this.fetchAndSendSightings(chatId, regionCode, displayName, 0, dateFilter, isHotspot);
    } else if (type === 'notable') {
      await this.fetchAndSendNotable(chatId, regionCode, displayName, 0, dateFilter, isHotspot);
    } else if (type === 'species' && species) {
      await this.fetchSpeciesInLocation(chatId, displayName, species.commonName, species.code, dateFilter);
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
        // Check if input contains comma (place + region format)
        if (text.includes(',')) {
          await this.handlePlaceSearch(chatId, text, 'sightings');
        } else {
          await this.showDateSelection(chatId, regionCode, text, 'sightings');
        }
        break;
      case 'awaiting_region_notable':
        this.userStates.delete(chatId);
        // Check if input contains comma (place + region format)
        if (text.includes(',')) {
          await this.handlePlaceSearch(chatId, text, 'notable');
        } else {
          await this.showDateSelection(chatId, regionCode, text, 'notable');
        }
        break;
      case 'awaiting_custom_date':
        await this.handleCustomDateInput(chatId, text, userState);
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
        // User is entering a location after finding a species - show date selection
        await this.showSpeciesDateSelection(chatId, text, userState.species);
        break;
      case 'awaiting_jump_page':
        // User is entering a page number for pagination
        this.userStates.delete(chatId);
        const pageNum = parseInt(text);
        if (isNaN(pageNum) || pageNum < 1 || pageNum > userState.totalPages) {
          await this.sendMessage(chatId, `❌ Invalid page number. Please enter a number between 1 and ${userState.totalPages}.`);
        } else {
          const cacheKey = `${userState.type}_${chatId}`;
          const cached = this.observationsCache.get(cacheKey);
          if (cached) {
            await this.sendPaginatedObservations(chatId, cached.observations, cached.displayName, userState.type, pageNum - 1);
          }
        }
        break;
    }
  }

  /**
   * Show date selection for species search
   */
  async showSpeciesDateSelection(chatId, locationInput, species) {
    const regionCode = toRegionCode(locationInput);
    
    const message = `📅 *Select date for ${species.commonName} in ${locationInput}:*

Choose a preset or enter a custom date.
_All sightings from 00:00 to 23:59 of selected date(s)_`;

    const buttons = [
      [
        { text: '📅 Today', callback_data: `date_species_today_${regionCode}` },
        { text: '📅 Yesterday', callback_data: `date_species_yesterday_${regionCode}` }
      ],
      [
        { text: '📅 Last 3 Days', callback_data: `date_species_last_3_days_${regionCode}` },
        { text: '📅 Last Week', callback_data: `date_species_last_week_${regionCode}` }
      ],
      [
        { text: '📅 Last 14 Days', callback_data: `date_species_last_14_days_${regionCode}` },
        { text: '📅 Last Month', callback_data: `date_species_last_month_${regionCode}` }
      ],
      [
        { text: '📆 Custom Date', callback_data: `date_species_custom_${regionCode}` }
      ]
    ];

    // Keep species info in state for after date selection
    this.userStates.set(chatId, {
      action: 'date_selection',
      regionCode,
      displayName: locationInput,
      type: 'species',
      species
    });

    await this.sendMessage(chatId, message, {
      reply_markup: { inline_keyboard: buttons }
    });
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
