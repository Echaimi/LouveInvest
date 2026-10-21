/** Monetary values are integer euro cents; order limits exclude buyer fees. */
export interface OrderLevel {
  priceCents: number;
  quantity: number;
}

export interface OrderBook {
  buys: OrderLevel[];
  sells: OrderLevel[];
}

/** Rates are basis points: 480 means 4.80%. Both use the execution price. */
export interface FeeSchedule {
  commissionBps: number;
  registrationBps: number;
  sourceUrl: string;
}

export interface AnnualDividend {
  year: number;
  grossPerShareCents: number;
  sourceUrl: string;
}

export interface ScpiConfig {
  id: string;
  name: string;
  sourceUrl: string;
  fees: FeeSchedule;
  dividend: AnnualDividend;
}

export interface Execution {
  priceCents: number;
  date: string | null;
}

export interface HistoricalExecution extends Execution {
  matchedShares: number;
  buyerPriceCents: number | null;
}

/** Timestamps are ISO 8601 with timezone; unavailable source data stays null. */
export interface ScpiSnapshot extends ScpiConfig {
  fetchedAt: string;
  sourceUpdatedAt: string | null;
  lastExecution: Execution | null;
  nextAuctionAt: string | null;
  orderDeadlineAt: string | null;
  orderBook: OrderBook | null;
  history: HistoricalExecution[] | null;
  warnings: string[];
}

export interface HealthResponse {
  status: "ok";
}
