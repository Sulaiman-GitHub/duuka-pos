// All amounts are whole Uganda Shillings stored as integers.
const fmt = new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 });

export const formatUGX = (n: number) => `UGX ${fmt.format(n)}`;
export const formatNumber = (n: number) => fmt.format(n);
