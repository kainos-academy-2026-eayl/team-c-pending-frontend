import { describe, expect, it } from "vitest";
import Product from "../src/schemas/product.schema";

const product = {
    name: "Apple",
    price: 0.5,
    description: "A juicy red apple",
    category: "Fruit",
    quantity: 10,
    image: null,
};

describe("product API boundary", () => {
    it("normalizes the backend productID for catalogue and basket consumers", () => {
        expect(Product.parse({ ...product, productID: 8 })).toEqual({
            ...product,
            id: 8,
        });
    });

    it("preserves the existing frontend shape", () => {
        expect(Product.parse({ ...product, id: 8 })).toEqual({ ...product, id: 8 });
    });

    it("rejects products without an identifier", () => {
        expect(Product.safeParse(product).success).toBe(false);
    });
});
