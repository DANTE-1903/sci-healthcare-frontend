import type {
  CountryStats,
  CsvVouchersParams,
  DailyStats,
  DueVouchersParams,
  GovernanceResponse,
  HealthStatus,
  ListProvidersParams,
  ListReceiptsParams,
  ListVouchersParams,
  Provider,
  ProviderHistory,
  ProviderLocation,
  ProvidersResponse,
  Receipt,
  ReceiptsResponse,
  ReadyStatus,
  ServiceCatalogueItem,
  ServicePriceChangeHistory,
  ServicesResponse,
  Stats,
  VersionInfo,
  Voucher,
  VoucherDetail,
  VouchersResponse,
} from './types.js';

export class ApiError extends Error {
  readonly status: number;
  readonly error: string;
  readonly details?: unknown;
  readonly issues?: unknown;

  constructor(status: number, error: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.error = error;
    this.details = details;
    this.issues = details;
  }
}

/**
 * Validates and extracts coordinates a clinic has published, or null.
 */
export function providerLocation(p: Provider): ProviderLocation | null {
  const raw = p.location ?? p.metadata?.location ?? null;
  if (!raw) return null;
  const { lat, lng } = raw;
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return { lat, lng };
}

export interface ClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

export class Client {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.defaultHeaders = options.headers ?? {};
  }

  private async request<T>(
    path: string,
    params?: Record<string, unknown>,
    init?: RequestInit,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          url.searchParams.set(key, value.join(','));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      accept: 'application/json',
      ...this.defaultHeaders,
      ...(init?.headers as Record<string, string> | undefined),
    };

    let res: Response;
    try {
      res = await this.fetchImpl(url.toString(), {
        ...init,
        headers,
      });
    } catch (cause) {
      throw new ApiError(0, 'network_error', `Cannot reach the API at ${this.baseUrl}: ${cause}`, cause);
    }

    if (!res.ok) {
      let body: { error?: string; message?: string; details?: unknown; issues?: unknown } = {};
      try {
        body = (await res.json()) as {
          error?: string;
          message?: string;
          details?: unknown;
          issues?: unknown;
        };
      } catch {
        // Not a JSON error body
      }
      const errCode = body.error ?? `http_${res.status}`;
      const message = body.message ?? res.statusText ?? 'Request failed';
      const details = body.details ?? body.issues;
      throw new ApiError(res.status, errCode, message, details);
    }

    return (await res.json()) as T;
  }

  async health(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/health');
  }

  async version(): Promise<VersionInfo> {
    return this.request<VersionInfo>('/version');
  }

  async ready(): Promise<ReadyStatus> {
    return this.request<ReadyStatus>('/ready');
  }

  async stats(): Promise<Stats> {
    return this.request<Stats>('/stats');
  }

  async dailyStats(days = 30): Promise<DailyStats> {
    return this.request<DailyStats>('/stats/daily', { days });
  }

  async providers(params?: ListProvidersParams): Promise<ProvidersResponse> {
    return this.request<ProvidersResponse>('/providers', params as Record<string, unknown>);
  }

  async provider(address: string): Promise<Provider> {
    return this.request<Provider>(`/providers/${encodeURIComponent(address)}`);
  }

  async providerHistory(address: string): Promise<ProviderHistory> {
    return this.request<ProviderHistory>(`/providers/${encodeURIComponent(address)}/history`);
  }

  async providerServiceHistory(
    address: string,
    code: number,
  ): Promise<ServicePriceChangeHistory> {
    return this.request<ServicePriceChangeHistory>(
      `/providers/${encodeURIComponent(address)}/services/${code}/history`,
    );
  }

  async countries(): Promise<{ countries: CountryStats[] }> {
    return this.request<{ countries: CountryStats[] }>('/countries');
  }

  async services(): Promise<ServicesResponse> {
    return this.request<ServicesResponse>('/services');
  }

  async service(code: number): Promise<ServiceCatalogueItem> {
    return this.request<ServiceCatalogueItem>(`/services/${code}`);
  }

  async vouchers(params?: ListVouchersParams): Promise<VouchersResponse> {
    return this.request<VouchersResponse>('/vouchers', params as Record<string, unknown>);
  }

  async voucher(id: string): Promise<VoucherDetail> {
    return this.request<VoucherDetail>(`/vouchers/${encodeURIComponent(id)}`);
  }

  async vouchersDue(params: DueVouchersParams): Promise<{ vouchers: Voucher[] }> {
    return this.request<{ vouchers: Voucher[] }>('/vouchers/due', params as Record<string, unknown>);
  }

  async vouchersCsv(params?: CsvVouchersParams): Promise<string> {
    const url = new URL(`${this.baseUrl}/vouchers.csv`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          url.searchParams.set(key, value.join(','));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }
    const res = await this.fetchImpl(url.toString(), {
      headers: { ...this.defaultHeaders },
    });
    if (!res.ok) {
      throw new ApiError(res.status, `http_${res.status}`, `Failed to export CSV: ${res.statusText}`);
    }
    return res.text();
  }

  async receipts(params: ListReceiptsParams): Promise<ReceiptsResponse> {
    return this.request<ReceiptsResponse>('/receipts', params as Record<string, unknown>);
  }

  async receipt(voucherId: string): Promise<Receipt> {
    return this.request<Receipt>(`/receipts/${encodeURIComponent(voucherId)}`);
  }

  async governance(): Promise<GovernanceResponse> {
    return this.request<GovernanceResponse>('/governance');
  }

  async rawGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>(path, params);
  }
}

export function createClient(options: ClientOptions): Client {
  return new Client(options);
}
