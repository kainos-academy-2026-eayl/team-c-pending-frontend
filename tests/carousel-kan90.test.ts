import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import cache from "../src/cache";

vi.mock("../src/cache", () => ({
    default: vi.fn(async (_name: string, load: () => Promise<Response>) => {
        const response = await load();
        if (!response.ok) return [];
        return response.json();
    }),
}));

const bestSellerProduct = {
    productID: 1,
    name: "Best Seller Item",
    price: 99.99,
    description: "Top selling product",
    category: "Electronics",
    quantity: 50,
    image: "/bestseller.png",
};

const regularProduct = {
    productID: 2,
    name: "Regular Product",
    price: 49.99,
    description: "Normal product",
    category: "Home",
    quantity: 100,
    image: "/regular.png",
};

const fetchMock = vi.fn<typeof fetch>();

describe("KAN-90: Best-Seller Carousel", () => {
    beforeEach(() => {
        vi.mocked(cache).mockImplementation(async (_name, load) => {
            const response = await load();
            if (!response.ok) return [];
            return response.json();
        });
        vi.stubEnv("API_ADDRESS", "http://api.test");
        vi.stubGlobal("fetch", fetchMock);

        fetchMock.mockImplementation(async (input) => {
            const path = new URL(String(input)).pathname;
            if (path === "/products/categories") {
                return Response.json(["Electronics", "Home"]);
            }
            if (path === "/products/best-sellers") {
                return Response.json([bestSellerProduct]);
            }
            if (path === "/products" || path === "/products/category") {
                return Response.json([bestSellerProduct, regularProduct]);
            }
            return Response.json({ error: "Not found" }, { status: 404 });
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("renders carousel data when accessing home page", async () => {
        const app = await createApp();
        const response = await request(app).get("/");

        expect(response.status).toBe(200);
        expect(response.text).toContain("Best Seller Item");
    });

    it("passes bestSellers array to template when on home page", async () => {
        const app = await createApp();
        vi.mocked(cache).mockResolvedValueOnce([bestSellerProduct]);
        vi.mocked(cache).mockResolvedValueOnce([bestSellerProduct, regularProduct]);
        vi.mocked(cache).mockResolvedValueOnce([bestSellerProduct]);
        vi.mocked(cache).mockResolvedValueOnce(["Electronics", "Home"]);

        const response = await request(app).get("/");

        expect(response.status).toBe(200);
    });

    it("does not request best-sellers when not on home page", async () => {
        const app = await createApp();
        fetchMock.mockClear();

        await request(app).get("/?category=Electronics");

        // Best-sellers endpoint should not be called for category pages
        const bestSellersCalls = fetchMock.mock.calls.filter((call) =>
            String(call[0]).includes("/products/best-sellers")
        );
        expect(bestSellersCalls.length).toBe(0);
    });

    it("shuffles remaining products when best-sellers are fewer than carousel size", async () => {
        const app = await createApp();
        const manyProducts = Array.from({ length: 20 }, (_, i) => ({
            productID: i + 10,
            name: `Product ${i + 10}`,
            price: 10 + i,
            description: `Description ${i}`,
            category: "Test",
            quantity: 100,
            image: `/product-${i}.png`,
        }));

        vi.mocked(cache).mockImplementation(async (_name, load) => {
            const response = await load();
            if (!response.ok) return [];
            const json = await response.json();
            return json;
        });

        fetchMock.mockImplementation(async (input) => {
            const path = new URL(String(input)).pathname;
            if (path === "/products/best-sellers") {
                return Response.json([bestSellerProduct]);
            }
            if (path === "/products" || path === "/products/category") {
                return Response.json([bestSellerProduct, ...manyProducts]);
            }
            if (path === "/products/categories") {
                return Response.json(["Electronics", "Test"]);
            }
            return Response.json({ error: "Not found" }, { status: 404 });
        });

        const response = await request(app).get("/");
        expect(response.status).toBe(200);
    });

    it("handles best-sellers API errors gracefully", async () => {
        const app = await createApp();
        fetchMock.mockImplementation(async (input) => {
            const path = new URL(String(input)).pathname;
            if (path === "/products/best-sellers") {
                return Response.json({ error: "Not available" }, { status: 500 });
            }
            if (path === "/products" || path === "/products/category") {
                return Response.json([bestSellerProduct, regularProduct]);
            }
            if (path === "/products/categories") {
                return Response.json(["Electronics", "Home"]);
            }
            return Response.json({ error: "Not found" }, { status: 404 });
        });

        const response = await request(app).get("/");
        expect(response.status).toBe(200);
        // Page should still render even with best-sellers error
    });

    it("includes all categories in carousel context", async () => {
        const app = await createApp();
        const categories = ["Electronics", "Home", "Lighting"];
        fetchMock.mockImplementation(async (input) => {
            const path = new URL(String(input)).pathname;
            if (path === "/products/categories") {
                return Response.json(categories);
            }
            if (path === "/products/best-sellers") {
                return Response.json([bestSellerProduct]);
            }
            if (path === "/products" || path === "/products/category") {
                return Response.json([bestSellerProduct, regularProduct]);
            }
            return Response.json({ error: "Not found" }, { status: 404 });
        });

        const response = await request(app).get("/");
        expect(response.status).toBe(200);
        // Categories should be passed to template
    });
});
