/**
 * Handler module index — re-exports all handler groups.
 * Each module exports an object of methods that will be mixed
 * into the BirdBot prototype so `this` refers to the bot instance.
 */

module.exports = {
  commandHandlers:   require('./commandHandlers'),
  sightingsHandlers: require('./sightingsHandlers'),
  notableHandlers:   require('./notableHandlers'),
  nearbyHandlers:    require('./nearbyHandlers'),
  hotspotHandlers:   require('./hotspotHandlers'),
  speciesHandlers:   require('./speciesHandlers'),
  displayHandlers:   require('./displayHandlers'),
  callbackHandlers:  require('./callbackHandlers'),
  messageHandler:    require('./messageHandler')
};
