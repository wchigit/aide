# Changelog

## [Unreleased] — wc/whatsapp-baileys

### Added
- **WhatsApp channel**: Two-way messaging via Baileys (WhatsApp Web protocol, QR auth, no server needed)
- **WhatsApp commands**: `/tasks`, `/report`, `/done`, `/help` + agent routing
- **WhatsApp delivery**: Job results can fan out to WhatsApp
- **WhatsApp UI**: QR code connection card in Settings drawer

### Fixed
- CI install step: synced `package-lock.json` with `package.json` so `npm ci` no longer fails with missing `ws` / `eventemitter3`

## [Unreleased] — wc/more-channels

### Added
- **Discord channel**: Two-way messaging via raw WebSocket Gateway + REST API
- **Telegram channel**: Two-way messaging via Bot API long polling
- **Slack channel**: Two-way messaging via Socket Mode + Web API
- **Channel commands**: `/tasks`, `/report`, `/done`, `/setup`, `/help` for all channels
- **Delivery targets**: Job results can now fan out to `wechat`, `telegram`, `slack`, `discord`, `desktop`
- **Setup guides**: Collapsible inline setup instructions in each channel's config form
- **WeChat context persistence**: `contextToken` saved to disk so proactive messages survive restarts
- **WeChat connected hint**: "Say hi to the bot in WeChat to let Aide reach you."
- **Delivery logging**: Per-target OK/failed logs in job delivery
- **docs/channel-setup.md**: Full setup documentation for all channels
- **investigation/meta-channels-research.md**: Research on WhatsApp/Messenger/Instagram feasibility

### Fixed
- Discord mention stripping: handle role mentions (`<@&ID>`) in addition to user mentions
- WeChat delivery silently failing when `contextToken` was empty
- Discord channel ID mismatch detection (debug logging for configured vs actual channel)

### Changed
- SettingsDrawer: Channel config forms now show expandable "How do I get these values?" guide
- SettingsDrawer: Removed redundant connected-state hints (users can discover `/help` on their own)
