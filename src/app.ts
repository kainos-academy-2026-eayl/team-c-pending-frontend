import express, { type Express } from "express";
import nunjucks from "nunjucks";
import { healthController } from "./controllers/health";
import basketController from "./controllers/basket";
import registerController from "./controllers/register";
import productReviewsController, { productController, productsController } from "./controllers/products";
import { confirmationController } from "./controllers/confirmation";
import cookieParser from "cookie-parser";
import checkoutController from "./controllers/checkout";
import loginController from "./controllers/login";
import { logoutController } from "./controllers/logout";
import { accountController } from "./controllers/account";
import adminController from "./controllers/admin";
import bodyParser from "body-parser";
import "dotenv/config";
import User from "./schemas/user.schema";
import { passwordResetController } from "./controllers/passwordReset";

export function createApp(): Express {
	const app = express();

	app.use(cookieParser());
	app.use(bodyParser.urlencoded({ extended: true }));
	app.use((req, res, next) => {
		if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
			const origin = req.get("Origin");
			const host = req.get("host");
			if (!origin || !host) {
				return res.sendStatus(403);
			}
			try {
				if (new URL(origin).origin !== new URL(`${req.protocol}://${host}`).origin) {
					return res.sendStatus(403);
				}
			} catch {
				return res.sendStatus(403);
			}
		}
		next();
	});
	app.use(async (req, res, next) => {
		if (req.cookies.JWT_TOKEN) {
			const token = req.cookies.JWT_TOKEN;
			const me = await fetch(`${process.env.API_ADDRESS}/me`, {
				headers: {
					Authorization: `Bearer ${token}`
				}
			});
			if (me.status === 200) {
				const meData = User.parse(await me.json());
				res.locals.me = meData;
			} else {
				if (me.status === 401 || me.status === 403) {
					res.clearCookie("JWT_TOKEN");
				}
			}
		}
		next();
	});

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

	const env = nunjucks.configure("views", {
		autoescape: true,
		express: app,
		noCache: true,
	});

	env.addFilter('pounds', function (num, length) {
		return num.toFixed(length || 2);
	});

	const asyncHandler = (fn: (req: express.Request, res: express.Response) => Promise<any>) =>
		(req: express.Request, res: express.Response, next: express.NextFunction) => Promise.resolve(fn(req, res)).catch(next);

	app.get("/health", healthController);

	app.use("/login", loginController);
	app.use("/register", registerController);
	app.get("/password-reset", passwordResetController);

	app.use("/checkout", checkoutController);

	app.get("/", asyncHandler(productsController));
	app.get("/products", asyncHandler(productsController));
	app.get("/products/:id", asyncHandler(productController));
	app.use("/products", productReviewsController);

	app.get("/confirmation", confirmationController);
	app.use("/basket", basketController);

	app.use(express.static("public"));
	app.get("/account", accountController);
	app.use("/admin", adminController);
	app.post("/logout", logoutController);

	app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		console.error("Unhandled error:", err);
		res.status(500).render("error.njk", { error: err.message });
	});

	return app;

}
