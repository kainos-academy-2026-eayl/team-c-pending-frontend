import z from "zod";

export default z.object({
    name: z.string(),
    productID: z.number(),
    price: z.number(),
    description: z.string(),
    category: z.string(),
    quantity: z.int(),
    image: z.string().nullable(),
});
