# Webtoons Plugin for Mango-Go

A plugin to download webtoons from [webtoons.com](https://www.webtoons.com).


## Usage

Once installed, the plugin will be available as a provider in Mango-Go. You can search for webtoons and download chapters through the UI.

## Testing

Run the unit tests:

```bash
npm test
```

Or with watch mode:

```bash
npm run test:watch
```

## Known Issues

If searches return no results:

1. **Case sensitivity**: Webtoons search may be case-sensitive. Try different capitalizations.
2. **Partial matches**: The search may require exact matches. Try the full title.
3. **Rate limiting**: Too many requests may result in temporary bans. Use with moderation.
