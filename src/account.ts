const orders = [
    {
        orderID: 1,
        price: 10.99,
        items: 3,
    },
    {
        orderID: 2,
        price: 5.99,
        items: 1,
    },
    {
        orderID: 3,
        price: 7.99,
        items: 2,
    },
    {
        orderID: 4,
        price: 12.99,
        items: 4,
    },
    {
        orderID: 5,
        price: 8.99,
        items: 2,
    }
];
export const filterOrdersByPrice = (price: number) => {
    return orders.filter(order => order.price <= price);
};
export default orders;