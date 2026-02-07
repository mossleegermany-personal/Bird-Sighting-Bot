/**
 * Date utilities for bird sighting date filtering
 */

/**
 * Get start of day (00:00:00) for a given date
 * @param {Date} date - The date
 * @returns {Date} Start of the day
 */
function getStartOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of day (23:59:59) for a given date
 * @param {Date} date - The date
 * @returns {Date} End of the day
 */
function getEndOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Get date range for quick presets
 * @param {string} preset - Preset name: 'today', 'yesterday', 'last_week', 'last_month', 'last_14_days'
 * @returns {Object} { startDate, endDate, backDays, label }
 */
function getDatePreset(preset) {
  const now = new Date();
  const today = getStartOfDay(now);
  
  // Format current time for display
  const currentTime = now.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false });
  
  switch (preset) {
    case 'today':
      return {
        startDate: getStartOfDay(today),
        endDate: now, // Use current time, not end of day
        backDays: 1,
        label: `Today (until ${currentTime})`
      };
    
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        startDate: getStartOfDay(yesterday),
        endDate: getEndOfDay(yesterday),
        backDays: 2, // Need to go back 2 days to include yesterday
        label: 'Yesterday'
      };
    
    case 'last_3_days':
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);
      return {
        startDate: getStartOfDay(threeDaysAgo),
        endDate: now, // Use current time
        backDays: 3,
        label: `Last 3 Days (until ${currentTime})`
      };
    
    case 'last_week':
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 6);
      return {
        startDate: getStartOfDay(weekAgo),
        endDate: now, // Use current time
        backDays: 7,
        label: `Last Week (until ${currentTime})`
      };
    
    case 'last_14_days':
      const twoWeeksAgo = new Date(today);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 13);
      return {
        startDate: getStartOfDay(twoWeeksAgo),
        endDate: now, // Use current time
        backDays: 14,
        label: `Last 14 Days (until ${currentTime})`
      };
    
    case 'last_month':
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 29);
      return {
        startDate: getStartOfDay(monthAgo),
        endDate: now, // Use current time
        backDays: 30,
        label: `Last Month (until ${currentTime})`
      };
    
    default:
      return {
        startDate: getStartOfDay(new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000)),
        endDate: now, // Use current time
        backDays: 14,
        label: `Last 14 Days (until ${currentTime})`
      };
  }
}

/**
 * Parse a date string in various formats
 * Supports: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
 * @param {string} dateStr - Date string
 * @returns {Date|null} Parsed date or null if invalid
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  const str = dateStr.trim();
  
  // Try DD/MM/YYYY
  let match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(year, month - 1, day);
  }
  
  // Try YYYY-MM-DD
  match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(year, month - 1, day);
  }
  
  // Try DD-MM-YYYY
  match = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(year, month - 1, day);
  }
  
  return null;
}

/**
 * Calculate days between two dates
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {number} Number of days (inclusive)
 */
function daysBetween(startDate, endDate) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((endDate - startDate) / oneDay)) + 1;
}

/**
 * Calculate how many days back from today a date is
 * @param {Date} date - The date
 * @returns {number} Days back from today
 */
function daysBackFromToday(date) {
  const today = getStartOfDay(new Date());
  const targetDate = getStartOfDay(date);
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.ceil((today - targetDate) / oneDay) + 1);
}

/**
 * Format date as DD/MM/YYYY
 * @param {Date} date - The date
 * @returns {string} Formatted date string
 */
function formatDateDDMMYYYY(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Check if a date is within a range (inclusive)
 * @param {Date} date - The date to check
 * @param {Date} startDate - Range start
 * @param {Date} endDate - Range end
 * @returns {boolean} True if date is within range
 */
function isDateInRange(date, startDate, endDate) {
  const d = new Date(date).getTime();
  return d >= startDate.getTime() && d <= endDate.getTime();
}

/**
 * Parse eBird date string (YYYY-MM-DD HH:MM) to Date object
 * @param {string} ebirdDateStr - eBird date string
 * @returns {Date} Parsed date
 */
function parseEBirdDate(ebirdDateStr) {
  if (!ebirdDateStr) return null;
  
  const parts = ebirdDateStr.split(' ');
  const datePart = parts[0];
  const timePart = parts[1] || '00:00';
  
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  
  return new Date(year, month - 1, day, hours, minutes);
}

/**
 * Filter observations by date range
 * @param {Array} observations - Array of eBird observations
 * @param {Date} startDate - Range start (00:00:00)
 * @param {Date} endDate - Range end (23:59:59)
 * @returns {Array} Filtered observations
 */
function filterObservationsByDateRange(observations, startDate, endDate) {
  if (!observations || !Array.isArray(observations)) return [];
  
  return observations.filter(obs => {
    if (!obs.obsDt) return false;
    const obsDate = parseEBirdDate(obs.obsDt);
    return obsDate && isDateInRange(obsDate, startDate, endDate);
  });
}

/**
 * Get a human-readable description of the date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {string} Description
 */
function getDateRangeDescription(startDate, endDate) {
  const startStr = formatDateDDMMYYYY(startDate);
  const endStr = formatDateDDMMYYYY(endDate);
  
  if (startStr === endStr) {
    return startStr;
  }
  
  return `${startStr} to ${endStr}`;
}

module.exports = {
  getStartOfDay,
  getEndOfDay,
  getDatePreset,
  parseDate,
  daysBetween,
  daysBackFromToday,
  formatDateDDMMYYYY,
  isDateInRange,
  parseEBirdDate,
  filterObservationsByDateRange,
  getDateRangeDescription
};
