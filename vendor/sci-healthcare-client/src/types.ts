/**
 * Typed models representing the SCI Healthcare API schemas and read model.
 * These types match the backend's OpenAPI contract and serve as the single source
 * of truth for consumers (including the frontend and external tools).
 */

export type Service = {
  code: number;
  label: string;
  price: string;
  priceDisplay: string;
  active?: boolean;
};

export type ProviderLocation = {
  lat: number;
  lng: number;
};

export type Provider = {
  address: string;
  name: string;
  country: string;
  status: 'Pending' | 'Active' | 'Suspended';
  registeredAt: string | Date;
  services: Service[];
  location?: ProviderLocation | null;
  metadata?: { location?: ProviderLocation | null } | null;
};

export type ServicePriceChange = {
  price: string;
  priceDisplay: string;
  ledger: number;
  changedAt: string | Date;
};

export type ServicePriceChangeHistory = {
  providerAddress: string;
  code: number;
  history: ServicePriceChange[];
};

export type ProviderHistoryItem = {
  status: string;
  name: string;
  country: string;
  ledger: number;
  recordedAt: string | Date;
};

export type ProviderHistory = {
  address: string;
  history: ProviderHistoryItem[];
};

export type CountryStats = {
  code: string;
  clinicCount: number;
};

export type ServiceCatalogueItem = {
  code: number;
  labels: string[];
  clinicCount: number;
  minPrice: string;
  maxPrice: string;
  medianPrice: string;
  minPriceDisplay: string;
  maxPriceDisplay: string;
  medianPriceDisplay: string;
  providers?: {
    address: string;
    name: string;
    country: string;
    price: string;
    priceDisplay: string;
  }[];
};

export type VoucherStatus =
  | 'Funded'
  | 'Claimed'
  | 'Attested'
  | 'Settled'
  | 'Disputed'
  | 'Refunded';

export type Voucher = {
  id: string;
  funder: string;
  beneficiaryRef: string;
  provider: {
    address: string;
    name: string;
    country: string;
  };
  serviceCode: number;
  serviceLabel?: string | null;
  amount: string;
  amountDisplay: string;
  status: VoucherStatus;
  createdAt: string | Date;
  expiresAt: string | Date;
  claimedAt: string | Date | null;
  attestedAt: string | Date | null;
  disputeDeadline: string | Date | null;
  disputeReason?: number | null;
  settledNet: string | null;
  settledFee: string | null;
  refundableAt?: string | Date | null;
  isSettleable: boolean;
  isRefundable: boolean;
};

export type VoucherDetail = Voucher & {
  receipt?: Receipt | null;
};

export type Receipt = {
  voucherId: string;
  providerAddress: string;
  providerName?: string | null;
  providerCountry?: string | null;
  serviceCode: number;
  serviceLabel?: string | null;
  amount: string;
  amountDisplay: string;
  settledAt: string | Date;
  beneficiaryRef?: string;
};

export type Stats = {
  providers: number;
  activeProviders: number;
  vouchers: number;
  settledVouchers: number;
  settledValue: string;
  settledValueDisplay?: string;
  receipts: number;
  faucetDrips?: number;
  faucetWallets?: number;
};

export type DailyBucket = {
  count: number;
  amount: string;
};

export type DailyRow = {
  date: string;
  funded: DailyBucket;
  settled: DailyBucket;
  refunded: DailyBucket;
};

export type DailyStats = {
  days: number;
  from: string;
  to: string;
  series: DailyRow[];
};

export type Attester = {
  address: string;
  active: boolean;
  addedAt: string;
  removedAt?: string | null;
  attestations: number;
  name?: string | null;
  organisation?: string | null;
};

export type GovernanceHistoryEvent = {
  type: 'Proposed' | 'Accepted' | string;
  admin: string;
  pendingAdmin: string | null;
  ledger: number;
  occurredAt: string | Date;
};

export type GovernanceContract = {
  contract: string;
  contractId: string | null;
  currentAdmin: string | null;
  pendingAdmin: string | null;
  history: GovernanceHistoryEvent[];
};

export type GovernanceResponse = {
  contracts: GovernanceContract[];
};

export type HealthStatus = {
  status: string;
};

export type VersionInfo = {
  version: string;
  commit: string | null;
  network: string;
  rpcUrl: string;
  rpcUrls: string[];
  contracts: {
    registry: string;
    voucher: string;
    receipt: string;
    usdc: string | null;
    faucet: string | null;
  };
  indexerStartLedger: number;
  startedAt: string;
  uptimeSeconds: number;
};

export type ReadyStatus = {
  status: 'ready' | 'degraded';
  checks: {
    database: boolean;
    network?: string;
    contracts?: Record<string, string>;
    indexedLedger?: number;
    lagLedgers?: number;
    gapDetected?: boolean;
    [key: string]: unknown;
  };
};

export type ApiErrorDetail = {
  code?: string;
  message?: string;
  path?: (string | number)[];
  expected?: string;
  received?: string;
  [key: string]: unknown;
};

export type ListProvidersParams = {
  status?: 'Pending' | 'Active' | 'Suspended';
  country?: string;
  q?: string;
  cursor?: string;
  limit?: number;
  offset?: number;
};

export type ProvidersResponse = {
  total: number;
  providers: Provider[];
  nextCursor?: string | null;
  limit?: number;
};

export type ListVouchersParams = {
  funder?: string;
  provider?: string;
  beneficiaryRef?: string;
  status?: VoucherStatus[] | string;
  createdFrom?: string;
  createdTo?: string;
  minAmount?: string;
  maxAmount?: string;
  sort?: 'createdAt' | 'expiresAt' | 'amount';
  order?: 'asc' | 'desc';
  cursor?: string;
  limit?: number;
  offset?: number;
};

export type VouchersResponse = {
  total?: number;
  vouchers: Voucher[];
  nextCursor?: string | null;
  limit?: number;
};

export type DueVouchersParams = {
  within: string;
  funder?: string;
  provider?: string;
};

export type CsvVouchersParams = {
  funder?: string;
  provider?: string;
  beneficiaryRef?: string;
  status?: VoucherStatus[] | string;
};

export type ListReceiptsParams = {
  beneficiaryRef?: string;
  provider?: string;
  cursor?: string;
  limit?: number;
  offset?: number;
};

export type ReceiptsResponse = {
  total: number;
  totalSpend?: string;
  totalSpendDisplay?: string;
  receipts: Receipt[];
  nextCursor?: string | null;
  limit?: number;
};

export type ServicesResponse = {
  total: number;
  services: ServiceCatalogueItem[];
};
