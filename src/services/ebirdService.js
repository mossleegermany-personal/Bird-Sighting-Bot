const axios = require('axios');

class EBirdService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.ebird.org/v2';
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'X-eBirdApiToken': this.apiKey
      }
    });
  }

  /**
   * Get recent bird observations in a region
   * @param {string} regionCode - Country, subnational1, subnational2 or location code (e.g., 'US', 'US-NY', 'US-NY-109')
   * @param {number} back - Number of days back to fetch (1-30, default 14)
   * @param {number} maxResults - Maximum number of results (1-10000)
   * @returns {Promise<Array>} Array of recent observations
   */
  async getRecentObservations(regionCode, back = 14, maxResults = 20) {
    try {
      // Clean and validate region code
      const cleanRegionCode = regionCode.trim().toUpperCase();
      console.log(`Fetching observations for region: ${cleanRegionCode}`);
      
      const response = await this.client.get(`/data/obs/${cleanRegionCode}/recent`, {
        params: {
          back,
          maxResults
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching recent observations:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Get recent notable observations in a region
   * @param {string} regionCode - Country, subnational1, subnational2 or location code
   * @param {number} back - Number of days back to fetch (1-30, default 14)
   * @param {number} maxResults - Maximum number of results
   * @returns {Promise<Array>} Array of notable observations
   */
  async getNotableObservations(regionCode, back = 14, maxResults = 20) {
    try {
      const response = await this.client.get(`/data/obs/${regionCode}/recent/notable`, {
        params: {
          back,
          maxResults,
          detail: 'full'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching notable observations:', error.message);
      throw error;
    }
  }

  /**
   * Get recent observations of a specific species in a region
   * @param {string} regionCode - Country, subnational1, subnational2 or location code
   * @param {string} speciesCode - The eBird species code (e.g., 'cangoo' for Canada Goose)
   * @param {number} back - Number of days back to fetch (1-30, default 14)
   * @returns {Promise<Array>} Array of species observations
   */
  async getSpeciesObservations(regionCode, speciesCode, back = 14) {
    try {
      const response = await this.client.get(`/data/obs/${regionCode}/recent/${speciesCode}`, {
        params: {
          back
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching species observations:', error.message);
      throw error;
    }
  }

  /**
   * Get nearby recent observations based on coordinates
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {number} dist - Distance in km (max 50)
   * @param {number} back - Number of days back
   * @param {number} maxResults - Maximum number of results
   * @returns {Promise<Array>} Array of nearby observations
   */
  async getNearbyObservations(lat, lng, dist = 25, back = 14, maxResults = 20) {
    try {
      const response = await this.client.get('/data/obs/geo/recent', {
        params: {
          lat,
          lng,
          dist,
          back,
          maxResults
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching nearby observations:', error.message);
      throw error;
    }
  }

  /**
   * Get nearby notable observations based on coordinates
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {number} dist - Distance in km (max 50)
   * @param {number} back - Number of days back
   * @returns {Promise<Array>} Array of nearby notable observations
   */
  async getNearbyNotableObservations(lat, lng, dist = 25, back = 14) {
    try {
      const response = await this.client.get('/data/obs/geo/recent/notable', {
        params: {
          lat,
          lng,
          dist,
          back,
          detail: 'full'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching nearby notable observations:', error.message);
      throw error;
    }
  }

  /**
   * Search eBird taxonomy for species by name
   * @param {string} query - Species name to search for
   * @returns {Promise<Array>} Array of matching species with codes
   */
  async searchSpeciesByName(query) {
    try {
      // Use eBird taxonomy API to search for species
      const response = await this.client.get('/ref/taxonomy/ebird', {
        params: {
          fmt: 'json',
          cat: 'species'
        }
      });
      
      const searchLower = query.toLowerCase().trim();
      
      // Filter taxonomy by common name match
      const matches = response.data.filter(species => {
        const comName = (species.comName || '').toLowerCase();
        const sciName = (species.sciName || '').toLowerCase();
        return comName.includes(searchLower) || sciName.includes(searchLower);
      });
      
      // Sort by best match (starts with query first)
      matches.sort((a, b) => {
        const aStarts = a.comName.toLowerCase().startsWith(searchLower);
        const bStarts = b.comName.toLowerCase().startsWith(searchLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.comName.localeCompare(b.comName);
      });
      
      return matches.slice(0, 10); // Return top 10 matches
    } catch (error) {
      console.error('Error searching species taxonomy:', error.message);
      throw error;
    }
  }

  /**
   * Get observations for a species by common name in a region
   * First searches taxonomy to find species code, then fetches observations
   * @param {string} regionCode - Region code
   * @param {string} speciesName - Common name of species
   * @param {number} back - Days back
   * @returns {Promise<Object>} Object with species info and observations
   */
  async getObservationsBySpeciesName(regionCode, speciesName, back = 14) {
    try {
      // Search for species in taxonomy
      const matches = await this.searchSpeciesByName(speciesName);
      
      if (!matches || matches.length === 0) {
        return { species: null, observations: [], error: 'Species not found' };
      }
      
      // Use the best match
      const species = matches[0];
      const speciesCode = species.speciesCode;
      
      // Fetch observations for this species
      const observations = await this.getSpeciesObservations(regionCode, speciesCode, back);
      
      return {
        species: {
          code: speciesCode,
          commonName: species.comName,
          scientificName: species.sciName
        },
        observations,
        alternatives: matches.slice(1, 5) // Other possible matches
      };
    } catch (error) {
      console.error('Error fetching observations by species name:', error.message);
      throw error;
    }
  }

  /**
   * Get hotspots in a region
   * @param {string} regionCode - Country, subnational1, or subnational2 code
   * @returns {Promise<Array>} Array of hotspots
   */
  async getHotspots(regionCode) {
    try {
      const response = await this.client.get(`/ref/hotspot/${regionCode}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching hotspots:', error.message);
      throw error;
    }
  }

  /**
   * Search hotspots by name within a region
   * Uses fuzzy matching to find locations
   * @param {string} regionCode - Country, subnational1, or subnational2 code
   * @param {string} searchQuery - Name to search for (partial match)
   * @param {number} maxResults - Maximum number of results to return
   * @returns {Promise<Array>} Array of matching hotspots
   */
  async searchHotspotsByName(regionCode, searchQuery, maxResults = 10) {
    try {
      const hotspots = await this.getHotspots(regionCode);
      
      if (!hotspots || hotspots.length === 0) {
        return [];
      }
      
      // Normalize search query - remove common words and clean up
      const searchLower = searchQuery.toLowerCase().trim();
      const searchWords = searchLower
        .replace(/['']/g, '') // Remove apostrophes
        .split(/\s+/)
        .filter(word => !['the', 'a', 'an', 'at', 'in', 'park', 'garden', 'gardens'].includes(word));
      
      // Filter hotspots by fuzzy name match
      const matches = hotspots.filter(hotspot => {
        const locName = (hotspot.locName || '').toLowerCase();
        const locNameNormalized = locName.replace(/['']/g, '');
        
        // Check if the full search query is in the name
        if (locNameNormalized.includes(searchLower)) {
          return true;
        }
        
        // Check if all significant search words are in the name
        if (searchWords.length > 0) {
          const matchedWords = searchWords.filter(word => 
            locNameNormalized.includes(word)
          );
          // Match if at least half of the search words are found
          return matchedWords.length >= Math.ceil(searchWords.length / 2);
        }
        
        return false;
      });
      
      // Score and sort matches
      matches.sort((a, b) => {
        const aName = (a.locName || '').toLowerCase();
        const bName = (b.locName || '').toLowerCase();
        
        // Exact match scores highest
        const aExact = aName === searchLower;
        const bExact = bName === searchLower;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // Starts with query scores next
        const aStarts = aName.startsWith(searchLower);
        const bStarts = bName.startsWith(searchLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // Contains full query
        const aContains = aName.includes(searchLower);
        const bContains = bName.includes(searchLower);
        if (aContains && !bContains) return -1;
        if (!aContains && bContains) return 1;
        
        // Sort by species count (more species = more popular)
        const aSpecies = a.numSpeciesAllTime || 0;
        const bSpecies = b.numSpeciesAllTime || 0;
        return bSpecies - aSpecies;
      });
      
      return matches.slice(0, maxResults);
    } catch (error) {
      console.error('Error searching hotspots by name:', error.message);
      throw error;
    }
  }

  /**
   * Get popular hotspots in a region sorted by species count
   * @param {string} regionCode - Region code
   * @param {number} limit - Number of hotspots to return
   * @returns {Promise<Array>} Array of popular hotspots
   */
  async getPopularHotspots(regionCode, limit = 10) {
    try {
      const hotspots = await this.getHotspots(regionCode);
      
      if (!hotspots || hotspots.length === 0) {
        return [];
      }
      
      // Sort by species count (most species first)
      const sorted = hotspots.sort((a, b) => {
        const aSpecies = a.numSpeciesAllTime || 0;
        const bSpecies = b.numSpeciesAllTime || 0;
        return bSpecies - aSpecies;
      });
      
      return sorted.slice(0, limit);
    } catch (error) {
      console.error('Error fetching popular hotspots:', error.message);
      throw error;
    }
  }

  /**
   * Get recent observations at a specific hotspot location
   * @param {string} locId - The eBird location ID (e.g., 'L123456')
   * @param {number} back - Number of days back to fetch (1-30, default 14)
   * @param {number} maxResults - Maximum number of results
   * @returns {Promise<Array>} Array of observations at the hotspot
   */
  async getHotspotObservations(locId, back = 14, maxResults = 100) {
    try {
      console.log(`Fetching observations for hotspot: ${locId}`);
      const response = await this.client.get(`/data/obs/${locId}/recent`, {
        params: {
          back,
          maxResults
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching hotspot observations:', error.message);
      throw error;
    }
  }

  /**
   * Get nearby hotspots based on coordinates
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {number} dist - Distance in km (max 50)
   * @returns {Promise<Array>} Array of nearby hotspots
   */
  async getNearbyHotspots(lat, lng, dist = 25) {
    try {
      const response = await this.client.get('/ref/hotspot/geo', {
        params: {
          lat,
          lng,
          dist
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching nearby hotspots:', error.message);
      throw error;
    }
  }

  /**
   * Format date from yyyy-mm-dd hh:mm to dd/mm/yyyy hh:mm
   * @param {string} dateStr - Date string from eBird API (e.g., "2026-02-06 18:30")
   * @returns {string} Formatted date string (e.g., "06/02/2026 18:30")
   */
  formatDate(dateStr) {
    if (!dateStr) return 'Unknown';
    
    // Split date and time
    const parts = dateStr.split(' ');
    const datePart = parts[0];
    const timePart = parts[1] || '';
    
    // Split date into year, month, day
    const [year, month, day] = datePart.split('-');
    
    // Return in dd/mm/yyyy format
    return `${day}/${month}/${year}${timePart ? ' ' + timePart : ''}`;
  }

  /**
   * Format a single observation for display
   * @param {Object} obs - Observation object from eBird API
   * @returns {string} Formatted string
   */
  formatObservation(obs) {
    const mapsLink = `https://maps.google.com/?q=${obs.lat},${obs.lng}`;
    let formatted = `🐦 *${obs.comName}*\n`;
    formatted += `   _${obs.sciName}_\n`;
    formatted += `📍 ${obs.locName}\n`;
    formatted += `🗺️ [📍 View on Google Maps](${mapsLink})\n`;
    formatted += `📅 ${this.formatDate(obs.obsDt)}\n`;
    
    // Add reporter name if available
    if (obs.userDisplayName) {
      formatted += `👤 Reported by: ${obs.userDisplayName}\n`;
    }
    
    // Add count if available and more than 1
    if (obs.howMany && obs.howMany > 1) {
      formatted += `🔢 Count: ${obs.howMany}\n`;
    }
    
    return formatted;
  }

  /**
   * Remove duplicate observations based on species, location, and date
   * @param {Array} observations - Array of observation objects
   * @returns {Array} Deduplicated array of observations
   */
  deduplicateObservations(observations) {
    if (!observations || observations.length === 0) {
      return [];
    }

    const seen = new Set();
    return observations.filter(obs => {
      // Create a unique key based on species, location, and date
      const key = `${obs.speciesCode || obs.comName}-${obs.locId || obs.locName}-${obs.obsDt}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Format multiple observations for display
   * @param {Array} observations - Array of observation objects
   * @param {string} title - Title for the list
   * @returns {string} Formatted string
   */
  formatObservationsList(observations, title = 'Recent Bird Sightings') {
    if (!observations || observations.length === 0) {
      return '❌ No observations found for this location.';
    }

    // Remove duplicate entries
    const uniqueObservations = this.deduplicateObservations(observations);

    // Split into chunks to avoid Telegram message length limits
    const messages = [];
    let formatted = `*${title}*\n`;
    formatted += `━━━━━━━━━━━━━━━━━━━━\n`;
    formatted += `📊 Total: ${uniqueObservations.length} observations\n\n`;

    uniqueObservations.forEach((obs) => {
      const entry = `${this.formatObservation(obs)}\n`;
      
      // If adding this entry exceeds ~3500 chars, start a new message
      if (formatted.length + entry.length > 3500) {
        messages.push(formatted);
        formatted = '';
      }
      formatted += entry;
    });

    if (formatted) {
      messages.push(formatted);
    }

    return messages;
  }
}

module.exports = EBirdService;
