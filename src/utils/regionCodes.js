// Mapping of common location names to eBird region codes
const locationToCode = {
  // Countries - Asia
  'singapore': 'SG',
  'malaysia': 'MY',
  'thailand': 'TH',
  'vietnam': 'VN',
  'indonesia': 'ID',
  'philippines': 'PH',
  'japan': 'JP',
  'china': 'CN',
  'india': 'IN',
  'south korea': 'KR',
  'korea': 'KR',
  'north korea': 'KP',
  'taiwan': 'TW',
  'hong kong': 'HK',
  'macau': 'MO',
  'myanmar': 'MM',
  'burma': 'MM',
  'cambodia': 'KH',
  'laos': 'LA',
  'brunei': 'BN',
  'nepal': 'NP',
  'bangladesh': 'BD',
  'sri lanka': 'LK',
  'pakistan': 'PK',
  'maldives': 'MV',
  'mongolia': 'MN',
  
  // Countries - Americas
  'united states': 'US',
  'usa': 'US',
  'america': 'US',
  'canada': 'CA',
  'mexico': 'MX',
  'brazil': 'BR',
  'argentina': 'AR',
  'chile': 'CL',
  'colombia': 'CO',
  'peru': 'PE',
  'costa rica': 'CR',
  'panama': 'PA',
  'ecuador': 'EC',
  'venezuela': 'VE',
  'bolivia': 'BO',
  'uruguay': 'UY',
  'paraguay': 'PY',
  'cuba': 'CU',
  'puerto rico': 'PR',
  'jamaica': 'JM',
  'trinidad': 'TT',
  'bahamas': 'BS',
  'guatemala': 'GT',
  'honduras': 'HN',
  'nicaragua': 'NI',
  'el salvador': 'SV',
  'belize': 'BZ',
  
  // Countries - Europe
  'united kingdom': 'GB',
  'uk': 'GB',
  'england': 'GB-ENG',
  'scotland': 'GB-SCT',
  'wales': 'GB-WLS',
  'northern ireland': 'GB-NIR',
  'germany': 'DE',
  'france': 'FR',
  'spain': 'ES',
  'italy': 'IT',
  'netherlands': 'NL',
  'holland': 'NL',
  'belgium': 'BE',
  'sweden': 'SE',
  'norway': 'NO',
  'denmark': 'DK',
  'finland': 'FI',
  'ireland': 'IE',
  'portugal': 'PT',
  'austria': 'AT',
  'switzerland': 'CH',
  'poland': 'PL',
  'russia': 'RU',
  'greece': 'GR',
  'czech republic': 'CZ',
  'czechia': 'CZ',
  'hungary': 'HU',
  'romania': 'RO',
  'ukraine': 'UA',
  'croatia': 'HR',
  'bulgaria': 'BG',
  'serbia': 'RS',
  'slovakia': 'SK',
  'slovenia': 'SI',
  'iceland': 'IS',
  'estonia': 'EE',
  'latvia': 'LV',
  'lithuania': 'LT',
  'luxembourg': 'LU',
  'malta': 'MT',
  'cyprus': 'CY',
  
  // Countries - Oceania
  'australia': 'AU',
  'new zealand': 'NZ',
  'fiji': 'FJ',
  'papua new guinea': 'PG',
  
  // Countries - Africa
  'south africa': 'ZA',
  'kenya': 'KE',
  'tanzania': 'TZ',
  'egypt': 'EG',
  'morocco': 'MA',
  'nigeria': 'NG',
  'ethiopia': 'ET',
  'uganda': 'UG',
  'ghana': 'GH',
  'namibia': 'NA',
  'botswana': 'BW',
  'zimbabwe': 'ZW',
  'zambia': 'ZM',
  'mozambique': 'MZ',
  'madagascar': 'MG',
  'mauritius': 'MU',
  'rwanda': 'RW',
  
  // Countries - Middle East
  'israel': 'IL',
  'turkey': 'TR',
  'saudi arabia': 'SA',
  'uae': 'AE',
  'united arab emirates': 'AE',
  'dubai': 'AE',
  'qatar': 'QA',
  'kuwait': 'KW',
  'bahrain': 'BH',
  'oman': 'OM',
  'jordan': 'JO',
  'lebanon': 'LB',
  'iran': 'IR',
  'iraq': 'IQ',
  
  // US States
  'california': 'US-CA',
  'new york': 'US-NY',
  'texas': 'US-TX',
  'florida': 'US-FL',
  'arizona': 'US-AZ',
  'colorado': 'US-CO',
  'washington': 'US-WA',
  'oregon': 'US-OR',
  'nevada': 'US-NV',
  'utah': 'US-UT',
  'new mexico': 'US-NM',
  'montana': 'US-MT',
  'wyoming': 'US-WY',
  'idaho': 'US-ID',
  'alaska': 'US-AK',
  'hawaii': 'US-HI',
  'maine': 'US-ME',
  'vermont': 'US-VT',
  'new hampshire': 'US-NH',
  'massachusetts': 'US-MA',
  'rhode island': 'US-RI',
  'connecticut': 'US-CT',
  'new jersey': 'US-NJ',
  'pennsylvania': 'US-PA',
  'delaware': 'US-DE',
  'maryland': 'US-MD',
  'virginia': 'US-VA',
  'west virginia': 'US-WV',
  'north carolina': 'US-NC',
  'south carolina': 'US-SC',
  'georgia': 'US-GA',
  'alabama': 'US-AL',
  'mississippi': 'US-MS',
  'louisiana': 'US-LA',
  'arkansas': 'US-AR',
  'tennessee': 'US-TN',
  'kentucky': 'US-KY',
  'ohio': 'US-OH',
  'indiana': 'US-IN',
  'illinois': 'US-IL',
  'michigan': 'US-MI',
  'wisconsin': 'US-WI',
  'minnesota': 'US-MN',
  'iowa': 'US-IA',
  'missouri': 'US-MO',
  'kansas': 'US-KS',
  'nebraska': 'US-NE',
  'south dakota': 'US-SD',
  'north dakota': 'US-ND',
  'oklahoma': 'US-OK',
  
  // Canadian Provinces
  'ontario': 'CA-ON',
  'quebec': 'CA-QC',
  'british columbia': 'CA-BC',
  'alberta': 'CA-AB',
  'manitoba': 'CA-MB',
  'saskatchewan': 'CA-SK',
  'nova scotia': 'CA-NS',
  'new brunswick': 'CA-NB',
  'newfoundland': 'CA-NL',
  'prince edward island': 'CA-PE',
  
  // Australian States
  'new south wales': 'AU-NSW',
  'victoria': 'AU-VIC',
  'queensland': 'AU-QLD',
  'western australia': 'AU-WA',
  'south australia': 'AU-SA',
  'tasmania': 'AU-TAS',
  'northern territory': 'AU-NT',
  
  // Malaysian States
  'kuala lumpur': 'MY-14',
  'kl': 'MY-14',
  'selangor': 'MY-10',
  'penang': 'MY-07',
  'pulau pinang': 'MY-07',
  'johor': 'MY-01',
  'johor bahru': 'MY-01',
  'jb': 'MY-01',
  'sabah': 'MY-12',
  'sarawak': 'MY-13',
  'perak': 'MY-08',
  'kedah': 'MY-02',
  'kelantan': 'MY-03',
  'terengganu': 'MY-11',
  'pahang': 'MY-06',
  'negeri sembilan': 'MY-05',
  'melaka': 'MY-04',
  'malacca': 'MY-04',
  'perlis': 'MY-09',
  'putrajaya': 'MY-16',
  'labuan': 'MY-15',
  
  // Thai Provinces
  'bangkok': 'TH-10',
  'chiang mai': 'TH-50',
  'phuket': 'TH-83',
  'krabi': 'TH-81',
  
  // Indonesian Provinces
  'jakarta': 'ID-JK',
  'bali': 'ID-BA',
  'java': 'ID-JW',
  'sumatra': 'ID-SM',
  'borneo': 'ID-KA',
  'sulawesi': 'ID-SN',
  
  // Indian States
  'delhi': 'IN-DL',
  'mumbai': 'IN-MH',
  'maharashtra': 'IN-MH',
  'karnataka': 'IN-KA',
  'bangalore': 'IN-KA',
  'kerala': 'IN-KL',
  'tamil nadu': 'IN-TN',
  'chennai': 'IN-TN',
  'west bengal': 'IN-WB',
  'kolkata': 'IN-WB',
  'rajasthan': 'IN-RJ',
  'gujarat': 'IN-GJ',
  'goa': 'IN-GA',
  
  // Japanese Prefectures
  'tokyo': 'JP-13',
  'osaka': 'JP-27',
  'kyoto': 'JP-26',
  'hokkaido': 'JP-01',
  'okinawa': 'JP-47',
  
  // Chinese Provinces
  'beijing': 'CN-11',
  'shanghai': 'CN-31',
  'guangdong': 'CN-44',
  'yunnan': 'CN-53',
  'sichuan': 'CN-51',
};

/**
 * Convert a location name to eBird region code
 * @param {string} input - User input (location name or region code)
 * @returns {string} eBird region code
 */
function toRegionCode(input) {
  if (!input) return null;
  
  const cleaned = input.trim();
  
  // If it looks like a valid region code already (e.g., US, US-NY, US-CA-037)
  if (/^[A-Z]{2}(-[A-Z0-9]{2,3})?(-[A-Z0-9]{3})?$/i.test(cleaned)) {
    return cleaned.toUpperCase();
  }
  
  // Try to find in our mapping (exact match)
  const lowerInput = cleaned.toLowerCase();
  if (locationToCode[lowerInput]) {
    return locationToCode[lowerInput];
  }
  
  // Try partial match - input contains location name or location name contains input
  for (const [name, code] of Object.entries(locationToCode)) {
    if (lowerInput.includes(name) || name.includes(lowerInput)) {
      return code;
    }
  }
  
  // Return as-is (uppercase) and let the API validate it
  return cleaned.toUpperCase();
}

/**
 * Get location name from code (reverse lookup)
 * @param {string} code - eBird region code
 * @returns {string|null} Location name or null
 */
function getLocationName(code) {
  const upperCode = code.toUpperCase();
  for (const [name, regionCode] of Object.entries(locationToCode)) {
    if (regionCode === upperCode) {
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  }
  return null;
}

/**
 * Get suggested locations for user help
 * @returns {string} Formatted string of popular locations
 */
function getPopularLocations() {
  return `
*Popular Locations:*
🇸🇬 Singapore → \`SG\` or just type "Singapore"
🇺🇸 United States → \`US\` or "USA"
🇺🇸 California → \`US-CA\` or "California"
🇺🇸 New York → \`US-NY\` or "New York"
🇬🇧 United Kingdom → \`GB\` or "UK"
🇨🇦 Canada → \`CA\` or "Canada"
🇦🇺 Australia → \`AU\` or "Australia"
🇲🇾 Malaysia → \`MY\` or "Malaysia"
🇯🇵 Japan → \`JP\` or "Japan"
🇹🇭 Thailand → \`TH\` or "Thailand"
`;
}

module.exports = {
  toRegionCode,
  getPopularLocations,
  getLocationName,
  locationToCode
};
