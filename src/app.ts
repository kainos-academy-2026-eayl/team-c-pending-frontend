import express, { type Express } from "express";
import nunjucks from "nunjucks";
import { healthController } from "./controllers/health";
import { loginController } from "./controllers/login";
import { registerController } from "./controllers/register";
import { productsController } from "./controllers/products";

export function createApp(): Express {
	const app = express();

	nunjucks.configure("views", {
		autoescape: true,
		express: app,
		noCache: true,
	});

	app.get("/health", healthController);

	app.get("/login", loginController);

	app.get("/register", registerController);

	app.get("/", productsController);
	app.get("/products", productsController);

	app.use(express.static("public"));
	return app;

}
