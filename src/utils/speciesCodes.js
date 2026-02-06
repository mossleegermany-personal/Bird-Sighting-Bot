/**
 * Common bird species name to eBird species code mapping
 * Users can type common names instead of codes
 */

const speciesMap = {
  // Common backyard birds
  'house sparrow': 'houspa',
  'sparrow': 'houspa',
  'european starling': 'eursta',
  'starling': 'eursta',
  'american robin': 'amerob',
  'robin': 'amerob',
  'blue jay': 'blujay',
  'northern cardinal': 'norcar',
  'cardinal': 'norcar',
  'american crow': 'amecro',
  'crow': 'amecro',
  'mourning dove': 'moudov',
  'dove': 'moudov',
  'rock pigeon': 'rocpig',
  'pigeon': 'rocpig',
  'common grackle': 'comgra',
  'grackle': 'comgra',
  
  // Hawks and eagles
  'red-tailed hawk': 'rethaw',
  'red tailed hawk': 'rethaw',
  'cooper\'s hawk': 'coohaw',
  'coopers hawk': 'coohaw',
  'sharp-shinned hawk': 'shshaw',
  'bald eagle': 'baleag',
  'eagle': 'baleag',
  'golden eagle': 'goleag',
  'osprey': 'osprey',
  'peregrine falcon': 'perfal',
  'falcon': 'perfal',
  'american kestrel': 'amekes',
  'kestrel': 'amekes',
  
  // Owls
  'great horned owl': 'grhowl',
  'horned owl': 'grhowl',
  'barred owl': 'brdowl',
  'barn owl': 'brnowl',
  'eastern screech-owl': 'easowl1',
  'screech owl': 'easowl1',
  'snowy owl': 'snoowl1',
  
  // Woodpeckers
  'downy woodpecker': 'dowwoo',
  'woodpecker': 'dowwoo',
  'hairy woodpecker': 'haiwoo',
  'red-bellied woodpecker': 'rebwoo',
  'pileated woodpecker': 'pilwoo',
  'northern flicker': 'norfli',
  'flicker': 'norfli',
  
  // Hummingbirds
  'ruby-throated hummingbird': 'rthhum',
  'hummingbird': 'rthhum',
  'anna\'s hummingbird': 'annhum',
  'annas hummingbird': 'annhum',
  'rufous hummingbird': 'rufhum',
  
  // Finches
  'house finch': 'houfin',
  'finch': 'houfin',
  'american goldfinch': 'amegfi',
  'goldfinch': 'amegfi',
  'purple finch': 'purfin',
  
  // Warblers
  'yellow warbler': 'yelwar',
  'warbler': 'yelwar',
  'black-throated blue warbler': 'btbwar',
  'american redstart': 'amered',
  'redstart': 'amered',
  'common yellowthroat': 'comyel',
  'yellowthroat': 'comyel',
  
  // Waterfowl
  'mallard': 'mallar3',
  'mallard duck': 'mallar3',
  'duck': 'mallar3',
  'canada goose': 'cangoo',
  'goose': 'cangoo',
  'wood duck': 'wooduc',
  'american black duck': 'ambduc',
  'great blue heron': 'grbher3',
  'heron': 'grbher3',
  'blue heron': 'grbher3',
  'green heron': 'grnher',
  'great egret': 'greegr',
  'egret': 'greegr',
  'snowy egret': 'snoegr',
  
  // Shorebirds
  'killdeer': 'killde',
  'american woodcock': 'amewoo',
  'woodcock': 'amewoo',
  'spotted sandpiper': 'sposan',
  'sandpiper': 'sposan',
  'greater yellowlegs': 'greyel',
  'yellowlegs': 'greyel',
  
  // Gulls and terns
  'herring gull': 'hergul',
  'gull': 'hergul',
  'seagull': 'hergul',
  'ring-billed gull': 'ribgul',
  'common tern': 'comter',
  'tern': 'comter',
  
  // Chickadees and titmice
  'black-capped chickadee': 'bkcchi',
  'chickadee': 'bkcchi',
  'tufted titmouse': 'tuftit',
  'titmouse': 'tuftit',
  
  // Nuthatches
  'white-breasted nuthatch': 'whbnut',
  'nuthatch': 'whbnut',
  'red-breasted nuthatch': 'rebnut',
  
  // Wrens
  'carolina wren': 'carwre',
  'wren': 'carwre',
  'house wren': 'houwre',
  
  // Thrushes
  'eastern bluebird': 'easblu',
  'bluebird': 'easblu',
  'wood thrush': 'woothr',
  'thrush': 'woothr',
  'hermit thrush': 'herthr',
  
  // Swallows
  'barn swallow': 'barswa',
  'swallow': 'barswa',
  'tree swallow': 'treswa',
  'purple martin': 'purmar',
  'martin': 'purmar',
  
  // Blackbirds
  'red-winged blackbird': 'rewbla',
  'blackbird': 'rewbla',
  'common yellowthroat': 'comyel',
  'baltimore oriole': 'balori',
  'oriole': 'balori',
  
  // Kingfisher
  'belted kingfisher': 'belkin1',
  'kingfisher': 'belkin1',
  
  // Turkey and pheasant
  'wild turkey': 'wiltur',
  'turkey': 'wiltur',
  'ring-necked pheasant': 'rinphe',
  'pheasant': 'rinphe',
  
  // Asian birds (Singapore, Malaysia, etc.)
  'asian koel': 'asikoe2',
  'koel': 'asikoe2',
  'common myna': 'commyn',
  'myna': 'commyn',
  'mynah': 'commyn',
  'javan myna': 'javmyn',
  'oriental magpie-robin': 'ormrob1',
  'magpie robin': 'ormrob1',
  'magpie-robin': 'ormrob1',
  'white-throated kingfisher': 'whtkin2',
  'collared kingfisher': 'colkin1',
  'olive-backed sunbird': 'olbsun2',
  'sunbird': 'olbsun2',
  'crimson sunbird': 'crisun2',
  'brown-throated sunbird': 'brtsun1',
  'pink-necked green pigeon': 'pngpig1',
  'green pigeon': 'pngpig1',
  'zebra dove': 'zebdov',
  'spotted dove': 'spodov',
  'black-naped oriole': 'blnori1',
  'yellow-vented bulbul': 'yevbul1',
  'bulbul': 'yevbul1',
  'white-breasted waterhen': 'whbwat1',
  'waterhen': 'whbwat1',
  'common kingfisher': 'comkin1',
  'white-bellied sea eagle': 'wbseag1',
  'sea eagle': 'wbseag1',
  'brahminy kite': 'brakit1',
  'kite': 'brakit1',
  'changeable hawk-eagle': 'chhaea1',
  'hawk eagle': 'chhaea1',
  'grey heron': 'gryher',
  'purple heron': 'purher1',
  'little egret': 'litegr',
  'cattle egret': 'categr',
  'pacific swallow': 'pacswa2',
  'barn swallow': 'barswa',
  'house swift': 'houswi',
  'swift': 'houswi',
  'asian palm swift': 'aspswi1',
  
  // European birds
  'european robin': 'eurrob1',
  'european goldfinch': 'eurgol',
  'great tit': 'gretit1',
  'tit': 'gretit1',
  'blue tit': 'blutit1',
  'eurasian blackbird': 'eurbla',
  'common blackbird': 'eurbla',
  'song thrush': 'sonthr1',
  'eurasian magpie': 'eurmag1',
  'magpie': 'eurmag1',
  'common chaffinch': 'chafin',
  'chaffinch': 'chafin',
  'eurasian wren': 'wren1',
  'eurasian nuthatch': 'eurnut1',
  'long-tailed tit': 'lottit1',
  'common swift': 'comswi',
  'barn owl': 'brnowl',
  'tawny owl': 'tawowl1',
  'eurasian sparrowhawk': 'eurspa1',
  'sparrowhawk': 'eurspa1',
  'common buzzard': 'combuz1',
  'buzzard': 'combuz1',
  'common kestrel': 'comkes',
  'grey wagtail': 'grywag',
  'wagtail': 'grywag',
  'pied wagtail': 'whywag',
  'white wagtail': 'whywag',
  'common kingfisher': 'comkin1',
  'european bee-eater': 'eubeat',
  'bee-eater': 'eubeat',
  'hoopoe': 'hoopoe',
  
  // Australian birds
  'australian magpie': 'ausmag1',
  'magpie-lark': 'maglark1',
  'noisy miner': 'noimyn1',
  'rainbow lorikeet': 'rainlo1',
  'lorikeet': 'rainlo1',
  'sulphur-crested cockatoo': 'succoc1',
  'cockatoo': 'succoc1',
  'galah': 'galah1',
  'laughing kookaburra': 'laukoo1',
  'kookaburra': 'laukoo1',
  'willie wagtail': 'wilwag1',
  'superb fairy-wren': 'supfai1',
  'fairy wren': 'supfai1',
  'australian white ibis': 'auwibi1',
  'ibis': 'auwibi1',
  'masked lapwing': 'maslap1',
  'lapwing': 'maslap1',
  'welcome swallow': 'welswa2',
  
  // Parrots (various regions)
  'budgerigar': 'budger',
  'budgie': 'budger',
  'cockatiel': 'cockat1',
  'red-rumped parrot': 'rerpar1',
  'parrot': 'rerpar1',
  'rose-ringed parakeet': 'rorpar',
  'parakeet': 'rorpar',
  'alexandrine parakeet': 'alepar1',
  
  // Pelicans and cormorants
  'american white pelican': 'amwpel',
  'pelican': 'amwpel',
  'brown pelican': 'brnpel',
  'double-crested cormorant': 'doccor',
  'cormorant': 'doccor',
  
  // Vultures
  'turkey vulture': 'turvul',
  'vulture': 'turvul',
  'black vulture': 'blkvul',
  
  // Other common species
  'cedar waxwing': 'cedwax',
  'waxwing': 'cedwax',
  'indigo bunting': 'indbun',
  'bunting': 'indbun',
  'painted bunting': 'paibun',
  'scarlet tanager': 'scatan',
  'tanager': 'scatan',
  'summer tanager': 'sumtan',
  'rose-breasted grosbeak': 'robgro',
  'grosbeak': 'robgro',
  'dark-eyed junco': 'daejun',
  'junco': 'daejun',
  'white-throated sparrow': 'whtspa',
  'song sparrow': 'sonspa',
  'chipping sparrow': 'chispa',
};

/**
 * Convert a species name to eBird species code
 * If already a code (no spaces, short), returns as-is
 */
function toSpeciesCode(input) {
  if (!input) return input;
  
  const normalized = input.toLowerCase().trim();
  
  // If it looks like a species code already (short, no spaces), return it
  if (normalized.length <= 8 && !normalized.includes(' ')) {
    return normalized;
  }
  
  // Look up in map
  if (speciesMap[normalized]) {
    return speciesMap[normalized];
  }
  
  // Try partial match (starts with)
  for (const [name, code] of Object.entries(speciesMap)) {
    if (name.startsWith(normalized) || normalized.startsWith(name)) {
      return code;
    }
  }
  
  // Return as-is (might be a valid code)
  return normalized;
}

/**
 * Get species name from code (reverse lookup)
 */
function getSpeciesName(code) {
  if (!code) return code;
  const normalized = code.toLowerCase();
  
  for (const [name, specCode] of Object.entries(speciesMap)) {
    if (specCode === normalized) {
      // Capitalize first letter of each word
      return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  return code.toUpperCase();
}

/**
 * Search for species by partial name
 */
function searchSpecies(query) {
  if (!query) return [];
  
  const normalized = query.toLowerCase().trim();
  const results = [];
  
  for (const [name, code] of Object.entries(speciesMap)) {
    if (name.includes(normalized)) {
      results.push({ name, code });
    }
  }
  
  // Remove duplicates (same code) and return unique
  const seen = new Set();
  return results.filter(r => {
    if (seen.has(r.code)) return false;
    seen.add(r.code);
    return true;
  }).slice(0, 10);
}

/**
 * Get some popular species for suggestions
 */
function getPopularSpecies() {
  return `*Popular Species:*
🦅 Hawks: \`red-tailed hawk\`, \`eagle\`, \`osprey\`
🦉 Owls: \`great horned owl\`, \`barn owl\`, \`snowy owl\`
🐦 Songbirds: \`cardinal\`, \`blue jay\`, \`robin\`
🦆 Waterfowl: \`mallard\`, \`canada goose\`, \`heron\`
🌺 Tropical: \`sunbird\`, \`myna\`, \`kingfisher\`
🦜 Parrots: \`lorikeet\`, \`cockatoo\`, \`parakeet\``;
}

module.exports = {
  toSpeciesCode,
  getSpeciesName,
  searchSpecies,
  getPopularSpecies,
  speciesMap
};
