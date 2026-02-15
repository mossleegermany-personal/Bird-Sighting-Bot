/**
 * Display Handlers — pagination, summary, full list, and share formatting.
 */
const { esc } = require('../../utils/markdown');

module.exports = {
  async sendPaginatedObservations(chatId, observations, displayName, type, page = 0, messageId = null, regionCode = null) {
    if (!observations || observations.length === 0) {
      await this.sendMessage(chatId, '❌ No observations found for this location.');
      return;
    }

    const totalPages = Math.ceil(observations.length / this.ITEMS_PER_PAGE);
    const startIdx = page * this.ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + this.ITEMS_PER_PAGE, observations.length);
    const pageObservations = observations.slice(startIdx, endIdx);

    let title;
    if (type === 'notable') {
      title = `⭐ Notable Sightings in ${esc(displayName)}`;
    } else if (type === 'nearby') {
      title = `🐦 Birds Near ${esc(displayName)}`;
    } else if (type === 'species') {
      title = `🔎 ${esc(displayName)} Sightings`;
    } else {
      title = `🐦 Recent Sightings in ${esc(displayName)}`;
    }
    
    let message = `*${title}*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📊 Showing ${startIdx + 1}-${endIdx} of ${observations.length}\n`;
    message += `📄 Page ${page + 1} of ${totalPages}\n\n`;

    pageObservations.forEach((obs, index) => {
      message += `${startIdx + index + 1}. ${this.ebirdService.formatObservation(obs, regionCode)}\n`;
    });

    // Create pagination buttons
    const buttons = [];
    
    // First row: First, Previous, Page Info, Next, Last
    const navRow = [];
    
    // First page button (only show if not on first page)
    if (page > 0) {
      navRow.push({ text: '⏮️ First', callback_data: `page_${type}_0` });
      navRow.push({ text: '⬅️ Prev', callback_data: `page_${type}_${page - 1}` });
    }
    
    navRow.push({ text: `${page + 1}/${totalPages}`, callback_data: 'page_info' });
    
    // Next and Last page buttons (only show if not on last page)
    if (page < totalPages - 1) {
      navRow.push({ text: 'Next ➡️', callback_data: `page_${type}_${page + 1}` });
      navRow.push({ text: 'Last ⏭️', callback_data: `page_${type}_${totalPages - 1}` });
    }
    
    buttons.push(navRow);
    
    // Second row: Jump to page (only show if more than 2 pages)
    if (totalPages > 2) {
      buttons.push([{ text: '🔢 Jump to Page', callback_data: `jump_${type}` }]);
    }
    
    // Third row: Summary
    buttons.push([{ text: '📊 Summary List', callback_data: `specsummary_${type}` }]);

    // Fourth row: Share / New Search / Done
    buttons.push([
      { text: '📤 Share', callback_data: `share_${type}` },
      { text: '🔍 New Search', callback_data: 'new_search' },
      { text: '✅ Done', callback_data: 'done' }
    ]);

    const replyMarkup = {
      inline_keyboard: buttons
    };

    // If messageId is provided, edit the existing message instead of sending a new one
    if (messageId) {
      try {
        await this.bot.editMessageText(message, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: replyMarkup,
          disable_web_page_preview: true
        });
        return;
      } catch (error) {
        console.error('Error editing message:', error.message);
        // Fall through to send a new message if edit fails
      }
    }

    await this.sendMessage(chatId, message, {
      reply_markup: replyMarkup,
      disable_web_page_preview: true
    });
  },

  /**
   * Build the title string for a sighting type
   */
  _buildTitle(type, displayName) {
    if (type === 'notable') return `⭐ Notable Sightings in ${esc(displayName)}`;
    if (type === 'nearby') return `🐦 Birds Near ${esc(displayName)}`;
    if (type === 'species') return `🔎 ${esc(displayName)} Sightings`;
    return `🐦 Recent Sightings in ${esc(displayName)}`;
  },

  /**
   * Send a condensed species summary — unique species with locations as sub-points.
   * Always fits in one message. No dates/times shown.
   */
  async sendSummaryMessage(chatId, observations, displayName, type, regionCode = null) {
    const title = this._buildTitle(type, displayName);
    const { getTimezoneAbbr } = require('../../utils/dateUtils');
    const tzAbbr = getTimezoneAbbr(regionCode);

    // Group observations by species → location → date → times
    const speciesMap = new Map();
    for (const obs of observations) {
      const key = obs.speciesCode || obs.comName;
      if (!speciesMap.has(key)) {
        speciesMap.set(key, { comName: obs.comName, count: 0, locations: new Map() });
      }
      const entry = speciesMap.get(key);
      entry.count += obs.howMany || 1;

      const loc = obs.locName;
      if (!entry.locations.has(loc)) {
        entry.locations.set(loc, { count: 0, dates: new Map() });
      }
      const locEntry = entry.locations.get(loc);
      locEntry.count += obs.howMany || 1;

      // Parse date and time from obsDt ("2026-02-15 08:30")
      if (obs.obsDt) {
        const parts = obs.obsDt.split(' ');
        const datePart = parts[0]; // yyyy-mm-dd
        const timePart = parts[1] || null;
        const [year, month, day] = datePart.split('-');
        const dateKey = `${day}/${month}/${year}`;

        if (!locEntry.dates.has(dateKey)) {
          locEntry.dates.set(dateKey, new Set());
        }
        if (timePart) {
          locEntry.dates.get(dateKey).add(timePart);
        }
      }
    }

    let msg = `📊 *Summary*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `*${title}*\n`;
    msg += `🐦 *${speciesMap.size}* species · ${observations.length} sightings\n\n`;

    let idx = 1;
    for (const [, sp] of speciesMap) {
      msg += `${idx}. *${esc(sp.comName)}* (x${sp.count})\n`;

      for (const [loc, info] of sp.locations) {
        msg += `    📍 ${esc(loc)} (x${info.count})\n`;

        // Show dates with grouped times
        for (const [dateKey, times] of info.dates) {
          const sortedTimes = [...times].sort();
          if (sortedTimes.length > 0) {
            msg += `    📅 ${dateKey} ${sortedTimes.join(', ')} ${tzAbbr}\n`;
          } else {
            msg += `    📅 ${dateKey} ${tzAbbr}\n`;
          }
        }
      }

      msg += `\n`; // gap between entries
      idx++;

      // Safety: if approaching 3800 chars, truncate remaining
      if (msg.length > 3800) {
        const remaining = speciesMap.size - idx + 1;
        if (remaining > 0) {
          msg += `\n_...and ${remaining} more species_\n`;
        }
        break;
      }
    }

    msg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🤖 _Bird Sighting Bot_`;

    await this.sendMessage(chatId, msg, { disable_web_page_preview: true });
  },

  /**
   * Send the complete list as full detailed messages
   */
  async sendFullListMessage(chatId, observations, displayName, type, regionCode = null) {
    const MAX_MESSAGE_LENGTH = 4000;
    const title = this._buildTitle(type, displayName);

    let header = `📋 *Full Sightings List*\n`;
    header += `━━━━━━━━━━━━━━━━━━━━\n`;
    header += `*${title}*\n`;
    header += `📊 Total: ${observations.length} sightings\n\n`;

    const allLines = observations.map((obs, index) =>
      `${index + 1}. ${this.ebirdService.formatObservation(obs, regionCode)}`
    );

    const messages = [];
    let currentMessage = header;
    let currentPart = 1;

    for (const line of allLines) {
      if (currentMessage.length + line.length + 2 > MAX_MESSAGE_LENGTH) {
        messages.push(currentMessage);
        currentPart++;
        currentMessage = `📋 *Full Sightings List (Part ${currentPart})*\n`;
        currentMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      }
      currentMessage += line + '\n';
    }

    currentMessage += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    currentMessage += `🤖 _Bird Sighting Bot_`;
    messages.push(currentMessage);

    for (const msg of messages) {
      await this.sendMessage(chatId, msg, { disable_web_page_preview: true });
    }
  },

  /**
   * Send the complete list as forwardable messages (for Share)
   */
  async sendForwardableMessage(chatId, observations, displayName, type, regionCode = null) {
    const MAX_MESSAGE_LENGTH = 4000;
    const title = this._buildTitle(type, displayName);

    let header = `📤 *Shared Bird Sightings*\n`;
    header += `━━━━━━━━━━━━━━━━━━━━\n`;
    header += `*${title}*\n`;
    header += `📊 Total: ${observations.length} sightings\n\n`;

    const allLines = observations.map((obs, index) =>
      `${index + 1}. ${this.ebirdService.formatObservation(obs, regionCode)}`
    );

    const messages = [];
    let currentMessage = header;
    let currentPart = 1;

    for (const line of allLines) {
      if (currentMessage.length + line.length + 2 > MAX_MESSAGE_LENGTH) {
        messages.push(currentMessage);
        currentPart++;
        currentMessage = `📤 *Shared Bird Sightings (Part ${currentPart})*\n`;
        currentMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      }
      currentMessage += line + '\n';
    }

    currentMessage += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    currentMessage += `🤖 _Shared via Bird Sighting Bot_\n`;
    currentMessage += `📱 _Forward this message to share!_`;
    messages.push(currentMessage);

    for (const msg of messages) {
      await this.sendMessage(chatId, msg, { disable_web_page_preview: true });
    }
  }
};
