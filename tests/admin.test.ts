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
	it.each(["customers"])("shows delete controls beside save on the %s page", async (section) => {
		const response = await request(createApp()).get(`/admin/${section}`)
			.set("Cookie", "JWT_TOKEN=test-token").expect(200);
		expect(response.text).toContain('class="admin-actions"');
		expect(response.text).toContain('class="admin-delete-button"');
		expect(response.text).toContain(`/admin/${section}/1/delete?`);
	});

	it.each(["customers"])("confirms deletion of %s without modifying data", async (section) => {
		const response = await request(createApp()).get(`/admin/${section}/2/delete`)
			.query({ search: "Blue & Ada", category: "Home" })
			.set("Cookie", "JWT_TOKEN=test-token").expect(200);
		expect(response.text).toContain("Confirm deletion");
		expect(response.text).toContain("Cancel");
		expect(response.text).toContain('name="confirm" value="delete"');
		expect(response.text).toContain("all of their orders, order items, and basket entries");
		expect(apiFetch).toHaveBeenCalledTimes(1);
	});

	it.each(["customers"])("deletes %s and preserves filters", async (section) => {
		const response = await request(createApp()).post(`/admin/${section}/2/delete`)
			.query({ search: "Blue & Ada", category: "Home" })
			.set("Host", "localhost").set("Origin", "http://localhost")
			.set("Cookie", "JWT_TOKEN=test-token").type("form")
			.send({ confirm: "delete" }).expect(302);
		const target = new URL(response.headers.location, "http://localhost");
		expect(target.pathname).toBe(`/admin/${section}`);
		expect(target.searchParams.get("search")).toBe("Blue & Ada");
		expect(target.searchParams.get("success")).toContain("deleted");
		expect(target.searchParams.get("category")).toBe(section === "products" ? "Home" : null);
		expect(apiFetch).toHaveBeenLastCalledWith(`http://api.example/${section}/2`, {
			method: "DELETE", headers: { Authorization: "Bearer test-token" },
		});
	});

	it.each(["customers"])("requires confirmation before deleting %s", async (section) => {
		const response = await request(createApp()).post(`/admin/${section}/2/delete`)
			.set("Host", "localhost").set("Origin", "http://localhost")
			.set("Cookie", "JWT_TOKEN=test-token").type("form").send({}).expect(302);
		expect(new URL(response.headers.location, "http://localhost").searchParams.get("error"))
			.toBe("Deletion must be confirmed");
		expect(apiFetch).toHaveBeenCalledTimes(1);
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
			.set("Cookie", "JWT_TOKEN=test-token").expect(400);
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
		await request(createApp())[method]("/admin/customers/2/delete")
			.set("Host", "localhost").set("Origin", "http://localhost")
			.expect(302).expect("Location", "/login");
		apiFetch.mockResolvedValueOnce(Response.json({ ...user, role: "customer" }));
		await request(createApp())[method]("/admin/customers/2/delete")
			.set("Host", "localhost").set("Origin", "http://localhost")
			.set("Cookie", "JWT_TOKEN=test-token").expect(302).expect("Location", "/");
		expect(apiFetch).toHaveBeenCalledTimes(1);
	});

	it("rejects cross-origin deletion before contacting the API", async () => {
		await request(createApp()).post("/admin/customers/2/delete")
			.set("Host", "localhost").set("Origin", "https://other.example")
			.set("Cookie", "JWT_TOKEN=test-token").type("form").send({ confirm: "delete" }).expect(403);
		expect(apiFetch).not.toHaveBeenCalled();
	});

	it.each(["customers/invalid", "products/0", "orders/2"])("rejects invalid deletion parameters: %s", async (path) => {
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
