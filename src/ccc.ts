import {Task} from '@lit/task';
import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';

const reducedPrices: Record<keyof typeof regularPrices, number | null> = {
	AEF: null,
	BBH: 801,
	BDE: 1900,
	BSE: 507,
	BTA: 1125,
	HSE: null,
	INS: null,
	LBH: 1577,
	LDE: 9869,
	LSE: 3086,
	LTA: 3037,
	MCG: 9,
	MHL: null,
	PSL: 1000,
	RBH: null,
	RDE: null,
	RSE: null,
	RTA: null,
	TRU: 170,
} as const;

const regularPrices = {
	AEF: 4200,
	BBH: 2300,
	BDE: 2200,
	BSE: 1450,
	BTA: 1250,
	HSE: 13000,
	INS: 160,
	LBH: 4600,
	LDE: 10000,
	LSE: 9500,
	LTA: 3700,
	MCG: 30,
	MHL: 4600,
	PSL: 4200,
	RBH: 15550,
	RDE: 34000,
	RSE: 25000,
	RTA: 15500,
	TRU: 500,
} as const;

interface Price {
	MaterialTicker: string;
	ExchangeCode: string;
	PriceAverage: number;
	TradedYesterday: number;
}

interface Building {
	Ticker: string;
	AreaCost: number;
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
			planet: {planetid: string}
			infrastructure: {building: string, amount: number}[];
			buildings: {name: string, amount: number}[];
		}
	}
}
interface Planet {
	Surface: boolean;
	Pressure: number;
	Temperature: number;
	Gravity: number;
}

const fmt = new Intl.NumberFormat(undefined, {maximumFractionDigits: 0});

@customElement('ccc-table')
export class CCCTable extends LitElement {
	@property({attribute: false})
	count: Map<keyof typeof regularPrices, number> = new Map();

	private priceTask = new Task(this, {
		task: async (_args, {signal}): Promise<Map<keyof typeof regularPrices, number>> => {
			const prices: Price[] = await (await fetch('https://refined-prun.github.io/refined-prices/all.json', {signal})).json();

			const priceMap = new Map<keyof typeof regularPrices, number>();
			for (const ticker of Object.keys(regularPrices) as Array<keyof typeof regularPrices>) {
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

	protected updated(changedProperties: Map<string, any>) {
		if (!changedProperties.has('count') || !this.count.size)
			return;
		// oxlint-disable-next-line no-useless-spread
		history.pushState({}, '', '#' + [...this.count.entries().map(([k, v]) => `${k}=${v}`)].join('&'));
	}

	private renderTable(priceMap: Map<keyof typeof regularPrices, number>) {
		const reducedTotal = this.count.entries().reduce((acc, [ticker, count]) => acc + (count * (reducedPrices[ticker] ?? regularPrices[ticker])), 0);
		const regularTotal = this.count.entries().reduce((acc, [ticker, count]) => acc + (count * regularPrices[ticker]), 0);
		return html`
		<table>
			<thead>
				<tr>
					<th>material</th>
					<th>CX<br>price</th>
					<th>reduced<br>price</th>
					<th>regular<br>price</th>
					<th>count</th>
					<th>reduced<br>cost</th>
					<th>regular<br>cost</th>
				</tr>
			</thead>
			<tbody>
				${priceMap.entries().map(([ticker, price]) => this.renderRow(ticker, price, this.count.get(ticker)))}
				<tr>
					<td></td>
					<td></td>
					<td></td>
					<td></td>
					<td>total</td>
					<td>${fmt.format(reducedTotal)}</td>
					<td>${fmt.format(regularTotal)}</td>
				</tr>
			</tbody>
		</table>
		`;
	}

	private renderRow(ticker: keyof typeof regularPrices, price: number, count: number | undefined) {
		return html`
		<tr>
			<td>${ticker}</td>
			<td>${fmt.format(price)}</td>
			<td>${reducedPrices[ticker] ? fmt.format(reducedPrices[ticker]) : ''}</td>
			<td>${fmt.format(regularPrices[ticker])}</td>
			<td><input type="number" .value=${count} min="0" @input="${(e: Event) => this.onInputChange(e, ticker)}"></td>
			<td>${count && fmt.format(count * (reducedPrices[ticker] || regularPrices[ticker]))}</td>
			<td>${count && fmt.format(count * regularPrices[ticker])}</td>
		</tr>
		`;
	}

	private onInputChange(e: Event, ticker: keyof typeof reducedPrices) {
		const input = e.target as HTMLInputElement;
		if (input.value === '') {
			this.count.delete(ticker);
			this.requestUpdate('count');
		} else if (!isNaN(input.valueAsNumber)) {
			this.count.set(ticker, input.valueAsNumber);
			this.requestUpdate('count');
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

const cccTable = document.querySelector<CCCTable>('ccc-table')!;
if (document.location.hash.slice(1))
	for (const param of document.location.hash.slice(1).split('&')) {
		const [key, value] = param.split('=');
		cccTable.count.set(key as keyof typeof reducedPrices, Number(value));
	};

let buildings: Map<string, Building> | null = null;
async function fetchBuildings(): Promise<Map<string, Building>> {
	if (buildings) return buildings;
	const rawBuildings = await (await fetch('https://api.prunplanner.org/data/buildings')).json() as Building[];
	buildings = new Map<string, Building>();
	for (const building of rawBuildings)
		buildings.set(building.Ticker, building);
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

	const planetResponse = await fetch('https://api.prunplanner.org/data/planet/' +
		plan.baseplanner.baseplanner_data.planet.planetid);
	const planet: Planet = await planetResponse.json();

	const count = cccTable.count;
	count.clear();
	for (const mat of mats(buildings.get('CM')!, planet))
		if (mat.CommodityTicker in reducedPrices)  {
			const ticker = mat.CommodityTicker as keyof typeof reducedPrices;
			count.set(ticker, mat.Amount);
		}
	for (const building of plan.baseplanner.baseplanner_data.buildings) 
		for (const mat of mats(buildings.get(building.name)!, planet)) 
			if (mat.CommodityTicker in regularPrices) {
				const ticker = mat.CommodityTicker as keyof typeof regularPrices;
				count.set(ticker, (count.get(ticker) ?? 0) + building.amount * mat.Amount);
			}
	for (const infra of plan.baseplanner.baseplanner_data.infrastructure) {
		if (infra.amount === 0) continue;
		for (const mat of mats(buildings.get(infra.building)!, planet))
			if (mat.CommodityTicker in regularPrices) {
				const ticker = mat.CommodityTicker as keyof typeof regularPrices;
				count.set(ticker, (count.get(ticker) ?? 0) + infra.amount * mat.Amount);
			}
	}
	cccTable.requestUpdate('count');
});

function *mats(building: Building, planet: Planet): Iterable<BuildingMat> {
	for (const mat of building.BuildingCosts)
		yield mat;

	if (planet.Surface) // rocky
		yield {CommodityTicker: 'MCG', Amount: building.AreaCost * 4};
	else // gaseous
		yield {CommodityTicker: 'AEF', Amount: Math.ceil(building.AreaCost / 3)};

	// ignore gravity because CCC doesn't have MGC or BL

	if (planet.Pressure > 2)
		yield {CommodityTicker: 'HSE', Amount: 1};
	// ignore low pressure because CCC doesn't have SEA

	// Temperature
	if (planet.Temperature < -25)
		yield {CommodityTicker: 'INS', Amount: building.AreaCost * 10};
	// ignore high temperature because CCC doesn't have TSH
}
