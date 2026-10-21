import express, { type Express } from "express";
import nunjucks from "nunjucks";
import { healthController } from "./controllers/health";
import { loginController } from "./controllers/login";

export function createApp(): Express {
	const app = express();

	nunjucks.configure("views", {
		autoescape: true,
		express: app,
		noCache: true,
	});

	app.get("/health", healthController);

	app.get("/login", loginController);

	app.use(express.static("public"));
	return app;

}
