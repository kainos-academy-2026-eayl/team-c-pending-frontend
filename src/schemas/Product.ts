import z from "zod";

export default z.object({
    id: z.int(),
    name: z.string(),
    category: z.string(),
    price: z.number(),
    description: z.string(),
    imageUrl: z.string().optional()
});
