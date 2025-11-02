# Webtoons Plugin for Mango-Go

A plugin to download webtoons from [webtoons.com](https://www.webtoons.com).

## Features

- Search for webtoons by title
- List chapters for a webtoon series
- Download chapter pages as images

## Installation

Copy this plugin directory to your Mango-Go plugins folder:

```bash
cp -r webtoons /path/to/mango-go/plugins/
```

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

## Example Search Queries

- "unOrdinary" - Popular webtoon by uru-chan
- "Tower of God" - Long-running webtoon series
- "Lore Olympus" - Popular romance webtoon

## Known Issues

If searches return no results:

1. **Case sensitivity**: Webtoons search may be case-sensitive. Try different capitalizations.
2. **Partial matches**: The search may require exact matches. Try the full title.
3. **Rate limiting**: Too many requests may result in temporary bans. Use with moderation.

## Troubleshooting

### No results for "unordinary"

The search might need:
- Exact case: "unOrdinary" (with capital O)
- Full title match
- Different search terms

If issues persist, check the Mango-Go logs for detailed error messages.

## Development

The plugin uses:
- JavaScript (ES6+)
- Async/await for HTTP requests
- Regular expressions for HTML parsing

## License

MIT
