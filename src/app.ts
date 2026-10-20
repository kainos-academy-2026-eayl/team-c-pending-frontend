import process from "node:process";
import express, { type Express, type Request, type Response } from "express";
import nunjucks from "nunjucks";
import products from "./products";

const categories = Array.from(new Set(products.map(product => product.category)));

export function createApp(): Express {
	const app = express();

	nunjucks.configure("views", {
		autoescape: true,
		express: app,
		noCache: true,
	});
	app.get("/health", (_req: Request, res: Response) => {
		res.json({ status: "ok", uptime: process.uptime() });
	});

	app.get("/login", (_req: Request, res: Response) => {
		res.render("login.html");
	});

	app.get("/register", (_req: Request, res: Response) => {
		res.render("register.html");
	});
	app.get("/products", (req: Request, res: Response) => {
		if (req.query.category) {
			const category = req.query.category.toString();
			const filteredProducts = products.filter(product => product.category === category);
			res.render("products.html", { products: filteredProducts, categories, currentCategory: category });
		} else {
			res.render("products.html", { products, categories, currentCategory: null });
		}
	});

	app.use(express.static("public"));
	return app;

}
