/**
 * Date utilities for bird sighting date filtering
 * Timezone is resolved per-region so labels match the searched country
 */

/**
 * Map eBird region/country codes to IANA timezone identifiers.
 * For countries that span multiple zones, the capital / most-populated zone is used.
 * Sub-national codes (e.g. US-CA) inherit from the country prefix unless overridden.
 */
const REGION_TIMEZONE_MAP = {
  // ── Asia ────────────────────────────────────────
  SG: 'Asia/Singapore',
  MY: 'Asia/Kuala_Lumpur',
  TH: 'Asia/Bangkok',
  VN: 'Asia/Ho_Chi_Minh',
  ID: 'Asia/Jakarta',
  PH: 'Asia/Manila',
  JP: 'Asia/Tokyo',
  CN: 'Asia/Shanghai',
  IN: 'Asia/Kolkata',
  KR: 'Asia/Seoul',
  KP: 'Asia/Pyongyang',
  TW: 'Asia/Taipei',
  HK: 'Asia/Hong_Kong',
  MO: 'Asia/Macau',
  MM: 'Asia/Yangon',
  KH: 'Asia/Phnom_Penh',
  LA: 'Asia/Vientiane',
  BN: 'Asia/Brunei',
  NP: 'Asia/Kathmandu',
  BD: 'Asia/Dhaka',
  LK: 'Asia/Colombo',
  PK: 'Asia/Karachi',
  MV: 'Indian/Maldives',
  MN: 'Asia/Ulaanbaatar',

  // ── Americas ────────────────────────────────────
  US: 'America/New_York',
  CA: 'America/Toronto',
  MX: 'America/Mexico_City',
  BR: 'America/Sao_Paulo',
  AR: 'America/Argentina/Buenos_Aires',
  CL: 'America/Santiago',
  CO: 'America/Bogota',
  PE: 'America/Lima',
  CR: 'America/Costa_Rica',
  PA: 'America/Panama',
  EC: 'America/Guayaquil',
  VE: 'America/Caracas',
  BO: 'America/La_Paz',
  UY: 'America/Montevideo',
  PY: 'America/Asuncion',
  CU: 'America/Havana',
  PR: 'America/Puerto_Rico',
  JM: 'America/Jamaica',
  TT: 'America/Port_of_Spain',
  BS: 'America/Nassau',
  GT: 'America/Guatemala',
  HN: 'America/Tegucigalpa',
  NI: 'America/Managua',
  SV: 'America/El_Salvador',
  BZ: 'America/Belize',

  // ── US States (where different from default US Eastern) ──
  'US-CA': 'America/Los_Angeles',
  'US-WA': 'America/Los_Angeles',
  'US-OR': 'America/Los_Angeles',
  'US-NV': 'America/Los_Angeles',
  'US-AZ': 'America/Phoenix',
  'US-CO': 'America/Denver',
  'US-UT': 'America/Denver',
  'US-NM': 'America/Denver',
  'US-MT': 'America/Denver',
  'US-WY': 'America/Denver',
  'US-ID': 'America/Boise',
  'US-TX': 'America/Chicago',
  'US-IL': 'America/Chicago',
  'US-MN': 'America/Chicago',
  'US-WI': 'America/Chicago',
  'US-IA': 'America/Chicago',
  'US-MO': 'America/Chicago',
  'US-KS': 'America/Chicago',
  'US-NE': 'America/Chicago',
  'US-SD': 'America/Chicago',
  'US-ND': 'America/Chicago',
  'US-OK': 'America/Chicago',
  'US-AR': 'America/Chicago',
  'US-LA': 'America/Chicago',
  'US-MS': 'America/Chicago',
  'US-AL': 'America/Chicago',
  'US-AK': 'America/Anchorage',
  'US-HI': 'Pacific/Honolulu',

  // ── Canadian Provinces ──────────────────────────
  'CA-BC': 'America/Vancouver',
  'CA-AB': 'America/Edmonton',
  'CA-SK': 'America/Regina',
  'CA-MB': 'America/Winnipeg',
  'CA-ON': 'America/Toronto',
  'CA-QC': 'America/Toronto',
  'CA-NS': 'America/Halifax',
  'CA-NB': 'America/Moncton',
  'CA-NL': 'America/St_Johns',
  'CA-PE': 'America/Halifax',

  // ── Europe ──────────────────────────────────────
  GB: 'Europe/London',
  'GB-ENG': 'Europe/London',
  'GB-SCT': 'Europe/London',
  'GB-WLS': 'Europe/London',
  'GB-NIR': 'Europe/London',
  DE: 'Europe/Berlin',
  FR: 'Europe/Paris',
  ES: 'Europe/Madrid',
  IT: 'Europe/Rome',
  NL: 'Europe/Amsterdam',
  BE: 'Europe/Brussels',
  SE: 'Europe/Stockholm',
  NO: 'Europe/Oslo',
  DK: 'Europe/Copenhagen',
  FI: 'Europe/Helsinki',
  IE: 'Europe/Dublin',
  PT: 'Europe/Lisbon',
  AT: 'Europe/Vienna',
  CH: 'Europe/Zurich',
  PL: 'Europe/Warsaw',
  RU: 'Europe/Moscow',
  GR: 'Europe/Athens',
  CZ: 'Europe/Prague',
  HU: 'Europe/Budapest',
  RO: 'Europe/Bucharest',
  UA: 'Europe/Kyiv',
  HR: 'Europe/Zagreb',
  BG: 'Europe/Sofia',
  RS: 'Europe/Belgrade',
  SK: 'Europe/Bratislava',
  SI: 'Europe/Ljubljana',
  IS: 'Atlantic/Reykjavik',
  EE: 'Europe/Tallinn',
  LV: 'Europe/Riga',
  LT: 'Europe/Vilnius',
  LU: 'Europe/Luxembourg',
  MT: 'Europe/Malta',
  CY: 'Asia/Nicosia',

  // ── Oceania ─────────────────────────────────────
  AU: 'Australia/Sydney',
  'AU-NSW': 'Australia/Sydney',
  'AU-VIC': 'Australia/Melbourne',
  'AU-QLD': 'Australia/Brisbane',
  'AU-WA': 'Australia/Perth',
  'AU-SA': 'Australia/Adelaide',
  'AU-TAS': 'Australia/Hobart',
  'AU-NT': 'Australia/Darwin',
  NZ: 'Pacific/Auckland',
  FJ: 'Pacific/Fiji',
  PG: 'Pacific/Port_Moresby',

  // ── Africa ──────────────────────────────────────
  ZA: 'Africa/Johannesburg',
  KE: 'Africa/Nairobi',
  TZ: 'Africa/Dar_es_Salaam',
  EG: 'Africa/Cairo',
  MA: 'Africa/Casablanca',
  NG: 'Africa/Lagos',
  ET: 'Africa/Addis_Ababa',
  UG: 'Africa/Kampala',
  GH: 'Africa/Accra',
  NA: 'Africa/Windhoek',
  BW: 'Africa/Gaborone',
  ZW: 'Africa/Harare',
  ZM: 'Africa/Lusaka',
  MZ: 'Africa/Maputo',
  MG: 'Indian/Antananarivo',
  MU: 'Indian/Mauritius',
  RW: 'Africa/Kigali',

  // ── Middle East ─────────────────────────────────
  IL: 'Asia/Jerusalem',
  TR: 'Europe/Istanbul',
  SA: 'Asia/Riyadh',
  AE: 'Asia/Dubai',
  QA: 'Asia/Qatar',
  KW: 'Asia/Kuwait',
  BH: 'Asia/Bahrain',
  OM: 'Asia/Muscat',
  JO: 'Asia/Amman',
  LB: 'Asia/Beirut',
  IR: 'Asia/Tehran',
  IQ: 'Asia/Baghdad',
};

/**
 * Resolve IANA timezone for an eBird region code.
 * Tries the full code first (e.g. "US-CA"), then the country prefix (e.g. "US"),
 * and finally falls back to the system's local timezone.
 * @param {string} [regionCode] - eBird region code
 * @returns {string} IANA timezone identifier
 */
function resolveTimezone(regionCode) {
  if (regionCode) {
    const upper = regionCode.toUpperCase();
    if (REGION_TIMEZONE_MAP[upper]) return REGION_TIMEZONE_MAP[upper];
    // Try country prefix (first 2 chars)
    const prefix = upper.split('-')[0];
    if (REGION_TIMEZONE_MAP[prefix]) return REGION_TIMEZONE_MAP[prefix];
  }
  // Fall back to system timezone
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Get the short timezone abbreviation for a region (or system default).
 * e.g. "SGT", "EST", "PST", "GMT+8"
 * @param {string} [regionCode] - eBird region code (optional)
 * @returns {string} Timezone abbreviation
 */
function getTimezoneAbbr(regionCode) {
  const tz = resolveTimezone(regionCode);
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' });
  const parts = formatter.formatToParts(new Date());
  const tzPart = parts.find(p => p.type === 'timeZoneName');
  return tzPart ? tzPart.value : 'Local';
}

/**
 * Get current time formatted for a specific region's timezone.
 * @param {string} [regionCode] - eBird region code (optional)
 * @returns {{ hours: string, minutes: string, formatted: string }} Time parts
 */
function getRegionTime(regionCode) {
  const tz = resolveTimezone(regionCode);
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(now);
  const h = parts.find(p => p.type === 'hour')?.value || '00';
  const m = parts.find(p => p.type === 'minute')?.value || '00';
  return { hours: h, minutes: m, formatted: `${h}:${m}` };
}

/**
 * Get current time in the system's local timezone
 * @returns {Date} Current local time
 */
function getLocalNow() {
  return new Date();
}

/**
 * Get start of day (00:00:00) for a given date in local timezone
 * @param {Date} date - The date
 * @returns {Date} Start of the day
 */
function getStartOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of day (23:59:59) for a given date in local timezone
 * @param {Date} date - The date
 * @returns {Date} End of the day
 */
function getEndOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Format time in a region's timezone (HH:MM)
 * @param {Date} date - The date
 * @param {string} [regionCode] - eBird region code (optional)
 * @returns {string} Time string in the region's timezone
 */
function formatLocalTime(date, regionCode) {
  const tz = resolveTimezone(regionCode);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  const h = parts.find(p => p.type === 'hour')?.value || '00';
  const m = parts.find(p => p.type === 'minute')?.value || '00';
  return `${h}:${m}`;
}

/**
 * Get date range for quick presets
 * @param {string} preset - Preset name: 'today', 'yesterday', 'last_week', 'last_month', 'last_14_days'
 * @param {string} [regionCode] - eBird region code to determine timezone label
 * @returns {Object} { startDate, endDate, backDays, label }
 */
function getDatePreset(preset, regionCode) {
  const now = getLocalNow();
  const today = getStartOfDay(now);
  const tz = getTimezoneAbbr(regionCode);
  
  // Format current time in the searched region's timezone for display
  const currentTime = getRegionTime(regionCode).formatted;
  
  switch (preset) {
    case 'today':
      return {
        startDate: getStartOfDay(today),
        endDate: now, // Use current local time, not end of day
        backDays: 1,
        label: `Today (until ${currentTime} ${tz})`
      };
    
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        startDate: getStartOfDay(yesterday),
        endDate: now, // From yesterday to current local time today
        backDays: 2, // Need to go back 2 days to include yesterday
        label: `Yesterday to Now (until ${currentTime} ${tz})`
      };
    
    case 'last_3_days':
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);
      return {
        startDate: getStartOfDay(threeDaysAgo),
        endDate: now, // Use current local time
        backDays: 3,
        label: `Last 3 Days (until ${currentTime} ${tz})`
      };
    
    case 'last_week':
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 6);
      return {
        startDate: getStartOfDay(weekAgo),
        endDate: now, // Use current local time
        backDays: 7,
        label: `Last Week (until ${currentTime} ${tz})`
      };
    
    case 'last_14_days':
      const twoWeeksAgo = new Date(today);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 13);
      return {
        startDate: getStartOfDay(twoWeeksAgo),
        endDate: now, // Use current local time
        backDays: 14,
        label: `Last 14 Days (until ${currentTime} ${tz})`
      };
    
    case 'last_month':
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 29);
      return {
        startDate: getStartOfDay(monthAgo),
        endDate: now, // Use current local time
        backDays: 30,
        label: `Last Month (until ${currentTime} ${tz})`
      };
    
    default:
      return {
        startDate: getStartOfDay(new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000)),
        endDate: now, // Use current local time
        backDays: 14,
        label: `Last 14 Days (until ${currentTime} ${tz})`
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
  const today = getStartOfDay(getLocalNow());
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
 * @param {string} [regionCode] - eBird region code for timezone label
 * @returns {string} Description
 */
function getDateRangeDescription(startDate, endDate, regionCode) {
  const startStr = formatDateDDMMYYYY(startDate);
  const endStr = formatDateDDMMYYYY(endDate);
  const tz = getTimezoneAbbr(regionCode);
  
  if (startStr === endStr) {
    return `${startStr} (${tz})`;
  }
  
  return `${startStr} to ${endStr} (${tz})`;
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
  getDateRangeDescription,
  getLocalNow,
  formatLocalTime,
  getTimezoneAbbr,
  resolveTimezone,
  getRegionTime
};
