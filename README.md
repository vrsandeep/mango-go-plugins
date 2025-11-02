# Mango-Go Plugins

This repository contains community-contributed plugins for [mango-go](https://github.com/vrsandeep/mango-go), enabling support for additional comic/manga sources.

## What are Plugins?

Plugins extend mango-go with new download sources. Each plugin is a JavaScript module that implements the Provider interface, allowing users to download comics from various websites.

## Getting Started

### Installing a Plugin

1. Clone or download this repository
2. Copy the plugin directory to your mango-go plugins path configured in [config.yml](https://github.com/vrsandeep/mango-go/blob/master/config.yml)
3. Restart mango-go (plugins are loaded at startup)


## Available Plugins

See individual plugin directories for installation instructions and documentation.

- **[Webtoons](./webtoons/)** - Download webtoons from [webtoons.com](https://www.webtoons.com)

### Contributing a Plugin

Submit your plugin via pull request! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Start

1. Use the template in `template/` directory
2. Copy and modify `plugin.json` and `index.js`
3. Test your plugin independently (no mango-go needed)
4. Submit via pull request

## License

Plugins in this repository are licensed under their respective licenses (see each plugin's directory).

