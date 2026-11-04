import z from "zod";

export default z.object({
    name: z.string(),
    productID: z.number().optional(),
    id: z.number().optional(),
    price: z.number(),
    description: z.string(),
    category: z.string(),
    quantity: z.int(),
    image: z.string().nullable(),
})
.refine(
    (data) => data.productID !== undefined || data.id !== undefined,
    "Must have either productID or id"
)
.transform(({ productID, id, ...product }) => ({
    ...product,
    id: productID ?? id,
}));
