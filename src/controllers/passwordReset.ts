import type { Request, Response } from "express";

export const passwordResetController = (_req: Request, res: Response) => {
    res.render("passwordReset.njk");
};