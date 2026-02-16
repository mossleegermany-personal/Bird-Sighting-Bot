/**
 * Species Handlers — /species search flow.
 * Search by species name, then narrow by location.
 */
const { toRegionCode } = require('../../utils/regionCodes');
const { filterObservationsByDateRange } = require('../../utils/dateUtils');
const { esc } = require('../../utils/markdown');
const logger = require('../../utils/logger');
const sheetsService = require('../../services/sheetsService');

module.exports = {
  async handleSpecies(msg, match) {
    const chatId = msg.chat.id;
    this.userNames.set(chatId, msg.from?.username || msg.from?.first_name || 'unknown');
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
  },

  async searchSpeciesGlobally(chatId, speciesName) {
    const _speciesStatus = await this.sendMessage(chatId, `🔍 Searching for *${esc(speciesName)}* in eBird database...`);

    try {
      // Search for the species in taxonomy
      const matches = await this.ebirdService.searchSpeciesByName(speciesName);
      await this.deleteMsg(chatId, _speciesStatus?.message_id);
      
      if (!matches || matches.length === 0) {
        await this.sendMessage(chatId, 
          `❌ Species "*${esc(speciesName)}*" not found.\n\n💡 Try the exact species name as it appears in eBird, such as:\n• "House Sparrow"\n• "Common Myna"\n• "Oriental Magpie-Robin"`
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

      let message = `✅ *Found: ${esc(species.comName)}*\n`;
      message += `🔬 _${esc(species.sciName)}_\n`;
      message += `📋 Species Code: \`${species.speciesCode}\`\n\n`;
      
      if (matches.length > 1) {
        message += `*Similar species:*\n`;
        matches.slice(1, 5).forEach(m => {
          message += `• ${esc(m.comName)}\n`;
        });
        message += `\n`;
      }
      
      message += `📍 *Now enter a location* to see sightings of ${esc(species.comName)}:\n\n`;
      message += `*Examples:*\n`;
      message += `• \`Singapore\`\n`;
      message += `• \`New York\`\n`;
      message += `• \`California\`\n`;
      message += `• \`Malaysia\`\n`;
      message += `• \`UK\``;

      await this.sendMessage(chatId, message);
    } catch (error) {
      logger.error('Species search error', { error: error.message, stack: error.stack });
      await this.sendMessage(chatId, `❌ Error searching for species. Please try again.`);
    }
  },

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
    await this.sendMessage(chatId, `🔍 Looking up *${esc(speciesInput)}*...`);
    
    try {
      const matches = await this.ebirdService.searchSpeciesByName(speciesInput);
      
      if (!matches || matches.length === 0) {
        await this.sendMessage(chatId, 
          `❌ Species "*${esc(speciesInput)}*" not found.\n\n💡 Try the exact species name as it appears in eBird.`
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
      logger.error('Species search error', { error: error.message, stack: error.stack });
      await this.sendMessage(chatId, `❌ Error searching for species. Please try again.`);
    }
  },

  async fetchSpeciesInLocation(chatId, locationInput, speciesName, speciesCode = null, dateFilter = null) {
    const regionCode = toRegionCode(locationInput);
    
    // Use date filter to determine how many days back to fetch
    const backDays = dateFilter?.backDays || 14;
    const dateLabel = dateFilter?.label || 'Last 14 Days';
    
    const _specLocStatus = await this.sendMessage(chatId, `🔍 Searching for *${esc(speciesName)}* in *${esc(locationInput)}*\n📅 ${dateLabel}...`);

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
          await this.deleteMsg(chatId, _specLocStatus?.message_id);
          await this.sendMessage(chatId, 
            `❌ Species "*${esc(speciesName)}*" not found in eBird database.\n\n💡 Try the exact species name as it appears in eBird.`
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
        await this.deleteMsg(chatId, _specLocStatus?.message_id);
        await this.sendMessage(chatId, 
          `❌ No recent sightings of *${esc(species.commonName)}* in *${esc(locationInput)}*.\n\n💡 Try a broader location or different time period.`
        );
        return;
      }

      await this.deleteMsg(chatId, _specLocStatus?.message_id);
      // Cache for pagination
      const cacheKey = `species_${chatId}`;
      const displayName = `${species.commonName} in ${locationInput} (${dateLabel})`;
      this.observationsCache.set(cacheKey, {
        observations,
        displayName,
        regionCode,
        type: 'species',
        dateLabel,
        dateFilter
      });

      // Log each sighting to Google Sheets
      sheetsService.logSightings({
        command: 'species',
        chatId,
        username: this.userNames.get(chatId) || 'unknown',
        searchQuery: `${species.commonName} in ${locationInput}`,
        regionCode,
        observations
      });

      await this.sendPaginatedObservations(chatId, observations, displayName, 'species', 0, null, regionCode);
    } catch (error) {
      logger.error('Species location search error', { error: error.message, stack: error.stack });
      await this.deleteMsg(chatId, _specLocStatus?.message_id);
      await this.sendMessage(chatId,
        `❌ Could not search for species in *${esc(locationInput)}*.\n\nPlease check the location name and try again.`
      );
    }
  },

  /**
   * Show date selection for species search
   */
  async showSpeciesDateSelection(chatId, locationInput, species) {
    const regionCode = toRegionCode(locationInput);
    
    const message = `📅 *Select date for ${esc(species.commonName)} in ${esc(locationInput)}:*

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
};
