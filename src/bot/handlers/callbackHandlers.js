/**
 * Callback Handlers — button press routing, date selection, custom date input.
 */
const { toRegionCode } = require('../../utils/regionCodes');
const {
  getDatePreset,
  parseDate,
  daysBackFromToday,
  formatDateDDMMYYYY,
  getDateRangeDescription,
  getStartOfDay,
  getEndOfDay
} = require('../../utils/dateUtils');

module.exports = {
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
    if (data === 'page_info') {
      // Just acknowledge, don't do anything
      return;
    }

    if (data.startsWith('page_')) {
      const parts = data.split('_');
      const type = parts[1]; // 'sightings' or 'notable'
      const page = parseInt(parts[2]);
      
      const cacheKey = `${type}_${chatId}`;
      const cached = this.observationsCache.get(cacheKey);
      
      if (cached) {
        // Edit the existing message in place instead of delete+send
        await this.sendPaginatedObservations(chatId, cached.observations, cached.displayName, type, page, messageId, cached.regionCode);
      }
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

    // Handle Summary button — species-grouped view
    if (data.startsWith('specsummary_')) {
      const type = data.replace('specsummary_', '');
      const cacheKey = `${type}_${chatId}`;
      const cached = this.observationsCache.get(cacheKey);

      if (cached) {
        const _sumStatus = await this.sendMessage(chatId, '📊 *Generating species summary...*');
        await this.sendSummaryMessage(chatId, cached.observations, cached.displayName, type, cached.regionCode);
        await this.deleteMsg(chatId, _sumStatus?.message_id);
      } else {
        await this.sendMessage(chatId, '❌ No cached results found. Please perform a new search.');
      }
      return;
    }

    // Handle Full List button — every sighting in detail
    if (data.startsWith('fulllist_')) {
      const type = data.replace('fulllist_', '');
      const cacheKey = `${type}_${chatId}`;
      const cached = this.observationsCache.get(cacheKey);

      if (cached) {
        const _fullStatus = await this.sendMessage(chatId, '📋 *Generating full list...*');
        await this.sendFullListMessage(chatId, cached.observations, cached.displayName, type, cached.regionCode);
        await this.deleteMsg(chatId, _fullStatus?.message_id);
      } else {
        await this.sendMessage(chatId, '❌ No cached results found. Please perform a new search.');
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
        const _shareStatus = await this.sendMessage(chatId, '📤 *Generating shareable list...*\n\n_Long-press or use the forward button ↗️ to share these messages:_');
        await this.sendForwardableMessage(chatId, cached.observations, cached.displayName, type, cached.regionCode);
        await this.deleteMsg(chatId, _shareStatus?.message_id);
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

    // Handle nearby distance selection
    if (data.startsWith('nearby_dist_')) {
      const dist = parseInt(data.replace('nearby_dist_', ''), 10);
      const state = this.userStates.get(chatId);
      if (state && state.action === 'awaiting_nearby_distance') {
        const { latitude, longitude } = state;
        this.userStates.delete(chatId);
        await this.fetchNearbySightings(chatId, latitude, longitude, dist);
      } else {
        await this.sendMessage(chatId, '⚠️ Please share your location again using /nearby.');
      }
      return;
    }

    // Handle "New Search" button
    if (data === 'new_search') {
      this.userStates.delete(chatId);
      const searchMessage = `🔍 *What would you like to search?*

Choose a search type:`;
      const searchButtons = [
        [
          { text: '📍 By Location', callback_data: 'cmd_sightings' },
          { text: '🐦 By Species', callback_data: 'cmd_species' }
        ],
        [
          { text: '⭐ Notable', callback_data: 'cmd_notable' },
          { text: '📍 Nearby', callback_data: 'cmd_nearby' }
        ],
        [
          { text: '🗺️ Hotspots', callback_data: 'cmd_hotspots' }
        ]
      ];
      await this.sendMessage(chatId, searchMessage, {
        reply_markup: { inline_keyboard: searchButtons }
      });
      return;
    }

    // Handle new search command shortcuts
    if (data === 'cmd_sightings') {
      await this.handleSightings({ chat: { id: chatId }, from: { first_name: '' } }, [null, '']);
      return;
    }
    if (data === 'cmd_species') {
      await this.handleSpecies({ chat: { id: chatId }, from: { first_name: '' } }, [null, '']);
      return;
    }
    if (data === 'cmd_notable') {
      await this.handleNotable({ chat: { id: chatId }, from: { first_name: '' } }, [null, '']);
      return;
    }
    if (data === 'cmd_nearby') {
      await this.handleNearby({ chat: { id: chatId } });
      return;
    }
    if (data === 'cmd_hotspots') {
      await this.handleHotspots({ chat: { id: chatId } }, [null, '']);
      return;
    }
    if (data === 'cmd_start') {
      await this.handleStart({ chat: { id: chatId }, from: { first_name: '' } });
      return;
    }

    // Handle "Done" button
    if (data === 'done') {
      await this.sendMessage(chatId, '✅ Happy birding! Send /start anytime to begin again. 🐦');
      this.userStates.delete(chatId);
      return;
    }
  },

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
    const dateFilter = getDatePreset(preset, regionCode);
    
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
  },

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
      
      label = getDateRangeDescription(startDate, endDate, regionCode);
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
};
