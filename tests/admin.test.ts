import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";

const user = {
	firstName: "Ada",
	lastName: "Lovelace",
	customerId: 1,
	email: "ada@example.com",
	role: "Admin",
	basketCount: 0,
};
const customers = [
	{ customerID: 1, firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", role: "Admin" },
	{ customerID: 2, firstName: "Grace", lastName: "Hopper", email: "grace@navy.example", role: "customer" },
];
const products = [
	{ productID: 1, name: "Blue mug", price: 10, description: "A mug", category: "Home", quantity: 3, image: null, hide: false },
	{ productID: 2, name: "Blue shirt", price: 20, description: "A shirt", category: "Clothing", quantity: 4, image: null, hide: true },
	{ productID: 3, name: "Red mug", price: 12, description: "Another mug", category: "Home", quantity: 2, image: null, hide: false },
];
const apiFetch = vi.fn<typeof fetch>();

beforeEach(() => {
	vi.stubEnv("API_ADDRESS", "http://api.example");
	vi.stubGlobal("fetch", apiFetch);
	apiFetch.mockImplementation(async (input, init) => {
		const path = new URL(String(input)).pathname;
		if (path === "/me") return Response.json(user);
		if (init?.method === "PATCH") return Response.json({});
		if (init?.method === "DELETE") return new Response(null, { status: 204 });
		if (path === "/customers") return Response.json(customers);
		if (path === "/products/admin") return Response.json(products);
		throw new Error(`Unexpected API request: ${path}`);
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.resetAllMocks();
});

describe("Admin sections", () => {
	it("shows the add product form and all admin navigation links", async () => {
		const response = await request(createApp()).get("/admin/products/new")
			.set("Cookie", "JWT_TOKEN=test-token").expect(200);
		for (const path of ["/admin/customers", "/admin/products", "/admin/products/new", "/admin/orders"]) {
			expect(response.text).toContain(`href="${path}"`);
		}
		expect(response.text).toContain('action="/admin/products/new"');
		expect(response.text).toContain("New product");
		expect(apiFetch).toHaveBeenCalledTimes(1);
	});

	it("creates a visible product using numeric fields and a nullable image", async () => {
		apiFetch.mockResolvedValueOnce(Response.json(user)).mockResolvedValueOnce(Response.json("All okay"));
		const response = await request(createApp()).post("/admin/products/new")
			.set("Host", "localhost").set("Origin", "http://localhost")
			.set("Cookie", "JWT_TOKEN=test-token").type("form")
			.send({ name: " Apple ", price: "0.5", category: "Fruit", description: "An apple", quantity: "9", image: "" })
			.expect(302);
		expect(response.headers.location).toContain("/admin/products/new?success=");
		expect(apiFetch).toHaveBeenLastCalledWith("http://api.example/products", {
			method: "POST",
			headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
			body: JSON.stringify({ name: "Apple", price: 0.5, description: "An apple", category: "Fruit", quantity: 9, image: null }),
		});
	});

	it.each([{ price: "" }, { quantity: "" }, { price: "-1" }, { quantity: "1.5" }, { name: "" }])(
		"rejects invalid new product data and retains fields: %j", async (invalid) => {
			const response = await request(createApp()).post("/admin/products/new")
				.set("Host", "localhost").set("Origin", "http://localhost")
				.set("Cookie", "JWT_TOKEN=test-token").type("form")
				.send({ name: "Apple", price: "0.5", category: "Fruit", description: "An apple", quantity: "9", image: "", ...invalid })
				.expect(400);
			expect(response.text).toContain('role="alert"');
			expect(response.text).toContain('value="Fruit"');
			expect(response.text).toContain("An apple");
			expect(apiFetch).toHaveBeenCalledTimes(1);
		},
	);

	it("shows product creation API errors without losing entered fields", async () => {
		apiFetch.mockResolvedValueOnce(Response.json(user))
			.mockResolvedValueOnce(Response.json({ error: "Unavailable" }, { status: 503 }));
		const response = await request(createApp()).post("/admin/products/new")
			.set("Host", "localhost").set("Origin", "http://localhost")
			.set("Cookie", "JWT_TOKEN=test-token").type("form")
			.send({ name: "Apple", price: "0.5", category: "Fruit", description: "An apple", quantity: "9", image: "" })
			.expect(503);
		expect(response.text).toContain("Could not add product (503)");
		expect(response.text).toContain('value="Apple"');
	});

	it("shows all customer orders with names, snapshot totals, UTC dates and newest dates first", async () => {
		const order = {
			orderID: 1, customerID: 42, date: "2026-11-04T10:00:00.000Z", status: "pending", type: "delivery",
			customer: { firstName: "Ada", lastName: "Lovelace" },
			orderItems: [{ productID: 7, quantity: 3, orderItemID: 10, itemStatus: "active", unitPrice: 1.25, product: { name: "Apple" } }],
		};
		apiFetch.mockResolvedValueOnce(Response.json(user))
			.mockResolvedValueOnce(Response.json([order, { ...order, orderID: 2, customerID: 99, date: "2026-11-03T10:00:00.000Z" }]));
		const response = await request(createApp()).get("/admin/orders")
			.set("Cookie", "JWT_TOKEN=test-token").expect(200);
		expect(response.text).toContain("Customer ID: 42");
		expect(response.text).toContain("Customer ID: 99");
		expect(response.text).toContain("Customer: Ada Lovelace");
		expect(response.text).toContain("Apple");
		expect(response.text).toContain("Total: £3.75");
		expect(response.text).toContain("04/11/2026, 10:00:00");
		expect(response.text.indexOf("Order ID: 1")).toBeLessThan(response.text.indexOf("Order ID: 2"));
		expect(response.text).not.toContain('method="post"');
		expect(apiFetch).toHaveBeenLastCalledWith("http://api.example/orders/admin", {
			headers: { Authorization: "Bearer test-token" },
		});
	});

	it.each([
		["?search=  lOvE  ", [1, 3]],
		["?search=ada%20lovelace", [1, 3]],
		["?search=grace", [2]],
		["?status=pending", [1, 2]],
		["?search=ada&status=completed", [3]],
		["?sort=oldest", [2, 3, 1]],
		["?sort=newest", [1, 3, 2]],
		["?search=nobody", []],
		["?status=unknown", []],
	])("filters and sorts orders with %s", async (query, expectedIDs) => {
		const order = {
			customerID: 42, type: "delivery", orderItems: [],
			customer: { firstName: "Ada", lastName: "Lovelace" },
		};
		apiFetch.mockResolvedValueOnce(Response.json(user))
			.mockResolvedValueOnce(Response.json([
				{ ...order, orderID: 3, date: "2026-11-03T10:00:00.000Z", status: "completed" },
				{ ...order, orderID: 2, date: "2026-11-02T10:00:00.000Z", status: "pending",
					customer: { firstName: "Grace", lastName: "Hopper" } },
				{ ...order, orderID: 1, date: "2026-11-04T10:00:00.000Z", status: "pending" },
			]));
		const response = await request(createApp()).get(`/admin/orders${query}`)
			.set("Cookie", "JWT_TOKEN=test-token").expect(200);
		const actualIDs = [...response.text.matchAll(/<h3>Order ID: (\d+)<\/h3>/g)]
			.map((match) => Number(match[1]));
		expect(actualIDs).toEqual(expectedIDs);
		expect(response.text).toContain(`${expectedIDs.length} order(s) found.`);
		expect(response.text).toContain('value="completed"');
		expect(response.text).toContain('value="pending"');
		if (!expectedIDs.length) expect(response.text).toContain("No orders found.");
	});

	it("keeps the selected filters and provides a clear link", async () => {
		apiFetch.mockResolvedValueOnce(Response.json(user))
			.mockResolvedValueOnce(Response.json([{
				orderID: 1, customerID: 42, type: "delivery", orderItems: [],
				customer: { firstName: "Ada", lastName: "Lovelace" },
				date: "2026-11-04T10:00:00.000Z", status: "pending",
			}]));
		const response = await request(createApp()).get("/admin/orders?search=Ada&status=pending&sort=oldest")
			.set("Cookie", "JWT_TOKEN=test-token").expect(200);
		expect(response.text).toContain('value="Ada"');
		expect(response.text).toContain('value="pending" selected');
		expect(response.text).toContain('value="oldest" selected');
		expect(response.text).toContain('href="/admin/orders">Clear filters</a>');
	});

	it.each(["sort=invalid", "search=a&search=b", "status=a&status=b", "sort=newest&sort=oldest"])(
		"rejects invalid order filters: %s", async (query) => {
			const response = await request(createApp()).get(`/admin/orders?${query}`)
				.set("Cookie", "JWT_TOKEN=test-token").expect(400);
			expect(response.text).toContain("Invalid order filters");
			expect(apiFetch).toHaveBeenCalledTimes(1);
		},
	);

	it("shows an empty orders state", async () => {
		apiFetch.mockResolvedValueOnce(Response.json(user)).mockResolvedValueOnce(Response.json([]));
		const response = await request(createApp()).get("/admin/orders")
			.set("Cookie", "JWT_TOKEN=test-token").expect(200);
		expect(response.text).toContain("No orders found.");
	});

	it("reports order API failures", async () => {
		apiFetch.mockResolvedValueOnce(Response.json(user))
			.mockResolvedValueOnce(Response.json({ error: "Unavailable" }, { status: 503 }));
		const response = await request(createApp()).get("/admin/orders")
			.set("Cookie", "JWT_TOKEN=test-token").expect(503);
		expect(response.text).toContain("Unable to load orders (503)");
	});

	it.each(["/admin/products/new", "/admin/orders"])("protects the new section %s", async (path) => {
		await request(createApp()).get(path).expect(302).expect("Location", "/login");
		apiFetch.mockResolvedValueOnce(Response.json({ ...user, role: "customer" }));
		await request(createApp()).get(path).set("Cookie", "JWT_TOKEN=test-token")
			.expect(302).expect("Location", "/");
	});

	it("protects product creation from non-admins and cross-origin requests", async () => {
		await request(createApp()).post("/admin/products/new")
			.set("Host", "localhost").set("Origin", "http://localhost").type("form")
			.send({}).expect(302).expect("Location", "/login");
		apiFetch.mockResolvedValueOnce(Response.json({ ...user, role: "customer" }));
		await request(createApp()).post("/admin/products/new")
			.set("Host", "localhost").set("Origin", "http://localhost")
			.set("Cookie", "JWT_TOKEN=test-token").type("form").send({})
			.expect(302).expect("Location", "/");
		await request(createApp()).post("/admin/products/new")
			.set("Host", "localhost").set("Origin", "http://other.example")
			.set("Cookie", "JWT_TOKEN=test-token").type("form").send({}).expect(403);
	});

	it.each(["customers"])("shows delete controls beside save on the %s page", async (section) => {
		const response = await request(createApp()).get(`/admin/${section}`)
			.set("Cookie", "JWT_TOKEN=test-token").expect(200);
		expect(response.text).toContain('class="admin-actions"');
		expect(response.text).toContain('class="admin-delete-button"');
		expect(response.text).toContain("/admin/customer/1/delete?");
	});

	it("orders customers by numeric ID", async () => {
		apiFetch.mockResolvedValueOnce(Response.json(user))
			.mockResolvedValueOnce(Response.json([
				{ customerID: 10, firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", role: "customer" },
				{ customerID: 2, firstName: "Grace", lastName: "Hopper", email: "grace@navy.example", role: "customer" },
			]));

		const response = await request(createApp()).get("/admin/customers")
			.set("Cookie", "JWT_TOKEN=test-token").expect(200);

		expect(response.text.indexOf("CustomerID: 2"))
			.toBeLessThan(response.text.indexOf("CustomerID: 10"));
	});

	it("confirms customer deletion without modifying data", async () => {
		const response = await request(createApp()).get("/admin/customer/2/delete")
			.query({ search: "Blue & Ada", category: "Home" })
			.set("Cookie", "JWT_TOKEN=test-token").expect(200);
		expect(response.text).toContain("Confirm deletion");
		expect(response.text).toContain("Cancel");
		expect(response.text).toContain('name="confirm" value="delete"');
		expect(response.text).toContain('action="/admin/customer/2/delete?');
		expect(response.text).toContain('href="/admin/customers?');
		expect(response.text).toContain("all of their orders, order items, and basket entries");
		expect(apiFetch).toHaveBeenCalledTimes(1);
	});

	it.each(["customers"])("deletes %s and preserves the customer search filter", async (section) => {
		const response = await request(createApp()).post("/admin/customer/2/delete")
			.query({ search: "Blue & Ada", category: "Home" })
			.set("Host", "localhost").set("Origin", "http://localhost")
			.set("Cookie", "JWT_TOKEN=test-token").type("form")
			.send({ confirm: "delete" }).expect(302);
		const target = new URL(response.headers.location, "http://localhost");
		expect(target.pathname).toBe("/admin/customers");
		expect(target.searchParams.get("search")).toBe("Blue & Ada");
		expect(target.searchParams.get("category")).toBeNull();
		expect(target.searchParams.get("success")).toBe("Customer and their orders and basket deleted");
		expect(apiFetch).toHaveBeenCalledTimes(2);
		expect(apiFetch).toHaveBeenLastCalledWith(`http://api.example/${section}/2`, {
			method: "DELETE", headers: { Authorization: "Bearer test-token" },
		});
	});

	it("requires confirmation before deleting a customer", async () => {
		const response = await request(createApp()).post("/admin/customer/2/delete")
			.set("Host", "localhost").set("Origin", "http://localhost")
			.set("Cookie", "JWT_TOKEN=test-token").type("form").send({}).expect(302);
		expect(new URL(response.headers.location, "http://localhost").searchParams.get("error"))
			.toBe("Deletion must be confirmed");
		expect(apiFetch).toHaveBeenCalledTimes(1);
	});

	it("reports customer deletion API failures without a success message", async () => {
		apiFetch.mockResolvedValueOnce(Response.json(user))
			.mockResolvedValueOnce(Response.json({ error: "Customer not found" }, { status: 404 }));
		const response = await request(createApp()).post("/admin/customer/2/delete")
			.query({ search: "Ada" })
			.set("Host", "localhost").set("Origin", "http://localhost")
			.set("Cookie", "JWT_TOKEN=test-token").type("form")
			.send({ confirm: "delete" }).expect(302);
		const target = new URL(response.headers.location, "http://localhost");
		expect(target.pathname).toBe("/admin/customers");
		expect(target.searchParams.get("search")).toBe("Ada");
		expect(target.searchParams.get("error")).toBe("Customer not found");
		expect(target.searchParams.has("success")).toBe(false);
		expect(apiFetch).toHaveBeenCalledTimes(2);
	});

	it.each(["invalid", "0"])("rejects invalid customer deletion IDs before calling the API: %s", async (id) => {
		const response = await request(createApp()).post(`/admin/customer/${id}/delete`)
			.set("Host", "localhost").set("Origin", "http://localhost")
			.set("Cookie", "JWT_TOKEN=test-token").type("form")
			.send({ confirm: "delete" }).expect(400);
		expect(response.text).toBe("Invalid deletion request");
		expect(apiFetch).toHaveBeenCalledTimes(1);
	});

	it("normalizes product IDs while retaining visibility and numeric ordering", async () => {
		apiFetch.mockResolvedValueOnce(Response.json(user))
			.mockResolvedValueOnce(Response.json([
				{ ...products[1], productID: undefined, id: 10 },
				{ ...products[0], productID: undefined, id: 2 },
			]));
		const response = await request(createApp()).get("/admin/products")
			.set("Cookie", "JWT_TOKEN=test-token").expect(200);
		const productBoxes = [...response.text.matchAll(/<fieldset>([\s\S]*?)<\/fieldset>/g)];
		expect(productBoxes).toHaveLength(2);
		expect(productBoxes[0]![1]).toContain("ProductID: 2");
		expect(productBoxes[0]![1]).toContain('/admin/products/2/visibility?');
		expect(productBoxes[0]![1]).toContain('name="hide" value="true"');
		expect(productBoxes[1]![1]).toContain("ProductID: 10");
		expect(productBoxes[1]![1]).toContain('/admin/products/10/visibility?');
		expect(productBoxes[1]![1]).toContain('name="hide" value="false"');
	});
	});

	it("shows add/delete visibility controls inside each product box", async () => {
		const response = await request(createApp()).get("/admin/products")
			.set("Cookie", "JWT_TOKEN=test-token").expect(200);
		expect(response.text).toContain("Add product");
		expect(response.text).toContain("Delete product");
		expect(response.text).toContain("Deleting removes the product from browsing and all customers");
		expect(response.text).toContain("Existing orders are unchanged.");
		expect(response.text).toContain("Adding it again does not restore basket entries.");
		expect(response.text).toContain('name="hide" value="false"');
		expect(response.text).toContain('name="hide" value="true"');
		expect(response.text).not.toContain("/delete?");
		const productBoxes = [...response.text.matchAll(/<fieldset>([\s\S]*?)<\/fieldset>/g)];
		expect(productBoxes).toHaveLength(products.length);
		for (const [index, box] of productBoxes.entries()) {
			const content = box[1]!;
			expect(content).toContain(`ProductID: ${products[index]!.productID}`);
			expect(content).toContain("Save product");
			expect(content).toContain(`/admin/products/${products[index]!.productID}/visibility?`);
			expect(content).toContain(products[index]!.hide ? "Add product" : "Delete product");
			expect(content).toContain("Deleting removes the product from browsing");
			expect(content.match(/<form\b/g)).toHaveLength(2);
			expect(content).toMatch(/<\/form>\s*<form[^>]*\/visibility\?/);
		}
		expect(apiFetch).toHaveBeenLastCalledWith("http://api.example/products/admin", {
			headers: { Authorization: "Bearer test-token" },
		});
	});

	it.each(["true", "false"])("sets hide=%s and preserves product filters", async (hide) => {
		const response = await request(createApp()).post("/admin/products/2/visibility")
			.query({ search: "Blue", category: "Clothing" })
			.set("Host", "localhost").set("Origin", "http://localhost")
			.set("Cookie", "JWT_TOKEN=test-token").type("form").send({ hide }).expect(302);
		const target = new URL(response.headers.location, "http://localhost");
		expect(target.pathname).toBe("/admin/products");
		expect(target.searchParams.get("search")).toBe("Blue");
		expect(target.searchParams.get("category")).toBe("Clothing");
		expect(target.searchParams.get("success")).toBe(hide === "true"
			? "Product hidden and removed from all customers' baskets"
			: "Product shown");
		expect(apiFetch).toHaveBeenLastCalledWith("http://api.example/products/2", {
			method: "PATCH",
			headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
			body: JSON.stringify({ hide: hide === "true" }),
		});
	});

	it.each([{}, { hide: "yes" }])("rejects invalid visibility data %j", async (body) => {
		const response = await request(createApp()).post("/admin/products/2/visibility")
			.set("Host", "localhost").set("Origin", "http://localhost")
			.set("Cookie", "JWT_TOKEN=test-token").type("form").send(body).expect(302);
		expect(new URL(response.headers.location, "http://localhost").searchParams.get("error"))
			.toBe("Invalid product visibility request");
		expect(apiFetch).toHaveBeenCalledTimes(1);
	});

	it("rejects an invalid product ID for visibility changes", async () => {
		const response = await request(createApp()).post("/admin/products/0/visibility")
			.set("Host", "localhost").set("Origin", "http://localhost")
			.set("Cookie", "JWT_TOKEN=test-token").type("form").send({ hide: "true" }).expect(302);
		expect(new URL(response.headers.location, "http://localhost").searchParams.get("error"))
			.toBe("Invalid product visibility request");
		expect(apiFetch).toHaveBeenCalledTimes(1);
	});

	it("reports visibility update failures", async () => {
		apiFetch.mockResolvedValueOnce(Response.json(user))
			.mockResolvedValueOnce(Response.json({ error: "Product not found" }, { status: 404 }));
		const response = await request(createApp()).post("/admin/products/2/visibility")
			.set("Host", "localhost").set("Origin", "http://localhost")
			.set("Cookie", "JWT_TOKEN=test-token").type("form").send({ hide: "true" }).expect(302);
		expect(new URL(response.headers.location, "http://localhost").searchParams.get("error"))
			.toBe("Could not update product visibility (404)");
	});

	it.each(["get", "post"] as const)("rejects obsolete product deletion via %s", async (method) => {
		await request(createApp())[method]("/admin/products/2/delete")
			.set("Host", "localhost").set("Origin", "http://localhost")
			.set("Cookie", "JWT_TOKEN=test-token").expect(404);
		expect(apiFetch).toHaveBeenCalledTimes(1);
	});

	it("protects product visibility changes", async () => {
		await request(createApp()).post("/admin/products/2/visibility")
			.set("Host", "localhost").set("Origin", "http://localhost")
			.expect(302).expect("Location", "/login");
		apiFetch.mockResolvedValueOnce(Response.json({ ...user, role: "customer" }));
		await request(createApp()).post("/admin/products/2/visibility")
			.set("Host", "localhost").set("Origin", "http://localhost")
			.set("Cookie", "JWT_TOKEN=test-token").expect(302).expect("Location", "/");
		expect(apiFetch).toHaveBeenCalledTimes(1);
	});

	it.each(["get", "post"] as const)("protects %s deletion routes", async (method) => {
		const path = "/admin/customer/2/delete";
		await request(createApp())[method](path)
			.set("Host", "localhost").set("Origin", "http://localhost")
			.expect(302).expect("Location", "/login");
		apiFetch.mockResolvedValueOnce(Response.json({ ...user, role: "customer" }));
		await request(createApp())[method](path)
			.set("Host", "localhost").set("Origin", "http://localhost")
			.set("Cookie", "JWT_TOKEN=test-token").expect(302).expect("Location", "/");
		expect(apiFetch).toHaveBeenCalledTimes(1);
	});

	it("rejects cross-origin deletion before contacting the API", async () => {
		await request(createApp()).post("/admin/customer/2/delete")
			.set("Host", "localhost").set("Origin", "https://other.example")
			.set("Cookie", "JWT_TOKEN=test-token").type("form").send({ confirm: "delete" }).expect(403);
		expect(apiFetch).not.toHaveBeenCalled();
	});

	it.each(["customer/invalid", "customer/0"])("rejects invalid deletion parameters: %s", async (path) => {
		await request(createApp()).get(`/admin/${path}/delete`)
			.set("Cookie", "JWT_TOKEN=test-token").expect(400);
		expect(apiFetch).toHaveBeenCalledTimes(1);
	});

	it("redirects the admin landing page to customers", async () => {
		await request(createApp()).get("/admin").set("Cookie", "JWT_TOKEN=test-token")
			.expect(302).expect("Location", "/admin/customers");
	});

	it.each(["customers", "products"])("protects the %s page", async (section) => {
		await request(createApp()).get(`/admin/${section}`)
			.expect(302).expect("Location", "/login");
		apiFetch.mockResolvedValueOnce(Response.json({ ...user, role: "customer" }));
		await request(createApp()).get(`/admin/${section}`).set("Cookie", "JWT_TOKEN=test-token")
			.expect(302).expect("Location", "/");
		expect(apiFetch).toHaveBeenCalledTimes(1);
	});

	it.each(["  ADA LOVELACE  ", "ADA@EXAMPLE"])("searches customers by name or email: %s", async (search) => {
		const response = await request(createApp()).get("/admin/customers")
			.query({ search }).set("Cookie", "JWT_TOKEN=test-token").expect(200);
		expect(response.text).toContain('value="Ada"');
		expect(response.text).not.toContain('value="Grace"');
		expect(response.text).not.toContain('id="products-heading"');
		expect(apiFetch).toHaveBeenCalledTimes(2);
		expect(apiFetch).toHaveBeenLastCalledWith("http://api.example/customers", {
			headers: { Authorization: "Bearer test-token" },
		});
	});

	it("shows all customers without a search and reports no matches", async () => {
		const app = createApp();
		const all = await request(app).get("/admin/customers").set("Cookie", "JWT_TOKEN=test-token").expect(200);
		expect(all.text).toContain('value="Ada"');
		expect(all.text).toContain('value="Grace"');
		const empty = await request(app).get("/admin/customers").query({ search: "missing" })
			.set("Cookie", "JWT_TOKEN=test-token").expect(200);
		expect(empty.text).toContain("No customers found.");
	});

	it("combines case-insensitive product-name search with category filtering", async () => {
		const response = await request(createApp()).get("/admin/products")
			.query({ search: " BLUE ", category: "Home" }).set("Cookie", "JWT_TOKEN=test-token").expect(200);
		expect(response.text).toContain('value="Blue mug"');
		expect(response.text).not.toContain('value="Blue shirt"');
		expect(response.text).not.toContain('value="Red mug"');
		expect(response.text).toContain('<option value="Home" selected>');
		expect(response.text).toContain('<option value="Clothing">');
		expect(response.text).not.toContain('id="customers-heading"');
		expect(apiFetch).toHaveBeenCalledTimes(2);
	});

	it("shows every product with all categories selected and handles no matches", async () => {
		const app = createApp();
		const all = await request(app).get("/admin/products").set("Cookie", "JWT_TOKEN=test-token").expect(200);
		for (const product of products) expect(all.text).toContain(`value="${product.name}"`);
		const empty = await request(app).get("/admin/products").query({ category: "Missing" })
			.set("Cookie", "JWT_TOKEN=test-token").expect(200);
		expect(empty.text).toContain("No products found.");
	});

	it.each(["customers", "products"])("reports API errors on the %s page", async (section) => {
		apiFetch.mockResolvedValueOnce(Response.json(user))
			.mockResolvedValueOnce(Response.json({ error: "Forbidden" }, { status: 403 }));
		const response = await request(createApp()).get(`/admin/${section}`)
			.set("Cookie", "JWT_TOKEN=test-token").expect(403);
		expect(response.text).toBe(`Unable to load ${section} (403)`);
	});

	it.each([
		{ section: "customers", data: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" } },
		{ section: "products", data: { name: "Blue mug", price: "10", description: "A mug", category: "Home", quantity: "3", image: "" } },
	])("saves $section and retains the section's filters", async ({ section, data }) => {
		const response = await request(createApp()).post(`/admin/${section}/1`)
			.query({ search: "Blue & Ada", category: "Home" })
			.set("Host", "localhost").set("Origin", "http://localhost")
			.set("Cookie", "JWT_TOKEN=test-token").type("form").send(data).expect(302);
		const target = new URL(response.headers.location, "http://localhost");
		expect(target.pathname).toBe(`/admin/${section}`);
		expect(target.searchParams.get("search")).toBe("Blue & Ada");
		expect(target.searchParams.get("success")).toContain("details updated");
		expect(target.searchParams.get("category")).toBe(section === "products" ? "Home" : null);
		expect(apiFetch).toHaveBeenLastCalledWith(`http://api.example/${section}/1`, {
			method: "PATCH",
			headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
			body: JSON.stringify(section === "products"
				? { ...data, price: 10, quantity: 3, image: null }
				: data),
		});
	});

	it.each(["customers", "products"])("keeps validation errors in the %s section", async (section) => {
		const response = await request(createApp()).post(`/admin/${section}/1`).query({ search: "Ada" })
			.set("Host", "localhost").set("Origin", "http://localhost")
			.set("Cookie", "JWT_TOKEN=test-token").type("form").send({}).expect(302);
		const target = new URL(response.headers.location, "http://localhost");
		expect(target.pathname).toBe(`/admin/${section}`);
		expect(target.searchParams.get("error")).toBeTruthy();
		expect(target.searchParams.get("search")).toBe("Ada");
		expect(apiFetch).toHaveBeenCalledTimes(1);
	});
});
