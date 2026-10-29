import { type Request, type Response, Router } from 'express';

const router = Router();

router.post('/', async (req: Request, res: Response) => {

    if (!req.cookies.JWT_TOKEN) {
        return res.redirect('/login');
    }

    const response = await fetch(`${process.env.API_ADDRESS}/orders`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${req.cookies.JWT_TOKEN}`
        },
        body: JSON.stringify({
            type: "delivery",
        })
    });

    if (!response.ok) {
        const error = await response.json();
        return res.status(response.status).json(error);
    }

    res.redirect("/confirmation");

});

export default router;
