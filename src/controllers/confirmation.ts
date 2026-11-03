import type { Request, Response } from "express";

export const confirmationController = (_req: Request, res: Response) => {
	res.render("confirmation.njk");
};
