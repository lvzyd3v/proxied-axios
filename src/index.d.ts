import { AxiosRequestConfig, AxiosResponse } from 'axios';

interface ProxyConfig {
    ip: string;
    port: string;
    username?: string;
    password?: string;
}

interface ProxiedAxiosOptions {
    proxies?: ProxyConfig[];
    retries?: number;
    proxyUrl?: string | null;
    refreshInterval?: number;
}

declare class ProxiedAxios {
    private static #instance: ProxiedAxios;
    private proxies: ProxyConfig[];
    private #proxyUrl: string | null;
    private #refreshInterval: number;
    private #readyPromise: Promise<void>;
    private #configDir: string;
    private timeout: number;

    constructor(options?: ProxiedAxiosOptions);

    static getInstance(): Promise<ProxiedAxios>;
    static loadProxiesFromFile(filePath: string, options?: ProxiedAxiosOptions): Promise<ProxiedAxios>;
    static setup(): Promise<boolean>;
    static enableLogging(): void;
    static disableLogging(): void;

    private refreshProxies(): Promise<void>;
    private fetchAndSaveProxies(proxyFilePath: string): Promise<void>;
    private setupProxyRefreshTimer(): void;
    private getRandomProxy(): ProxyConfig;
    private createAxiosInstance(proxy: ProxyConfig): any;

    setTimeout(timeout: number): this;
    request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    head<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    options<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    ready(): Promise<void>;
}

export default ProxiedAxios;
