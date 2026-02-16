/**
 * Notable Handlers — /notable sightings flow.
 * Handles notable/rare bird sighting search and display.
 */
const { toRegionCode } = require('../../utils/regionCodes');
const { filterObservationsByDateRange } = require('../../utils/dateUtils');
const { esc } = require('../../utils/markdown');
const sheetsService = require('../../services/sheetsService');

module.exports = {
  async handleNotable(msg, match) {
    const chatId = msg.chat.id;
    this.userNames.set(chatId, msg.from?.username || msg.from?.first_name || 'unknown');
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
  },

  async fetchAndSendNotable(chatId, regionCode, originalInput = null, page = 0, dateFilter = null, isHotspot = false) {
    const displayName = originalInput || regionCode;
    const cacheKey = `notable_${chatId}`;
    
    let observations;
    let dateLabel = '';
    let _notableStatus = null;
    
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
      _notableStatus = await this.sendMessage(chatId, `🔍 Searching for notable sightings in *${esc(displayName)}*\n${locationLabel}: ${regionCode}\n📅 ${dateLabel}...`);
      
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
        /* istanbul ignore next -- dateLabel always has a value from dateFilter?.label || 'Last 14 Days' */
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
        await this.deleteMsg(chatId, _notableStatus?.message_id);
        await this.sendMessage(chatId,
          `❌ Could not fetch notable sightings for *${esc(displayName)}*.\n\nPlease check the location and try again.`
        );
        // Resend last prompt for error recovery
        await this.resendLastPrompt(chatId);
        return;
      }
    }

    if (!observations || observations.length === 0) {
      await this.deleteMsg(chatId, _notableStatus?.message_id);
      await this.sendMessage(chatId, `❌ No notable observations found for *${esc(displayName)}* in the selected time range.`);
      await this.resendLastPrompt(chatId);
      return;
    }

    await this.deleteMsg(chatId, _notableStatus?.message_id);
    const titleSuffix = dateLabel ? ` (${dateLabel})` : '';

    // Log each sighting to Google Sheets
    sheetsService.logSightings({
      command: 'notable',
      chatId,
      username: this.userNames.get(chatId) || 'unknown',
      searchQuery: displayName,
      regionCode,
      observations
    });

    await this.sendPaginatedObservations(chatId, observations, `${displayName}${titleSuffix}`, 'notable', page, null, regionCode);
  }
};
