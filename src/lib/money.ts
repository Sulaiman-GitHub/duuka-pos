// All amounts are whole units of the shop's currency, stored as integers (no decimals), so only currencies that are
// normally priced in whole units are offered.
export const CURRENCIES = { UGX: "Uganda Shilling", KES: "Kenya Shilling", TZS: "Tanzania Shilling", RWF: "Rwanda Franc" } as const;
export type Currency = keyof typeof CURRENCIES;
export const DEFAULT_CURRENCY: Currency = "UGX";
export const isCurrency = (c: string): c is Currency => c in CURRENCIES;

const fmt = new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 });

export const formatNumber = (n: number) => fmt.format(n);
export const formatMoney = (n: number, currency: string = DEFAULT_CURRENCY) => `${currency} ${fmt.format(Math.round(n))}`;
/** A formatter bound to one currency: `const money = moneyFor(user.currency); money(1500)` */
export const moneyFor = (currency: string) => (n: number) => formatMoney(n, currency);
