/**
 * Nearby Handlers — GPS-based nearby sightings flow.
 * Handles /nearby, location sharing, distance picker, and fetching nearby results.
 */
const { esc } = require('../../utils/markdown');
const logger = require('../../utils/logger');
const sheetsService = require('../../services/sheetsService');

module.exports = {
  async handleNearby(msg) {
    const chatId = msg.chat.id;
    this.userNames.set(chatId, msg.from?.username || msg.from?.first_name || 'unknown');

    await this.sendMessage(chatId,
      '📍 *Share your location to find nearby bird sightings!*\n\nAfter sharing, you can choose the search radius.',
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
  },

  async handleLocation(msg) {
    const chatId = msg.chat.id;
    this.userNames.set(chatId, msg.from?.username || msg.from?.first_name || 'unknown');
    const { latitude, longitude } = msg.location;
    const mapsLink = `https://maps.google.com/?q=${latitude},${longitude}`;

    // Store location and show distance picker
    this.userStates.set(chatId, {
      action: 'awaiting_nearby_distance',
      latitude,
      longitude
    });

    const distMessage = `📍 Location received!\n\n*Coordinates:* [${latitude.toFixed(4)}, ${longitude.toFixed(4)}](${mapsLink})\n\n📏 *Choose search radius:*`;

    const distButtons = [
      [
        { text: '5 km', callback_data: 'nearby_dist_5' },
        { text: '10 km', callback_data: 'nearby_dist_10' }
      ],
      [
        { text: '15 km', callback_data: 'nearby_dist_15' },
        { text: '20 km', callback_data: 'nearby_dist_20' }
      ],
      [
        { text: '25 km', callback_data: 'nearby_dist_25' }
      ]
    ];

    await this.sendMessage(chatId, distMessage, {
      reply_markup: {
        inline_keyboard: distButtons,
        remove_keyboard: true
      }
    });
  },

  /**
   * Fetch and display nearby sightings for a given distance
   */
  async fetchNearbySightings(chatId, latitude, longitude, dist) {
    const _nearbyStatus = await this.sendMessage(chatId, `🔍 Searching for sightings within *${dist} km*...`);

    try {
      let observations = [];
      let hotspots = [];

      try {
        observations = await this.ebirdService.getNearbyObservations(latitude, longitude, dist) || [];
      } catch (err) {
        logger.error('Error fetching nearby observations', { error: err.message });
      }

      try {
        hotspots = await this.ebirdService.getNearbyHotspots(latitude, longitude, dist) || [];
      } catch (err) {
        logger.error('Error fetching nearby hotspots', { error: err.message });
      }

      await this.deleteMsg(chatId, _nearbyStatus?.message_id);

      const nearbyRegion = observations?.[0]?.countryCode || null;

      // Show observations if any
      if (observations.length > 0) {
        const cacheKey = `nearby_${chatId}`;
        this.observationsCache.set(cacheKey, {
          observations,
          displayName: `Your Location (${dist} km)`,
          regionCode: nearbyRegion,
          type: 'nearby'
        });

        // Log each sighting to Google Sheets
        sheetsService.logSightings({
          command: 'nearby',
          chatId,
          username: this.userNames.get(chatId) || 'unknown',
          searchQuery: `Nearby (${dist} km)`,
          regionCode: nearbyRegion,
          observations
        });

        await this.sendPaginatedObservations(chatId, observations, `Your Location (${dist} km)`, 'nearby', 0, null, nearbyRegion);
      } else {
        await this.sendMessage(chatId, `❌ No bird sightings found within *${dist} km* of your location.\n\nTry a larger search radius or a different location.`);
      }

      // Show nearby hotspots
      if (Array.isArray(hotspots) && hotspots.length > 0) {
        let hotspotsMessage = '*🗺️ Nearby Birding Hotspots:*\n\n';
        hotspots.slice(0, 5).forEach((spot, index) => {
          hotspotsMessage += `${index + 1}. *${esc(spot.locName)}*\n`;
          if (spot.numSpeciesAllTime) {
            hotspotsMessage += `   🐦 Species recorded: ${spot.numSpeciesAllTime}\n`;
          }
          hotspotsMessage += '\n';
        });
        await this.sendMessage(chatId, hotspotsMessage);
      }

      // Continue prompt after all results
      await this.sendMessage(chatId, '🔍 *What would you like to do next?*', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📊 Summary List', callback_data: 'specsummary_nearby' }],
            [
              { text: '🔍 New Search', callback_data: 'new_search' },
              { text: '✅ Done', callback_data: 'done' }
            ]
          ]
        }
      });
    } catch (error) {
      logger.error('Nearby sightings error', { error: error.message, stack: error.stack });
      await this.sendMessage(chatId,
        '❌ Could not fetch nearby sightings. Please try again later.',
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔄 Try Again', callback_data: 'cmd_nearby' },
                { text: '🔍 New Search', callback_data: 'new_search' }
              ]
            ]
          }
        }
      );
    }
  }
};
