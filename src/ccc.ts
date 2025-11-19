import {Task} from "@lit/task";
import {css, html, LitElement} from "lit";
import {customElement, property} from "lit/decorators.js";

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

interface Building {
	Ticker: string;
	BuildingCosts: BuildingMat[];
}

interface BuildingMat {
	CommodityTicker: string;
	Amount: number;
}

interface Plan {
	baseplanner: {
		name: string;
		baseplanner_data: {
			infrastructure: {building: string, amount: number}[];
			buildings: {name: string, amount: number}[];
		}
	}
}

const fmt = new Intl.NumberFormat(undefined, {maximumFractionDigits: 0});

@customElement('ccc-table')
export class CCCTable extends LitElement {
	@property({attribute: false})
	count: Map<keyof typeof reducedPrices, number> = new Map();

	private priceTask = new Task(this, {
		task: async (_args, {signal}): Promise<Map<keyof typeof reducedPrices, number>> => {
			const prices: Price[] = await (await fetch('https://refined-prun.github.io/refined-prices/all.json', {signal})).json();

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
			return priceMap;
		},
	});

	constructor() {
		super();
		this.priceTask.run();
	}

	protected render() {
		return this.priceTask.render({
			pending: () => html`loading...`,
			rejected: (e: Error) => html`error loading prices: ${e.message}`,
			complete: (priceMap) => this.renderTable(priceMap),
		});
	}

	private renderTable(priceMap: Map<keyof typeof reducedPrices, number>) {
		const total = this.count.entries().reduce((acc, [ticker, count]) => acc + (count * reducedPrices[ticker] || 0), 0);
		return html`
		<table>
			<thead>
				<tr>
					<th>material</th>
					<th>regular<br>price</th>
					<th>reduced<br>price</th>
					<th>count</th>
					<th>cost</th>
				</tr>
			</thead>
			<tbody>
				${priceMap.entries().map(([ticker, price]) => this.renderRow(ticker, price, this.count.get(ticker)))}
				<tr>
					<td></td>
					<td></td>
					<td></td>
					<td>total</td>
					<td>${fmt.format(total)}</td>
				</tr>
			</tbody>
		</table>
		`;
	}

	private renderRow(ticker: keyof typeof reducedPrices, price: number, count: number | undefined) {
		return html`
		<tr>
			<td>${ticker}</td>
			<td>${fmt.format(price)}</td>
			<td>${fmt.format(reducedPrices[ticker])}</td>
			<td><input type="number" value="${count}" min="0" @input="${(e: Event) => this.onInputChange(e, ticker)}"></td>
			<td>${count && fmt.format(count * reducedPrices[ticker])}</td>
		</tr>
		`;
	}

	private onInputChange(e: Event, ticker: keyof typeof reducedPrices) {
		const input = e.target as HTMLInputElement;
		const value = parseInt(input.value);
		if (!isNaN(value)) {
			this.count.set(ticker, value);
			this.requestUpdate();
		}
	}

	static styles = css`
		td {
			font-family: monospace;
			text-align: right;
			padding: 0.25em 1em;
		}
		td:first-child {
			text-align: inherit;
			padding-left: 0;
		}
		td:last-child {
			padding-right: 0;
		}

		input {
			background-color: #222;
			color: inherit;
			border: 1px solid #777;
			padding: 0.25em;
			width: 5em;
		}
	`;
}

let buildings: Map<string, BuildingMat[]> | null = null;
async function fetchBuildings(): Promise<Map<string, BuildingMat[]>> {
	if (buildings) return buildings;
	const rawBuildings = await (await fetch('https://api.prunplanner.org/data/buildings')).json() as Building[];
	buildings = new Map<string, BuildingMat[]>();
	for (const building of rawBuildings)
		buildings.set(building.Ticker, building.BuildingCosts);
	return buildings;
}
document.querySelector('input[type="button"]')!.addEventListener('click', async () => {
	const url = new URL(document.querySelector<HTMLInputElement>('input[type="url"]')!.value);
	if (url.hostname !== 'prunplanner.org') {
		alert('invalid prunplan');
		return;
	}
	url.hostname = 'api.prunplanner.org';
	const [planResponse, buildings] = await Promise.all([fetch(url), fetchBuildings()]);
	const plan = await planResponse.json() as Plan;

	const cccTable = document.querySelector<CCCTable>('ccc-table')!;
	const count = cccTable.count;
	count.clear();
	for (const building of plan.baseplanner.baseplanner_data.buildings) 
		for (const mat of buildings.get(building.name)!) 
			if (mat.CommodityTicker in reducedPrices)  {
				const ticker = mat.CommodityTicker as keyof typeof reducedPrices;
				count.set(ticker, (count.get(ticker) ?? 0) + building.amount * mat.Amount);
			}
	for (const infra of plan.baseplanner.baseplanner_data.infrastructure) 
		for (const mat of buildings.get(infra.building)!) 
			if (mat.CommodityTicker in reducedPrices) {
				const ticker = mat.CommodityTicker as keyof typeof reducedPrices;
				count.set(ticker, (count.get(ticker) ?? 0) + infra.amount * mat.Amount);
			}
	cccTable.requestUpdate();
});
