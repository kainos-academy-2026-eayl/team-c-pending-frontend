import type { Response } from "express";

export const confirmationController = (_req: unknown, res: Response) => {
	res.render("confirmation.njk");
};
