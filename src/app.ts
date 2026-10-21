import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import nunjucks from "nunjucks";
import { healthController } from "./controllers/health";
import { registerController } from "./controllers/register";
import loginController from "./controllers/login";
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

	app.get("/login", loginController);

	app.get("/register", registerController);

	app.use(express.static("public"));
	return app;

}
