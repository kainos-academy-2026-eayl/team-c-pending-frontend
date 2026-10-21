// Mock product data that will be replaced by API calls once the backend is ready

const products = [
    {
        name: "Apple",
        price: 1.99,
        description: "A fresh apple",
        category: "Fruit"
    },
    {
        name: "Banana",
        price: 0.99,
        description: "A ripe banana",
        category: "Fruit"

    },
    {
        name: "Orange",
        price: 1.49,
        description: "A juicy orange",
        category: "Fruit"
    },
    {
        name: "Pear",
        price: 1.29,
        description: "A sweet green pear",
        category: "Fruit"
    },
    {
        name: "Strawberries",
        price: 3.49,
        description: "A punnet of fresh strawberries",
        category: "Fruit"
    },
    {
        name: "Blueberries",
        price: 4.25,
        description: "A punnet of juicy blueberries",
        category: "Fruit"
    },
    {
        name: "Grapes",
        price: 2.99,
        description: "A bunch of seedless grapes",
        category: "Fruit"
    },
    {
        name: "Pineapple",
        price: 3.99,
        description: "A ripe tropical pineapple",
        category: "Fruit"
    },
    {
        name: "Mango",
        price: 1.79,
        description: "A soft and fragrant mango",
        category: "Fruit"
    },
    {
        name: "Peach",
        price: 1.59,
        description: "A ripe, juicy peach",
        category: "Fruit"
    },
    {
        name: "Watermelon",
        price: 5.99,
        description: "A large refreshing watermelon",
        category: "Fruit"
    },
    {
        name: "Lemon",
        price: 0.79,
        description: "A zesty yellow lemon",
        category: "Fruit"
    },
    {
        name: "Carrot",
        price: 0.69,
        description: "A crisp orange carrot",
        category: "Vegetable"
    },
    {
        name: "Broccoli",
        price: 1.89,
        description: "A fresh green broccoli crown",
        category: "Vegetable"
    },
    {
        name: "Potato",
        price: 1.49,
        description: "A versatile baking potato",
        category: "Vegetable"
    },
    {
        name: "Tomato",
        price: 0.89,
        description: "A ripe red tomato",
        category: "Vegetable"
    },
    {
        name: "Cucumber",
        price: 1.25,
        description: "A cool and crunchy cucumber",
        category: "Vegetable"
    },
    {
        name: "Spinach",
        price: 2.49,
        description: "A bag of fresh baby spinach",
        category: "Vegetable"
    },
    {
        name: "Cheddar Cheese",
        price: 4.99,
        description: "A block of mature cheddar cheese",
        category: "Dairy"
    },
    {
        name: "Whole Milk",
        price: 1.65,
        description: "A bottle of fresh whole milk",
        category: "Dairy"
    },
    {
        name: "Sourdough Bread",
        price: 3.25,
        description: "A freshly baked sourdough loaf",
        category: "Bakery"
    },
    {
        name: "Oat Cookies",
        price: 2.75,
        description: "A pack of crunchy oat cookies",
        category: "Bakery"
    },
];

export function filterProductsByCategory(category: string) {
    return products.filter(product => product.category === category);
}

export default products;

export const categories = Array.from(new Set(products.map(product => product.category)));