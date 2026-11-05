import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import cache from "../src/cache";
import Product from "../src/schemas/product.schema";

vi.mock("../src/cache", () => ({
	default: vi.fn(async (_name: string, load: () => Promise<Response>) => {
		const response = await load();
		if (!response.ok) throw new Error(`API returned ${response.status}`);
		return response.json();
	}),
}));

const product = {
	productID: 8,
	name: "Desk lamp",
	price: 24.5,
	description: "Adjustable task light",
	category: "Lighting",
	quantity: 3,
	image: "/lamp.png",
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
	vi.mocked(cache).mockImplementation(async (_name, load) => {
		const response = await load();
		if (!response.ok) throw new Error(`API returned ${response.status}`);
		return response.json();
	});
	vi.stubEnv("API_ADDRESS", "http://api.test");
	vi.stubGlobal("fetch", fetchMock);
	fetchMock.mockImplementation(async (input) => {
		const path = new URL(String(input)).pathname;
		if (path === "/products/categories") return Response.json(["Lighting"]);
		if (path === "/products/8") return Response.json(product);
		if (
			path === "/products" ||
			path === "/products/best-sellers" ||
			path === "/products/category"
		) {
			return Response.json([product]);
		}
		return Response.json({ error: "Product not found" }, { status: 404 });
	});
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	fetchMock.mockReset();
});

describe("homepage best sellers", () => {
	it("excludes all carousel links and controls from sequential Tab navigation", async () => {
		const response = await request(createApp()).get("/").expect(200);
		const section = response.text.match(
			/<section class="best-sellers"[\s\S]*?<\/section>/,
		)![0];
		const interactiveElements = section.match(/<(?:a|button)\b[^>]*>/g)!;
		expect(interactiveElements).toHaveLength(4);
		expect(
			interactiveElements.every((element) => element.includes('tabindex="-1"')),
		).toBe(true);
		expect(response.text).toContain('<a href="/products?q="');
	});

	it("renders real rankings with product links, images, prices, and a pause control", async () => {
		const response = await request(createApp()).get("/").expect(200);
		expect(response.text).toContain('id="best-sellers-globe"');
		expect(response.text).toContain('href="/products/8"');
		expect(response.text).toContain('src="/lamp.png"');
		expect(response.text).toContain("£24.50");
		expect(response.text).toContain('aria-pressed="false"');
		expect(response.text).toContain('aria-label="Pause rotation"');
		expect(response.text).toContain('class="carousel-pause-icon"');
		expect(response.text).toContain('class="carousel-play-icon"');
		expect(response.text).not.toContain(">Pause rotation</button>");
		expect(response.text).toContain('src="/products.js"');
		expect(response.text).toContain('href="/products.css"');
		expect(response.text).toContain(
			'id="best-sellers-title">Best sellers</h2>',
		);
		expect(response.text).not.toContain("Discover what's popular");
		expect(response.text).not.toContain('class="globe-help"');
		expect(response.text).toContain('width="56" height="56"');
		expect(fetchMock).toHaveBeenCalledWith(
			"http://api.test/products/best-sellers",
		);
	});

	it("does not fetch or render the carousel on the category catalogue", async () => {
		const response = await request(createApp())
			.get("/products?category=Lighting")
			.expect(200);
		expect(response.text).not.toContain('id="best-sellers-globe"');
		expect(response.text).not.toContain('src="/products.js"');
		expect(fetchMock).toHaveBeenCalledWith(
			"http://api.test/products/category?category=Lighting",
		);
		expect(fetchMock).not.toHaveBeenCalledWith(
			"http://api.test/products/best-sellers",
		);
		expect(response.text).toContain("Desk lamp");
	});

	it("uses catalogue products when there are no best sellers", async () => {
		fetchMock.mockImplementation(async (input) =>
			Response.json(
				String(input).endsWith("best-sellers")
					? []
					: String(input).endsWith("categories")
						? ["Lighting"]
						: [product],
			),
		);
		const response = await request(createApp()).get("/").expect(200);
		expect(response.text).toContain("Best sellers");
		expect(response.text).toContain('id="best-sellers-globe"');
		expect(response.text).toContain('href="/products.css"');
		expect(response.text).toContain('src="/products.js"');
		expect(response.text).toContain("Desk lamp");
	});

	it.each([
		[20, 0],
		[20, 4],
		[20, 12],
		[7, 0],
		[7, 3],
		[0, 0],
	])(
		"selects unique products from a catalogue of %s with %s ranked best sellers",
		async (catalogueCount, rankedCount) => {
			const catalogue = Array.from({ length: catalogueCount }, (_, index) => ({
				...product,
				productID: index + 1,
				name: `Product ${index + 1}`,
			}));
			const ranked = catalogue.slice(0, rankedCount).reverse();
			vi.spyOn(Math, "random").mockReturnValue(0);
			fetchMock.mockImplementation(async (input) => {
				const path = new URL(String(input)).pathname;
				return Response.json(
					path.endsWith("best-sellers")
						? ranked
						: path.endsWith("categories")
							? ["Lighting"]
							: catalogue,
				);
			});
			const response = await request(createApp()).get("/").expect(200);
			const ids = [
				...response.text.matchAll(
					/class="globe-product" tabindex="-1" href="\/products\/(\d+)"/g,
				),
			].map((match) => Number(match[1]));
			expect(ids).toHaveLength(Math.min(12, catalogueCount));
			expect(new Set(ids).size).toBe(ids.length);
			expect(ids.slice(0, rankedCount)).toEqual(
				ranked.map((item) => item.productID),
			);
			expect(
				ids.every((id) => catalogue.some((item) => item.productID === id)),
			).toBe(true);
			if (
				rankedCount < 12 &&
				catalogueCount > rankedCount &&
				catalogueCount > 1
			) {
				expect(ids[rankedCount]).toBe(rankedCount + 2);
			}
			if (catalogueCount === 0) {
				expect(response.text).not.toContain('id="best-sellers-globe"');
				expect(response.text).not.toContain('src="/products.js"');
			}
		},
	);

	it("deduplicates ranked and catalogue products before filling the carousel", async () => {
		fetchMock.mockImplementation(async (input) =>
			Response.json(
				String(input).endsWith("categories")
					? ["Lighting"]
					: [product, product],
			),
		);
		const response = await request(createApp()).get("/").expect(200);
		expect(
			response.text.match(
				/class="globe-product" tabindex="-1" href="\/products\/8"/g,
			),
		).toHaveLength(1);
	});

	it("keeps random selections stable until the ten-minute cache expires", async () => {
		const { default: actualCache } =
			await vi.importActual<typeof import("../src/cache")>("../src/cache");
		vi.mocked(cache).mockImplementation(actualCache);
		const now = vi.spyOn(Date, "now").mockReturnValue(1000);
		const random = vi.spyOn(Math, "random").mockReturnValue(0);
		const catalogue = Array.from({ length: 20 }, (_, index) => ({
			...product,
			productID: index + 1,
		}));
		fetchMock.mockImplementation(async (input) =>
			Response.json(
				String(input).endsWith("best-sellers")
					? []
					: String(input).endsWith("categories")
						? ["Lighting"]
						: catalogue,
			),
		);
		const ids = (html: string) =>
			[
				...html.matchAll(
					/class="globe-product" tabindex="-1" href="\/products\/(\d+)"/g,
				),
			].map((match) => Number(match[1]));
		const first = await request(createApp()).get("/").expect(200);
		random.mockReturnValue(0.999);
		now.mockReturnValue(60999);
		const cached = await request(createApp()).get("/").expect(200);
		expect(ids(cached.text)).toEqual(ids(first.text));
		now.mockReturnValue(61000);
		const refreshed = await request(createApp()).get("/").expect(200);
		expect(ids(refreshed.text)).not.toEqual(ids(first.text));
		expect(ids(refreshed.text)).toHaveLength(12);
	});

	it.each(["http", "network", "invalid"])(
		"reports a %s ranking failure and preserves the catalogue",
		async (failure) => {
			const log = vi.spyOn(console, "error").mockImplementation(() => {});
			const original = fetchMock.getMockImplementation()!;
			fetchMock.mockImplementation(async (input, init) => {
				if (String(input).endsWith("best-sellers")) {
					if (failure === "network") throw new Error("Connection failed");
					return failure === "http"
						? new Response("", { status: 500 })
						: Response.json([{}]);
				}
				return original(input, init);
			});
			const response = await request(createApp()).get("/").expect(200);
			expect(response.text).toContain("Best sellers are unavailable");
			expect(response.text).toContain("Desk lamp");
			expect(response.text).not.toContain('id="best-sellers-globe"');
			expect(response.text).not.toContain('src="/products.js"');
			expect(log).toHaveBeenCalledOnce();
		},
	);

	it("escapes product names and supports missing images", async () => {
		fetchMock.mockImplementation(async (input) =>
			Response.json(
				String(input).endsWith("categories")
					? []
					: [{ ...product, name: '<script>alert("x")</script>', image: null }],
			),
		);
		const response = await request(createApp()).get("/").expect(200);
		expect(response.text).toContain("&lt;script&gt;");
		expect(response.text).not.toContain('<script>alert("x")</script>');
		expect(response.text).toContain(
			'class="globe-image-placeholder" >No image</span>',
		);
	});
});

describe("product details", () => {
	it("loads the selected product and preserves the basket action", async () => {
		const response = await request(createApp()).get("/products/8").expect(200);
		expect(response.text).toContain("Adjustable task light");
		expect(response.text).toContain("£24.50");
		expect(response.text).toContain('action="/basket"');
		expect(response.text).toContain('name="productID" hidden value="8"');
		expect(response.text).toContain('href="/products/8/add_review?rating=1"');
		expect(response.text).toContain('aria-label="No reviews yet"');
		expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
			"http://api.test/products/8",
		);
	});

	it("renders a real 404 for a missing product", async () => {
		const response = await request(createApp())
			.get("/products/999")
			.expect(404);
		expect(response.text).toContain("Product not found");
	});

	it.each(["0", "-1", "invalid", "1.5"])(
		"rejects invalid ID %s",
		async (id) => {
			await request(createApp()).get(`/products/${id}`).expect(400);
			expect(fetchMock).not.toHaveBeenCalled();
		},
	);

	it("does not turn a backend failure into a missing-product page", async () => {
		fetchMock.mockResolvedValue(new Response("", { status: 503 }));
		await request(createApp()).get("/products/8").expect(500);
	});

	it("does not offer an out-of-stock product for purchase", async () => {
		fetchMock.mockResolvedValue(Response.json({ ...product, quantity: 0 }));
		const response = await request(createApp()).get("/products/8").expect(200);
		expect(response.text).toContain("Out of stock");
		expect(response.text).toMatch(
			/<button[^>]*disabled[^>]*>Out of stock<\/button>/,
		);
	});

	it("renders reviews and their average rating", async () => {
		fetchMock.mockResolvedValue(
			Response.json({
				...product,
				reviews: [
					{
						rating: 5,
						comment: "Excellent",
						customer: {
							customerID: 1,
							firstName: "Test",
							lastName: "Customer",
						},
					},
					{
						rating: 3,
						customer: {
							customerID: 2,
							firstName: "Another",
							lastName: "Customer",
						},
					},
				],
			}),
		);
		const response = await request(createApp()).get("/products/8").expect(200);
		expect(response.text).toContain("Average rating: 4 out of 5 (2 reviews)");
		expect(response.text).toContain("Excellent");
		expect(response.text).toContain("Test Customer");
	});

	it.each(["add_review", "add_review_message"])(
		"requires login for %s",
		async (route) => {
			await request(createApp())
				.get(`/products/8/${route}`)
				.expect(302)
				.expect("Location", "/login");
			expect(fetchMock).not.toHaveBeenCalled();
		},
	);
});

describe("product API compatibility", () => {
	it("normalizes the backend fields without breaking the existing product shape", () => {
		const normalized = Product.parse(product);
		expect(normalized).toMatchObject({ id: 8, quantity: 3 });
		expect(Product.parse(normalized)).toEqual(normalized);
	});

	class Element {
		hidden = false;
		inert = false;
		textContent = "";
		clientWidth = 760;
		dataset: Record<string, string> = {};
		attributes: Record<string, string> = {};
		classes = new Set<string>();
		listeners = new Map<string, () => void>();
		style: Record<string, string | ((name: string) => void)> = {
			removeProperty: (name: string) => {
				delete this.style[name === "z-index" ? "zIndex" : name];
			},
		};
		classList = {
			toggle: (name: string, enabled: boolean) => {
				if (enabled) this.classes.add(name);
				else this.classes.delete(name);
			},
		};
		addEventListener(name: string, callback: () => void) {
			this.listeners.set(name, callback);
		}
		setAttribute(name: string, value: string) {
			this.attributes[name] = value;
		}
		dispatch(name: string) {
			this.listeners.get(name)?.();
		}
	}

	function setup(count = 12, reducedMotion = false, width = 760) {
		vi.useFakeTimers();
		const items = Array.from({ length: count }, () => new Element());
		const globe = new Element();
		globe.clientWidth = width;
		const toggle = new Element();
		const navigation = new Element();
		const previous = new Element();
		previous.dataset.carouselStep = "-1";
		const next = new Element();
		next.dataset.carouselStep = "1";
		const motion = Object.assign(new Element(), { matches: reducedMotion });
		const document = Object.assign(new Element(), {
			querySelector: (selector: string) =>
				({
					".product-globe": globe,
					".globe-toggle": toggle,
					".globe-navigation": navigation,
				})[selector],
			querySelectorAll: () => [previous, next],
		});
		const window = Object.assign(new Element(), { matchMedia: () => motion });
		Object.assign(globe, {
			querySelectorAll: (selector: string) =>
				selector === ".globe-item" ? items : [],
		});
		runInNewContext(
			readFileSync(new URL("../public/products.js", import.meta.url), "utf8"),
			{
				document,
				window,
				setTimeout,
				clearTimeout,
			},
		);
		return {
			items,
			globe,
			toggle,
			navigation,
			previous,
			next,
			motion,
			document,
			window,
		};
	}

	describe("horizontal best-seller carousel", () => {
		it("keeps products in one line and advances exactly one item every three seconds", () => {
			const { items } = setup();
			const initial = items.map((item) => item.style.transform);
			expect(
				items.every((item) =>
					String(item.style.transform).includes("translateX("),
				),
			).toBe(true);
			expect(items[0]!.style.transform).toContain("translateX(0px) scale(1)");
			vi.advanceTimersByTime(2999);
			expect(items.map((item) => item.style.transform)).toEqual(initial);
			vi.advanceTimersByTime(1);
			expect(items[1]!.style.transform).toContain("translateX(0px) scale(1)");
			vi.advanceTimersByTime(33000);
			expect(items.map((item) => item.style.transform)).toEqual(initial);
		});

		it("pauses on hover without changing product sizes or positions", () => {
			const { items } = setup();
			const initial = items.map((item) => item.style.transform);
			items[1]!.dispatch("pointerenter");
			expect(items.map((item) => item.style.transform)).toEqual(initial);
			const paused = items.map((item) => item.style.transform);
			vi.advanceTimersByTime(9000);
			expect(items.map((item) => item.style.transform)).toEqual(paused);
			items[1]!.dispatch("pointerleave");
			vi.advanceTimersByTime(3000);
			expect(items[1]!.style.transform).toContain("translateX(0px) scale(1)");
		});

		it("moves outgoing products beyond the edge before hiding them", () => {
			const { items } = setup();
			const outgoing = items[10]!;
			expect(outgoing.style.visibility).toBe("visible");
			vi.advanceTimersByTime(3000);
			expect(outgoing.style.transform).toContain("translateX(-516px)");
			expect(outgoing.style.transitionDelay).toBe("0s, 600ms");
			expect(outgoing.style.opacity).toBeUndefined();
			expect(outgoing.inert).toBe(true);
			expect(items[3]!.style.visibility).toBe("visible");
			expect(items[3]!.style.transitionDelay).toBe("0s, 0s");
		});

		it.each([307, 343, 652, 760])(
			"preserves the layout when hovering any visible item at width %s",
			(width) => {
				const { items } = setup(12, false, width);
				const visible = items.filter((item) => !item.inert);
				const bounds = visible
					.map((item) => {
						const transform = String(item.style.transform);
						const x = Number(
							transform.match(/translateX\(([-+\de.]+)px\)/)![1],
						);
						const scale = Number(transform.match(/scale\(([\d.]+)\)/)![1]);
						return { left: x - 68 * scale, right: x + 68 * scale };
					})
					.sort((a, b) => a.left - b.left);
				bounds.forEach((entry, index) => {
					expect(entry.left).toBeGreaterThanOrEqual(-width / 2);
					expect(entry.right).toBeLessThanOrEqual(width / 2);
					if (index > 0)
						expect(entry.left).toBeGreaterThan(bounds[index - 1]!.right);
				});
				const initial = items.map((item) => item.style.transform);
				for (const selected of visible) {
					selected.dispatch("pointerenter");
					expect(items.filter((item) => !item.inert)).toEqual(visible);
					expect(items.map((item) => item.style.transform)).toEqual(initial);
					selected.dispatch("pointerleave");
					expect(items.map((item) => item.style.transform)).toEqual(initial);
				}
			},
		);

		it("pauses on keyboard focus, and preserves an explicit pause after focus leaves", () => {
			const { items, toggle } = setup();
			items[0]!.dispatch("focusin");
			vi.advanceTimersByTime(6000);
			expect(items[0]!.style.transform).toContain("translateX(0px) scale(1)");
			toggle.dispatch("click");
			items[0]!.dispatch("focusout");
			vi.advanceTimersByTime(6000);
			expect(items[0]!.style.transform).toContain("translateX(0px) scale(1)");
			expect(toggle.attributes["aria-pressed"]).toBe("true");
			expect(toggle.attributes["aria-label"]).toBe("Resume rotation");
			expect(toggle.attributes.title).toBe("Resume rotation");
			expect(toggle.textContent).toBe("");
			toggle.dispatch("click");
			expect(toggle.attributes["aria-label"]).toBe("Pause rotation");
			vi.advanceTimersByTime(3000);
			expect(items[1]!.style.transform).toContain("translateX(0px) scale(1)");
		});

		it("supports manual navigation and loops backwards from the first product", () => {
			const { items, next, previous } = setup();
			previous.dispatch("click");
			expect(items[11]!.style.transform).toContain("translateX(0px) scale(1)");
			next.dispatch("click");
			expect(items[0]!.style.transform).toContain("translateX(0px) scale(1)");
		});

		it("shows three products on mobile and removes hidden products from keyboard interaction", () => {
			const { items } = setup(12, false, 343);
			expect(items.filter((item) => !item.inert)).toHaveLength(3);
			expect(items[2]!.style.visibility).toBe("hidden");
		});

		it.each([
			[12, true],
			[1, false],
		])(
			"uses a static accessible list for count %s and reduced motion %s",
			(count, reduced) => {
				const { items, globe, toggle, navigation } = setup(count, reduced);
				expect(globe.classes.has("is-animated")).toBe(false);
				expect(toggle.hidden).toBe(true);
				expect(navigation.hidden).toBe(true);
				expect(
					items.every((item) => !item.inert && !item.style.transform),
				).toBe(true);
				expect(vi.getTimerCount()).toBe(0);
			},
		);

		it("resets transforms and restores all products if reduced motion changes at runtime", () => {
			const { items, motion } = setup();
			motion.matches = true;
			motion.dispatch("change");
			expect(items.every((item) => !item.inert && !item.style.transform)).toBe(
				true,
			);
			expect(vi.getTimerCount()).toBe(0);
		});
	});
});
