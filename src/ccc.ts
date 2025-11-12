const reducedPrices = {
	BSE: 507,
	BBH: 801,
	BDE: 1900,
	BTA: 1125,
	LSE: 3086,
	LBH: 1577,
	LDE: 9869,
	LTA: 3037,
	MCG: 9,
	TRU: 170,
	PSL: 1000,
	INS: 125,
} as const;

interface Price {
	MaterialTicker: string;
	ExchangeCode: string;
	PriceAverage: number;
	TradedYesterday: number;
}

async function fetchPrices(): Promise<Price[]> {
	return await (await fetch('https://refined-prun.github.io/refined-prices/all.json')).json();
}

function renderPrices(prices: Price[]) {
	const priceMap = new Map<keyof typeof reducedPrices, number>();
	for (const ticker of Object.keys(reducedPrices) as Array<keyof typeof reducedPrices>) {
		let total = 0;
		let traded = 0;
		for (const price of prices)
			if (price.MaterialTicker === ticker && price.ExchangeCode.endsWith('1')) {
				total += price.PriceAverage * price.TradedYesterday;
				traded += price.TradedYesterday;
			}
		priceMap.set(ticker, total / traded);
	}

	const fmt = new Intl.NumberFormat(undefined, {maximumFractionDigits: 0});
	const tbody = document.querySelector('tbody') as HTMLTableSectionElement;
	for (const [ticker, price] of priceMap) {
		const row = document.createElement('tr');
		row.innerHTML = `
			<td>${ticker}</td>
			<td>${fmt.format(price)}</td>
			<td>${fmt.format(reducedPrices[ticker])}</td>
		`;
		tbody.appendChild(row);
	}
}

fetchPrices().then(renderPrices);
