import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import nunjucks from "nunjucks";
import { healthController } from "./controllers/health";
import loginController from "./controllers/login";
import { logoutController } from "./controllers/logout";
import { accountController } from "./controllers/account";
import bodyParser from "body-parser";
import "dotenv/config";

export function createApp(): Express {
	const app = express();

	app.use(cookieParser());
	app.use(bodyParser.urlencoded({ extended: true }));

	nunjucks.configure("views", {
		autoescape: true,
		express: app,
		noCache: true,
	});

	app.get("/health", healthController);

	app.use("/login", loginController);

	app.use(express.static("public"));
	app.get("/account", accountController);
	app.post("/logout", logoutController);

	app.use((req, res, next) => {
		const origin = req.get("Origin");

		if (
			["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
			origin !== "https://app.example.com"
		) {
			return res.sendStatus(403);
		}

		next();
	});

	return app;

}
