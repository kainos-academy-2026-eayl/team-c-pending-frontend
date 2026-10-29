import type { Request, Response } from "express";

export const passwordResetController = (req: Request, res: Response) => {
    res.render("passwordReset.njk");
};