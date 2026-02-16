/**
 * Sightings Handlers — location-based sighting search flow.
 * Handles /sightings, place search, hotspot selection, date selection, and fetching results.
 */
const { toRegionCode, getPopularLocations } = require('../../utils/regionCodes');
const { filterObservationsByDateRange } = require('../../utils/dateUtils');
const logger = require('../../utils/logger');
const { esc } = require('../../utils/markdown');
const sheetsService = require('../../services/sheetsService');

module.exports = {
  async handleSightings(msg, match) {
    const chatId = msg.chat.id;
    this.userNames.set(chatId, msg.from?.username || msg.from?.first_name || 'unknown');
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
  },

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
    
    const _placeStatus = await this.sendMessage(chatId, `🔍 Searching for "*${esc(placeName)}*" in *${esc(regionInput)}*...`);

    try {
      const hotspots = await this.ebirdService.searchHotspotsByName(regionCode, placeName);
      await this.deleteMsg(chatId, _placeStatus?.message_id);
      
      if (!Array.isArray(hotspots) || hotspots.length === 0) {
        // Try to show popular hotspots as alternatives
        const popularHotspots = await this.ebirdService.getPopularHotspots(regionCode, 5);
        
        let message = `❌ No locations found matching "*${esc(placeName)}*" in *${esc(regionInput)}*.`;
        
        if (Array.isArray(popularHotspots) && popularHotspots.length > 0) {
          message += `\n\n💡 *Popular birding spots in ${esc(regionInput)}:*\n`;
          popularHotspots.forEach((h, i) => {
            message += `${i + 1}. ${esc(h.locName)}`;
            if (h.numSpeciesAllTime) message += ` (${h.numSpeciesAllTime} species)`;
            message += `\n`;
          });
          message += `\n_Try searching for one of these locations, or search the entire region with just_ \`${esc(regionInput)}\``;
        } else {
          message += `\n\n💡 Try searching the entire region with just \`${esc(regionInput)}\``;
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
      logger.error('Place search error', { error: error.message, stack: error.stack });
      await this.sendMessage(chatId, 
        `❌ Error searching for locations. Please try again.\n\n💡 You can also search the entire region with just \`${esc(regionInput)}\``
      );
      await this.resendLastPrompt(chatId);
    }
  },

  /**
   * Show hotspot selection to user
   */
  async showHotspotSelection(chatId, hotspots, type, regionName) {
    let message = `📍 *Found ${hotspots.length} locations in ${esc(regionName)}:*\n\n`;
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
  },

  /**
   * Resend last prompt message for error recovery
   */
  async resendLastPrompt(chatId) {
    const lastPrompt = this.lastPrompts.get(chatId);
    if (lastPrompt) {
      await this.sendMessage(chatId, `\n${lastPrompt.message}`);
      this.userStates.set(chatId, { action: lastPrompt.action });
    }
  },

  /**
   * Show date selection options to the user
   */
  async showDateSelection(chatId, regionCode, displayName, type, options = {}) {
    const { isHotspot = false, hotspotData = null } = options;
    
    const message = `📅 *Select date for ${esc(displayName)}:*

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
  },

  async fetchAndSendSightings(chatId, regionCode, originalInput = null, page = 0, dateFilter = null, isHotspot = false) {
    const displayName = originalInput || regionCode;
    const cacheKey = `sightings_${chatId}`;
    
    let observations;
    let dateLabel = '';
    let _sightStatus = null;
    
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
      _sightStatus = await this.sendMessage(chatId, `🔍 Searching for sightings in *${esc(displayName)}*\n${locationLabel}: ${regionCode}\n📅 ${dateLabel}...`);
      
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
        
        await this.deleteMsg(chatId, _sightStatus?.message_id);
        
        // Cache the observations with full display name including date
        /* istanbul ignore next -- dateLabel always has a value from dateFilter?.label || 'Last 14 Days' */
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
        await this.deleteMsg(chatId, _sightStatus?.message_id);
        await this.sendMessage(chatId, 
          `❌ Could not fetch sightings for *${esc(displayName)}*.\n\nPlease check the location and try again.`
        );
        // Resend last prompt for error recovery
        await this.resendLastPrompt(chatId);
        return;
      }
    }

    if (!observations || observations.length === 0) {
      await this.deleteMsg(chatId, _sightStatus?.message_id);
      await this.sendMessage(chatId, `❌ No observations found for *${esc(displayName)}* in the selected time range.`);
      await this.resendLastPrompt(chatId);
      return;
    }

    const titleSuffix = dateLabel ? ` (${dateLabel})` : '';

    // Log each sighting to Google Sheets
    sheetsService.logSightings({
      command: 'sightings',
      chatId,
      username: this.userNames.get(chatId) || 'unknown',
      searchQuery: displayName,
      regionCode,
      observations
    });

    await this.sendPaginatedObservations(chatId, observations, `${displayName}${titleSuffix}`, 'sightings', page, null, regionCode);
  }
};
