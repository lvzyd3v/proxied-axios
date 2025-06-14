import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import fs from 'fs/promises';
import path from 'path';

export default class ProxiedAxios {
    static #instance;
    static #PREFIX = '[ProxiedAxios]';
    static #CONFIG_DIR = '.proxied-axios';
    static #CONFIG_ENTRY = '\n# ProxiedAxios configuration\n.proxied-axios/\n';
    static #loggerEnabled = false;
    
    static #logWithPrefix(method, ...args) {
        if (ProxiedAxios.#loggerEnabled) {
            console[method](ProxiedAxios.#PREFIX, ...args);
        }
    }

    static #logger = {
        log: (...args) => ProxiedAxios.#logWithPrefix('log', ...args),
        error: (...args) => ProxiedAxios.#logWithPrefix('error', ...args),
        warn: (...args) => ProxiedAxios.#logWithPrefix('warn', ...args)
    };

    proxies = [];
    timeout = 5000;
    #proxyUrl;
    #refreshInterval;
    #readyPromise;
    #configDir;

    static enableLogging() {
        ProxiedAxios.#loggerEnabled = true;
        return ProxiedAxios;
    }

    static disableLogging() {
        ProxiedAxios.#loggerEnabled = false;
        return ProxiedAxios;
    }

    static #validateProxyFormat(proxyString) {
        const parts = proxyString.trim().split(':');
        
        if (parts.length < 2) {
            throw new Error(`Invalid proxy format: ${proxyString}. Must be in format ip:port[:username:password]`);
        }

        const [ip, port, username, password] = parts;

        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipRegex.test(ip)) {
            throw new Error(`Invalid IP address format: ${ip}`);
        }

        const portNum = parseInt(port);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            throw new Error(`Invalid port number: ${port}`);
        }

        if (username && !password) {
            throw new Error(`Password is required when username is provided: ${proxyString}`);
        }

        return { ip, port, username, password };
    }

    static #parseProxyLine(line) {
        if (!line.trim()) return null;
        return ProxiedAxios.#validateProxyFormat(line);
    }

    static #parseProxyList(content) {
        return content
            .split('\n')
            .map(line => {
                try {
                    return ProxiedAxios.#parseProxyLine(line);
                } catch (error) {
                    ProxiedAxios.#logger.error(`Error parsing proxy line: ${error.message}`);
                    return null;
                }
            })
            .filter(proxy => proxy !== null);
    }

    static async #handleIgnoreFile(filePath, entry) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            if (!content.includes(ProxiedAxios.#CONFIG_DIR)) {
                await fs.appendFile(filePath, entry);
                ProxiedAxios.#logger.log(`Added ${ProxiedAxios.#CONFIG_DIR}/ to ${path.basename(filePath)}`);
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.writeFile(filePath, entry);
                ProxiedAxios.#logger.log(`Created ${path.basename(filePath)} with ${ProxiedAxios.#CONFIG_DIR}/ entry`);
            } else {
                throw error;
            }
        }
    }

    static async loadProxiesFromFile(filePath, options = {}) {
        try {
            const fileContent = await fs.readFile(filePath, 'utf8');
            const proxies = ProxiedAxios.#parseProxyList(fileContent);

            if (proxies.length === 0) {
                throw new Error('No valid proxies found in file');
            }

            return new ProxiedAxios({ ...options, proxies });
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Proxy file not found: ${filePath}`);
            }
            throw error;
        }
    }

    constructor(options = {}) {
        if (ProxiedAxios.#instance) {
            return ProxiedAxios.#instance;
        }

        const {
            proxies = [],
            retries = 5,
            proxyUrl = null,
            refreshInterval = 12 * 60 * 60 * 1000  // 12 hours default
        } = options;

        this.proxies = proxies;
        this.retries = retries;
        this.#proxyUrl = proxyUrl;
        this.#refreshInterval = refreshInterval;
        this.#configDir = path.join(process.cwd(), ProxiedAxios.#CONFIG_DIR);

        // Initialize readiness promise
        if (this.#proxyUrl) {
            // Automatically run setup if needed
            this.#readyPromise = (async () => {
                try {
                    await fs.access(this.#configDir);
                } catch {
                    await ProxiedAxios.setup();
                }
                await this.refreshProxies();
            })();
            this.setupProxyRefreshTimer();
        } else if (this.proxies.length > 0) {
            this.#readyPromise = Promise.resolve();
        } else {
            this.#readyPromise = Promise.reject(new Error('No proxies provided and no proxy URL configured'));
        }

        ProxiedAxios.#instance = this;
    }

    static async getInstance() {
        if (!ProxiedAxios.#instance) {
            await new Promise((resolve) => {
                const checkInstance = () => {
                    if (ProxiedAxios.#instance) {
                        resolve();
                    } else {
                        setTimeout(checkInstance, 100);
                    }
                };
                checkInstance();
            });
        }
        return ProxiedAxios.#instance;
    }

    async refreshProxies() {
        const proxyFilePath = path.join(this.#configDir, 'proxies.txt');
        try {
            const stats = await fs.stat(proxyFilePath);
            const lastModified = stats.mtime;
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            if (lastModified < oneDayAgo) {
                ProxiedAxios.#logger.log('Proxy file is older than a day. Fetching new proxies...');
                await this.fetchAndSaveProxies(proxyFilePath);
            } else {
                const proxyContent = await fs.readFile(proxyFilePath, 'utf-8');
                this.proxies = ProxiedAxios.#parseProxyList(proxyContent);
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                ProxiedAxios.#logger.log('Proxy file not found. Fetching new proxies...');
                await this.fetchAndSaveProxies(proxyFilePath);
            } else {
                ProxiedAxios.#logger.error('Error loading proxies:', error.message);
            }
        }
    }

    async fetchAndSaveProxies(proxyFilePath) {
        try {
            if (!this.#proxyUrl) {
                throw new Error('Proxy URL not configured');
            }

            const response = await axios.get(this.#proxyUrl);
            const proxies = ProxiedAxios.#parseProxyList(response.data);

            if (proxies.length === 0) {
                throw new Error('No valid proxies found in response');
            }

            await fs.mkdir(this.#configDir, { recursive: true });
            await fs.writeFile(proxyFilePath, response.data);
            this.proxies = proxies;
        } catch (error) {
            ProxiedAxios.#logger.error('Error fetching proxies:', error.message);
            throw error;
        }
    }

    setupProxyRefreshTimer() {
        const refreshProxiesWrapper = async () => {
            ProxiedAxios.#logger.log('Refreshing proxies...');
            this.#readyPromise = this.refreshProxies();
            await this.#readyPromise;
            ProxiedAxios.#logger.log('Proxies refreshed.');
        };

        refreshProxiesWrapper();
        setInterval(refreshProxiesWrapper, this.#refreshInterval);
    }

    getRandomProxy() {
        return this.proxies[Math.floor(Math.random() * this.proxies.length)];
    }

    createAxiosInstance(proxy) {
        const { ip, port, username, password } = proxy;
        const proxyUrl = username && password
            ? `socks5://${username}:${password}@${ip}:${port}`
            : `socks5://${ip}:${port}`;
            
        const socksAgent = new SocksProxyAgent(proxyUrl, {
            timeout: this.timeout
        });
        
        return axios.create({
            httpsAgent: socksAgent,
            proxy: false,
            timeout: Math.max(30000, this.timeout)
        });
    }

    setTimeout(timeout) {
        this.timeout = timeout;
        return this;
    }

    async request(config) {
        await this.#readyPromise;

        for (let i = 0; i < this.retries; i++) {
            try {
                const proxy = this.getRandomProxy();
                const axiosInstance = this.createAxiosInstance(proxy);
                return await axiosInstance(config);
            } catch (error) {
                if (i === this.retries - 1) {
                    ProxiedAxios.#logger.error(`Request failed after ${this.retries} retries: ${error.message}`);
                    throw error;
                }
                ProxiedAxios.#logger.log(`Request failed, retrying... (${i + 1}/${this.retries})`);
            }
        }
    }

    async get(url, config = {}) {
        return this.request({ ...config, method: 'get', url });
    }

    async post(url, data, config = {}) {
        return this.request({ ...config, method: 'post', url, data });
    }

    async put(url, data, config = {}) {
        return this.request({ ...config, method: 'put', url, data });
    }

    async delete(url, config = {}) {
        return this.request({ ...config, method: 'delete', url });
    }

    async patch(url, data, config = {}) {
        return this.request({ ...config, method: 'patch', url, data });
    }

    async head(url, config = {}) {
        return this.request({ ...config, method: 'head', url });
    }

    async options(url, config = {}) {
        return this.request({ ...config, method: 'options', url });
    }

    async ready() {
        return this.#readyPromise;
    }

    static async setup() {
        try {
            const configDir = path.join(process.cwd(), ProxiedAxios.#CONFIG_DIR);
            
            await ProxiedAxios.#handleIgnoreFile(
                path.join(process.cwd(), '.gitignore'),
                ProxiedAxios.#CONFIG_ENTRY
            );

            // Handle .npmignore only if it exists
            const npmignorePath = path.join(process.cwd(), '.npmignore');
            try {
                await fs.access(npmignorePath);
                await ProxiedAxios.#handleIgnoreFile(npmignorePath, ProxiedAxios.#CONFIG_ENTRY);
            } catch {
                ProxiedAxios.#logger.log('.npmignore not found, skipping');
            }

            // Create config directory
            await fs.mkdir(configDir, { recursive: true });
            ProxiedAxios.#logger.log(`Created ${ProxiedAxios.#CONFIG_DIR} directory`);
            
            return true;
        } catch (error) {
            ProxiedAxios.#logger.error('Error during setup:', error.message);
            return false;
        }
    }
}