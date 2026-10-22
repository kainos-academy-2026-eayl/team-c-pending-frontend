import express, { type Express } from "express";
import nunjucks from "nunjucks";
import { healthController } from "./controllers/health";
import registerController from "./controllers/register";
import { productsController } from "./controllers/products";
import cookieParser from "cookie-parser";
import loginController from "./controllers/login";
import { logoutController } from "./controllers/logout";
import { accountController } from "./controllers/account";
import bodyParser from "body-parser";
import "dotenv/config";

export function createApp(): Express {
	const app = express();

	app.use(cookieParser());
	app.use(bodyParser.urlencoded({ extended: true }));

	// TODO: once we have a domain then we need to uncomment this code to prevent links to our form endpoints from other pages
	// app.use((req, res, next) => {
	// 	const origin = req.get("Origin");

	// 	if (
	// 		["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
	// 		origin !== "https://app.example.com"
	// 	) {
	// 		return res.sendStatus(403);
	// 	}

	// 	next();
	// });

	nunjucks.configure("views", {
		autoescape: true,
		express: app,
		noCache: true,
	});

	app.get("/health", healthController);

	app.use("/login", loginController);
	app.use("/register", registerController);

	app.get("/", productsController);
	app.get("/products", productsController);

	app.use(express.static("public"));
	app.get("/account", accountController);
	app.post("/logout", logoutController);

	return app;

}
