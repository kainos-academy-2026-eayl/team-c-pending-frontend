import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";

const products = [
    { productID: 1, name: "Pear", description: "A green pear", category: "Fruit", price: 1, quantity: 3, image: null },
    { productID: 2, name: "Apple", description: "A crisp apple", category: "Fruit", price: 2, quantity: 4, image: null },
    { productID: 3, name: "Bread", description: "Apple sourdough", category: "Bakery", price: 3, quantity: 2, image: null },
];
const apiFetch = vi.fn<typeof fetch>();

beforeEach(() => {
    vi.stubEnv("API_ADDRESS", "http://api.example");
    vi.stubGlobal("fetch", apiFetch);
    apiFetch.mockImplementation(async (input) => {
        const url = new URL(String(input));
        if (url.pathname === "/products/categories") return Response.json(["Fruit", "Bakery", "Fruit & veg"]);
        if (url.pathname === "/products/category") {
            return Response.json(products.filter(product => product.category === url.searchParams.get("category")));
        }
        if (url.pathname === "/products") return Response.json(products);
        throw new Error(`Unexpected API request: ${url.pathname}`);
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetAllMocks();
});

describe("Product search", () => {
    it.each([
        ["", ["Apple", "Bread", "Pear"]],
        ["?q=apple", ["Apple", "Bread"]],
        ["?q=%20%20APPLE%20%20", ["Apple", "Bread"]],
        ["?q=green", ["Pear"]],
        ["?q=unknown", []],
        ["?q=%20%20", ["Apple", "Bread", "Pear"]],
        ["?q=apple&category=Fruit", ["Apple"]],
        ["?q=&category=Fruit", ["Apple", "Pear"]],
    ])("filters and sorts products with %s", async (query, expectedNames) => {
        const response = await request(createApp()).get(`/products${query}`).expect(200);
        const names = [...response.text.matchAll(/data-test-id="product-name">([^<]+)<\/h2>/g)]
            .map(match => match[1]);
        expect(names).toEqual(expectedNames);
        expect(response.text.includes("No products match your search.")).toBe(expectedNames.length === 0);
    });

    it("renders an accessible search form and retains the search and category", async () => {
        const response = await request(createApp()).get("/products?q=%20apple%20&category=Fruit").expect(200);
        expect(response.text).toContain('action="/products" method="get" class="header-search" role="search"');
        expect(response.text).toContain('for="product-search"');
        expect(response.text).toContain('value="apple"');
        expect(response.text).toContain('type="hidden" name="category" value="Fruit"');
        expect(response.text).toContain('href="/products?q=apple"');
        expect(response.text).toContain('href="/products?category=Bakery&amp;q=apple"');
        expect(response.text).toContain('href="/products?category=Fruit%20%26%20veg&amp;q=apple"');
        expect(apiFetch).toHaveBeenCalledWith("http://api.example/products/category?category=Fruit");
    });

    it("escapes search text and encodes it in category links", async () => {
        const response = await request(createApp())
            .get("/products").query({ q: '<script>alert("x")</script>&' }).expect(200);
        expect(response.text).not.toContain('<script>alert("x")</script>');
        expect(response.text).toContain("&lt;script&gt;");
        expect(response.text).toContain("q=%3Cscript%3Ealert(%22x%22)%3C%2Fscript%3E%26");
    });

    it.each(["?q=apple&q=pear", "?category=Fruit&category=Bakery"])(
        "rejects invalid query parameters: %s", async (query) => {
            const response = await request(createApp()).get(`/products${query}`).expect(400);
            expect(response.text).toBe("Invalid search or category");
            expect(apiFetch).not.toHaveBeenCalled();
        },
    );

    it("surfaces API errors instead of showing an empty search result", async () => {
        apiFetch.mockResolvedValueOnce(Response.json({ error: "Unavailable" }, { status: 503 }));
        const response = await request(createApp()).get("/products?q=apple").expect(503);
        expect(response.text).toBe("Unable to load products");
    });

    it("includes the shared search on other pages", async () => {
        const response = await request(createApp()).get("/login").expect(200);
        expect(response.text).toContain('class="header-search" role="search"');
        expect(response.text).not.toContain('type="hidden" name="category"');
        expect(response.text).not.toContain('src="/search.js"');
    });

    it("loads the live search script on the products page", async () => {
        const response = await request(createApp()).get("/products").expect(200);
        expect(response.text).toContain('<script src="/search.js" defer></script>');
        expect(response.text).toContain('id="search-status" role="status" aria-live="polite"');
        const script = await request(createApp()).get("/search.js").expect(200);
        expect(script.text).toContain('searchInput.addEventListener("input"');
    });
});
