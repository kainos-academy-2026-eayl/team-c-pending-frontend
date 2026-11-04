import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import basketController from "../src/controllers/basket";

function createBasketApp(authenticated = true) {
	const app = express();
	app.use(express.urlencoded({ extended: false }));
	app.use((req, res, next) => {
		req.cookies = {};
		res.locals.me = authenticated;
		next();
	});
	app.use("/basket", basketController);
	return app;
}

describe("POST /basket", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
	});

	it("redirects unauthenticated users without calling the API", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await request(createBasketApp(false))
			.post("/basket")
			.expect(302)
			.expect("Location", "/login");

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it.each([
		{ quantityMode: "absolute", oldQuantity: 3, expected: 2 },
		{ quantityMode: "relative", oldQuantity: 3, expected: 5 },
		{ quantityMode: "relative", oldQuantity: 0, expected: 2 },
	])(
		"updates $quantityMode quantity with existing quantity $oldQuantity",
		async ({ quantityMode, oldQuantity, expected }) => {
			vi.stubEnv("API_ADDRESS", "http://api.example");
			const fetchMock = vi.fn();
			if (quantityMode === "relative") {
				const basket = oldQuantity
					? [
							{
								productID: 1,
								quantity: oldQuantity,
								product: {
									productID: 1,
									name: "Product",
									price: 10,
									description: "",
									category: "",
									quantity: 10,
									image: null,
								},
							},
						]
					: [];
				fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(basket)));
			}
			fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
			vi.stubGlobal("fetch", fetchMock);

			await request(createBasketApp())
				.post("/basket")
				.type("form")
				.send({ productID: "1", quantityMode, quantity: "2" })
				.expect(302)
				.expect("Location", "/basket");

			expect(fetchMock).toHaveBeenCalledTimes(
				quantityMode === "relative" ? 2 : 1,
			);
			expect(fetchMock).toHaveBeenLastCalledWith(
				"http://api.example/basket/1",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({ quantity: expected }),
				}),
			);
		},
	);

	it("forwards API errors without redirecting", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response("Out of stock", { status: 409 })),
		);

		const response = await request(createBasketApp())
			.post("/basket")
			.type("form")
			.send({ productID: "1", quantityMode: "absolute", quantity: "2" })
			.expect(409);

		expect(response.text).toBe("Out of stock");
		expect(response.headers.location).toBeUndefined();
	});
});
