/**
 * Command Handlers — /start, /help, /regions
 * Simple informational command responses.
 */
const { esc } = require('../../utils/markdown');

module.exports = {
  async handleStart(msg) {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name || 'Birder';

    const welcomeMessage = `
🦅 *Welcome to the Bird Sighting Bot, ${esc(userName)}!*

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
  },

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
  },

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
};
