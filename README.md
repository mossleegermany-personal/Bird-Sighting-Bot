# 🦅 Bird Sighting Bot

A Telegram bot that helps birders discover bird sightings using data from eBird, the world's largest biodiversity database.

## Features

- **Search by Location** - See all birds spotted in any region (country, state, or city)
- **Search by Species** - Find where a specific bird species has been sighted
- **Notable Sightings** - Discover rare and unusual bird observations
- **Nearby Birds** - Get sightings near your GPS location
- **Birding Hotspots** - Find popular birding locations in any region
- **Pagination** - Browse through results with Previous/Next navigation
- **Google Maps Integration** - View sighting locations on Google Maps

## Prerequisites

- Node.js v16 or higher
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- eBird API Key (from [eBird API](https://ebird.org/api/keygen))

## Project Structure

```
Bird-Sighting-Bot/
├── src/
│   ├── index.js              # Entry point
│   ├── bot/
│   │   └── telegramBot.js    # Telegram bot logic
│   ├── services/
│   │   └── ebirdService.js   # eBird API integration
│   └── utils/
│       ├── regionCodes.js    # Region code mappings
│       └── speciesCodes.js   # Species code utilities
├── package.json
├── .env
└── README.md
```

## License

MIT
