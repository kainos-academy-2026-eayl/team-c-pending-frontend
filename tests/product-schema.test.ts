import { describe, expect, it } from "vitest";
import Product, { ProductWithReviews } from "../src/schemas/product.schema";

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
			productID: 8,
			id: 8,
		});
	});

	it("preserves the existing frontend shape", () => {
		expect(Product.parse({ ...product, id: 8 })).toEqual({
			...product,
			productID: 8,
			id: 8,
		});
	});

	it("rejects products without an identifier", () => {
		expect(Product.safeParse(product).success).toBe(false);
		expect(ProductWithReviews.safeParse(product).success).toBe(false);
	});

	it("normalizes identifiers on products with reviews", () => {
		const reviews = [
			{
				rating: 4,
				comment: "Great",
				customer: { customerID: 1, firstName: "Test", lastName: "Customer" },
			},
		];
		const parsed = ProductWithReviews.parse({
			...product,
			productID: 8,
			reviews,
		});
		expect(parsed).toEqual({ ...product, productID: 8, id: 8, reviews });
		expect(ProductWithReviews.parse(parsed)).toEqual(parsed);
	});

	it("supports products without reviews", () => {
		expect(ProductWithReviews.parse({ ...product, id: 8 }).reviews).toEqual([]);
	});
});
