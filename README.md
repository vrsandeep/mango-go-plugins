# Mango-Go Plugins

This repository contains community-contributed plugins for [mango-go](https://github.com/vrsandeep/mango-go), enabling support for additional comic/manga sources.

## What are Plugins?

Plugins extend mango-go with new download sources. Each plugin is a JavaScript module that implements the Provider interface, allowing users to download comics from various websites.

## Getting Started

### Installing a Plugin

1. Clone or download this repository
2. Go to admin page of mango-go and install
3. Click on reload all plugins in the same page


### Contributing a Plugin

Submit your plugin via pull request! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Start

1. Use the template in `template/` directory
2. Copy and modify `plugin.json` and `index.js`
3. Test your plugin independently (no mango-go needed)
4. Submit via pull request

## License

Plugins in this repository are licensed as documented in [repository.json](./repository.json).

