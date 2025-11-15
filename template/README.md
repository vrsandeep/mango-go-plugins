# Plugin Template

This is a template for creating new mango-go plugins. Copy this directory and modify it to create your own plugin.

## Files

- `plugin.json` - Plugin manifest with metadata and configuration.
- `index.js` - Main plugin code implementing the Provider interface
- `index.test.js` - Unit tests (using Jest)
- `package.json` - npm configuration for testing
- `README.md` - This file (documentation for your plugin)

## Usage

1. Copy this directory: `cp -r template my-plugin-name`
2. Rename `plugin-example.json` to `plugin.json`. Edit `plugin.json` with your plugin information
3. Implement the required functions in `index.js`
4. Write tests in `index.test.js`
5. Test your plugin: `npm test`
6. Install in mango-go: Copy to `plugins/` directory

## Implementation Checklist

- [ ] Update `plugin.json` with your plugin details
- [ ] Load plugin metadata into `repository.json`
- [ ] Implement `search(query, mango)`
- [ ] Implement `getChapters(seriesId, mango)`
- [ ] Implement `getPageURLs(chapterId, mango)`
- [ ] Add error handling
- [ ] Add logging
- [ ] Write unit tests
- [ ] Test with real API
- [ ] Document any special configuration

## API Documentation

See [CONTRIBUTING.md](../CONTRIBUTING.md) for complete API reference.

