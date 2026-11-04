import z from "zod";

const Product = z.object({
    name: z.string(),
    id: z.number(),
    price: z.number(),
    description: z.string(),
    category: z.string(),
    quantity: z.int(),
    image: z.string().nullable(),
});

const ApiProduct = Product.omit({ id: true }).extend({
    productID: z.number().int().positive(),
}).transform(({ productID, ...product }) => ({
    ...product,
    id: productID,
}));

export default z.union([Product, ApiProduct]);
