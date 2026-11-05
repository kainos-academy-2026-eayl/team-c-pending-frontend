import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const script = readFileSync(
	new URL("../public/search.js", import.meta.url),
	"utf8",
);

function createBrowser() {
	const listeners: Record<"input" | "submit", () => void> = {
		input: () => {
			throw new Error("Missing input listener");
		},
		submit: () => {
			throw new Error("Missing submit listener");
		},
	};
	const input = {
		value: "apple",
		addEventListener: (_event: string, listener: () => void) => {
			listeners.input = listener;
		},
	};
	const form = {
		action: "http://frontend.example/products",
		addEventListener: (_event: string, listener: () => void) => {
			listeners.submit = listener;
		},
	};
	const status = { textContent: "" };
	const products = { replaceWith: vi.fn() };
	const categories = { replaceWith: vi.fn() };
	const nextProducts = {};
	const nextCategories = {};
	const nextPage = {
		querySelector: vi.fn((selector: string): object | null =>
			selector === ".products-container" ? nextProducts : nextCategories,
		),
	};
	const apiFetch = vi
		.fn<typeof fetch>()
		.mockResolvedValue(new Response("Results"));
	const history = { replaceState: vi.fn() };
	const logger = { error: vi.fn() };
	runInNewContext(script, {
		document: {
			querySelector: (selector: string) => {
				if (selector === ".header-search") return form;
				if (selector === "#product-search") return input;
				if (selector === "#search-status") return status;
				if (selector === ".products-container") return products;
				if (selector === ".categories-container") return categories;
				return null;
			},
		},
		FormData: class {
			[Symbol.iterator]() {
				return new URLSearchParams({ q: input.value, category: "Fruit" })[
					Symbol.iterator
				]();
			}
		},
		DOMParser: class {
			parseFromString() {
				return nextPage;
			}
		},
		URL,
		URLSearchParams,
		AbortController,
		setTimeout,
		clearTimeout,
		fetch: apiFetch,
		history,
		console: logger,
	});
	return {
		listeners,
		input,
		status,
		products,
		categories,
		nextProducts,
		nextCategories,
		nextPage,
		apiFetch,
		history,
		logger,
	};
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("Live product search", () => {
	it("waits until typing stops and preserves the category", async () => {
		const browser = createBrowser();
		browser.listeners.input();
		await vi.advanceTimersByTimeAsync(200);
		browser.input.value = "pear";
		browser.listeners.input();
		await vi.advanceTimersByTimeAsync(249);
		expect(browser.apiFetch).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(browser.apiFetch).toHaveBeenCalledTimes(1);
		expect(String(browser.apiFetch.mock.calls[0]?.[0])).toBe(
			"http://frontend.example/products?q=pear&category=Fruit",
		);
		expect(browser.products.replaceWith).toHaveBeenCalledWith(
			browser.nextProducts,
		);
		expect(browser.categories.replaceWith).toHaveBeenCalledWith(
			browser.nextCategories,
		);
		expect(browser.history.replaceState).toHaveBeenCalled();
		expect(browser.status.textContent).toBe("");
	});

	it("cancels older requests and ignores their late responses", async () => {
		const browser = createBrowser();
		let finishOldRequest = (_response: Response) => {};
		browser.apiFetch.mockReturnValueOnce(
			new Promise((resolve) => {
				finishOldRequest = resolve;
			}),
		);
		browser.listeners.input();
		await vi.advanceTimersByTimeAsync(250);
		expect(browser.status.textContent).toBe("Searching...");
		const oldSignal = browser.apiFetch.mock.calls[0]?.[1]?.signal;
		browser.input.value = "pear";
		browser.listeners.input();
		expect(oldSignal?.aborted).toBe(true);
		await vi.advanceTimersByTimeAsync(250);
		finishOldRequest(new Response("Old results"));
		await vi.advanceTimersByTimeAsync(0);
		expect(browser.products.replaceWith).toHaveBeenCalledTimes(1);
		expect(browser.logger.error).not.toHaveBeenCalled();
	});

	it("searches again when the field is cleared", async () => {
		const browser = createBrowser();
		browser.input.value = "";
		browser.listeners.input();
		await vi.advanceTimersByTimeAsync(250);
		expect(String(browser.apiFetch.mock.calls[0]?.[0])).toBe(
			"http://frontend.example/products?q=&category=Fruit",
		);
	});

	it.each(["http", "network", "missing results"])(
		"keeps the existing products and reports %s errors",
		async (failure) => {
			const browser = createBrowser();
			if (failure === "http")
				browser.apiFetch.mockResolvedValueOnce(
					new Response("Unavailable", { status: 503 }),
				);
			if (failure === "network")
				browser.apiFetch.mockRejectedValueOnce(new Error("Offline"));
			if (failure === "missing results")
				browser.nextPage.querySelector.mockReturnValue(null);
			browser.listeners.input();
			await vi.advanceTimersByTimeAsync(250);
			expect(browser.status.textContent).toBe(
				"Unable to update results. Press Search to try again.",
			);
			expect(browser.logger.error).toHaveBeenCalled();
			expect(browser.products.replaceWith).not.toHaveBeenCalled();
			expect(browser.history.replaceState).not.toHaveBeenCalled();
		},
	);

	it("cancels the timer on normal form submission", async () => {
		const browser = createBrowser();
		browser.listeners.input();
		browser.listeners.submit();
		await vi.advanceTimersByTimeAsync(250);
		expect(browser.apiFetch).not.toHaveBeenCalled();
	});
});
