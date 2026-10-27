export interface PreparedMediaRequest {
  readonly provider: "fal" | "worldlabs" | "pedra";
  readonly method: "POST" | "GET" | "PUT";
  readonly origin: string;
  readonly path: string;
  readonly body?: Readonly<Record<string, unknown>>;
  readonly credentialRequired: true;
  readonly enabled: false;
  readonly externalBudgetMicroUsd: 0;
  readonly requiresIndependentReview: true;
}
export interface DisabledProviderOperations {
  readonly enabled: false;
  submit(...input: unknown[]): Promise<never>;
  getStatus(...input: unknown[]): Promise<never>;
  getResult(...input: unknown[]): Promise<never>;
  cancel(...input: unknown[]): Promise<never>;
  estimateQuote(): {
    readonly approvedSpendMicroUsd: 0;
    readonly providerPriceMicroUsd: null;
    readonly status: "PRICE_AND_EXTERNAL_APPROVAL_REQUIRED";
  };
}
export type ProviderCandidate = {
  readonly url: string;
  readonly mime: "video/mp4";
  readonly declaredBytes: number | null;
  readonly verifiedBytes: false;
  readonly state: "QA_HOLD";
  readonly directCustomerDownloadAllowed: false;
};
