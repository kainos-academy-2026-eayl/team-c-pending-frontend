import z from "zod";

export default z.object({
    quantity: z.number(),
    name: z.string(),
    id: z.number(),
    price: z.number(),
    description: z.string(),
    category: z.string(),
    stock: z.boolean(),
    image: z.string().nullable(),
});
