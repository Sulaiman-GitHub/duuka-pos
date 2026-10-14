"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_CURRENCY, moneyFor } from "@/lib/money";

const Ctx = createContext<string>(DEFAULT_CURRENCY);

export function CurrencyProvider({ currency, children }: { currency: string; children: React.ReactNode }) {
  return <Ctx.Provider value={currency}>{children}</Ctx.Provider>;
}

export const useCurrency = () => useContext(Ctx);
/** Formatter for the signed-in shop's currency, for client components. */
export function useMoney() {
  const c = useCurrency();
  return useMemo(() => moneyFor(c), [c]);
}
