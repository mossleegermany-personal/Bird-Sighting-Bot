/**
 * Hotspot Handlers — /hotspots birding hotspot search.
 */
const { toRegionCode } = require('../../utils/regionCodes');
const { esc } = require('../../utils/markdown');

module.exports = {
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
    await this.sendMessage(chatId, `🔍 Finding popular birding hotspots in *${esc(userInput)}* (${regionCode})...`);

    try {
      const hotspots = await this.ebirdService.getPopularHotspots(regionCode, 15);
      
      if (!Array.isArray(hotspots) || hotspots.length === 0) {
        await this.sendMessage(chatId, `❌ No hotspots found for *${esc(userInput)}*.`);
        return;
      }

      let message = `*🗺️ Popular Birding Hotspots in ${esc(userInput)}*\n`;
      message += '━━━━━━━━━━━━━━━━━━━━\n';
      message += `_Sorted by number of species recorded_\n\n`;

      hotspots.slice(0, 10).forEach((spot, index) => {
        message += `${index + 1}. *${esc(spot.locName)}*\n`;
        if (spot.numSpeciesAllTime) {
          message += `   🐦 ${spot.numSpeciesAllTime} species recorded\n`;
        }
        message += '\n';
      });

      message += `\n💡 *To search a specific location:*\n`;
      message += `Type: \`Location Name, ${esc(userInput)}\`\n`;
      message += `Example: \`${esc(hotspots[0]?.locName?.split('--')[0]?.trim() || 'Park Name')}, ${esc(userInput)}\``;

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
        `❌ Could not fetch hotspots for *${esc(userInput)}*.`
      );
    }
  }
};
