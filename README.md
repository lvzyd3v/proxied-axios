# ProxiedAxios

[![npm version](https://badge.fury.io/js/proxied-axios.svg)](https://badge.fury.io/js/proxied-axios)
[![npm downloads](https://img.shields.io/npm/dm/proxied-axios.svg)](https://www.npmjs.com/package/proxied-axios)
[![license](https://img.shields.io/npm/l/proxied-axios.svg)](https://github.com/yourusername/proxied-axios/blob/main/LICENSE)

A Node.js library for making HTTP requests through SOCKS5 proxies with automatic proxy rotation and management.

## Installation

```bash
npm install proxied-axios
```

## Usage

### Direct Proxy List
```javascript
import ProxiedAxios from 'proxied-axios';

// Initialize with proxy list
const client = new ProxiedAxios({
    proxies: [
        { ip: '1.2.3.4', port: '1080', username: 'user', password: 'pass' },
        { ip: '5.6.7.8', port: '1080' }  // Optional: without authentication
    ]
});

// Make requests
const response = await client.get('https://api.example.com/data');
```

### Load from File
```javascript
// Load proxies from a file
const client = await ProxiedAxios.loadProxiesFromFile('path/to/proxies.txt');
```

### Automatic Proxy Refresh
```javascript
// Initialize with proxy URL for automatic refresh
const client = new ProxiedAxios({
    proxyUrl: 'https://your-proxy-provider.com/proxies',
    refreshInterval: 12 * 60 * 60 * 1000  // Optional: refresh every 12 hours
});

// The library will automatically:
// - Create .proxied-axios directory for proxy storage
// - Add .proxied-axios/ to .gitignore and .npmignore
// - Handle proxy refresh and caching

// Make requests
const response = await client.get('https://api.example.com/data');
```

### Logging

By default, logging is disabled. You can enable it to see detailed information about proxy operations:

```javascript
// Enable logging
ProxiedAxios.enableLogging();

// Disable logging
ProxiedAxios.disableLogging();
```

Logs will be prefixed with `[ProxiedAxios]` for easy identification.

## Proxy File Format

The proxy file should contain one proxy per line in the format:
```
ip:port[:username:password]
```

Examples:
```
1.2.3.4:1080:user:pass
5.6.7.8:1080
```

## Features

- Automatic proxy rotation
- Support for authenticated and non-authenticated proxies
- Proxy validation and error handling
- Configurable retry mechanism
- Automatic proxy refresh from URL with local caching
- Automatic setup of configuration directory and git/npm ignores

## API Reference

### Constructor Options

```javascript
new ProxiedAxios(options)
```

**Options:**
- `proxies` (Array): Array of proxy objects with `ip`, `port`, `username` (optional), `password` (optional)
- `proxyUrl` (String): URL to fetch proxy list from
- `refreshInterval` (Number): Interval in milliseconds to refresh proxies (default: 12 hours)

### Static Methods

- `ProxiedAxios.loadProxiesFromFile(filePath)` - Load proxies from a file
- `ProxiedAxios.enableLogging()` - Enable debug logging
- `ProxiedAxios.disableLogging()` - Disable debug logging

### Instance Methods

All standard HTTP methods are supported:
- `get(url, config)` - GET requests
- `post(url, data, config)` - POST requests
- `put(url, data, config)` - PUT requests
- `delete(url, config)` - DELETE requests
- `patch(url, data, config)` - PATCH requests
- `head(url, config)` - HEAD requests
- `options(url, config)` - OPTIONS requests

**Generic method:**
- `request(config)` - Generic request method accepting full Axios config

## Contributing

Contributions are welcome! I appreciate your help in making `proxied-axios` better.

### Reporting Issues

If you find a bug or have a feature request:

1. **Check existing issues** first to avoid duplicates
2. **Create a new issue** with:
   - Clear title and description
   - Steps to reproduce (for bugs)
   - Expected vs actual behavior
   - Your environment details (Node.js version, OS, etc.)

## License

MIT 