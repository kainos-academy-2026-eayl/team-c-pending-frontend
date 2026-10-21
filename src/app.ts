<<<<<<< Updated upstream
import process from "node:process";
import express, { type Express, type Request, type Response } from "express";
=======
import express, { type Express } from "express";
import nunjucks from "nunjucks";
import { healthController } from "./controllers/health";
import { productsController } from "./controllers/products";
import { registerController } from "./controllers/register";
import { loginController } from "./controllers/login";
import { accountController } from "./controllers/account";
>>>>>>> Stashed changes

export function createApp(): Express {
	const app = express();

	app.get("/health", (_req: Request, res: Response) => {
		res.json({ status: "ok", uptime: process.uptime() });
	});

<<<<<<< Updated upstream
=======
	app.get("/login", loginController);

	app.get("/register", registerController);

	app.get("/products", productsController);
	app.get("/", productsController);

	app.get("/account-menu", accountController);
	app.get("/", accountController);

	app.use(express.static("public"));
>>>>>>> Stashed changes
	return app;
}
