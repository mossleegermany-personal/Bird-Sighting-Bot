/**
 * Message Handler — routes free-text messages based on conversation state.
 */
const { toRegionCode } = require('../../utils/regionCodes');

module.exports = {
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
            await this.sendPaginatedObservations(chatId, cached.observations, cached.displayName, userState.type, pageNum - 1, null, cached.regionCode);
          }
        }
        break;
    }
  }
};
