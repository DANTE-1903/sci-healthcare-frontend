import type { CountryStats, CsvVouchersParams, DailyStats, DueVouchersParams, GovernanceResponse, HealthStatus, ListProvidersParams, ListReceiptsParams, ListVouchersParams, Provider, ProviderHistory, ProviderLocation, ProvidersResponse, Receipt, ReceiptsResponse, ReadyStatus, ServiceCatalogueItem, ServicePriceChangeHistory, ServicesResponse, Stats, VersionInfo, Voucher, VoucherDetail, VouchersResponse } from './types.js';
export declare class ApiError extends Error {
    readonly status: number;
    readonly error: string;
    readonly details?: unknown;
    readonly issues?: unknown;
    constructor(status: number, error: string, message: string, details?: unknown);
}
/**
 * Validates and extracts coordinates a clinic has published, or null.
 */
export declare function providerLocation(p: Provider): ProviderLocation | null;
export interface ClientOptions {
    baseUrl: string;
    fetch?: typeof fetch;
    headers?: Record<string, string>;
}
export declare class Client {
    private readonly baseUrl;
    private readonly fetchImpl;
    private readonly defaultHeaders;
    constructor(options: ClientOptions);
    private request;
    health(): Promise<HealthStatus>;
    version(): Promise<VersionInfo>;
    ready(): Promise<ReadyStatus>;
    stats(): Promise<Stats>;
    dailyStats(days?: number): Promise<DailyStats>;
    providers(params?: ListProvidersParams): Promise<ProvidersResponse>;
    provider(address: string): Promise<Provider>;
    providerHistory(address: string): Promise<ProviderHistory>;
    providerServiceHistory(address: string, code: number): Promise<ServicePriceChangeHistory>;
    countries(): Promise<{
        countries: CountryStats[];
    }>;
    services(): Promise<ServicesResponse>;
    service(code: number): Promise<ServiceCatalogueItem>;
    vouchers(params?: ListVouchersParams): Promise<VouchersResponse>;
    voucher(id: string): Promise<VoucherDetail>;
    vouchersDue(params: DueVouchersParams): Promise<{
        vouchers: Voucher[];
    }>;
    vouchersCsv(params?: CsvVouchersParams): Promise<string>;
    receipts(params: ListReceiptsParams): Promise<ReceiptsResponse>;
    receipt(voucherId: string): Promise<Receipt>;
    governance(): Promise<GovernanceResponse>;
    rawGet<T>(path: string, params?: Record<string, unknown>): Promise<T>;
}
export declare function createClient(options: ClientOptions): Client;
