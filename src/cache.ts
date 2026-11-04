const cacheMap = new Map<string, {
    value: any,
    timestamp: number;
    ttl: number;
}>();

export default async function cache(name: string, fn: () => ReturnType<typeof fetch>) {
    const cached = cacheMap.get(name);
    if (cached && (Date.now() - cached.timestamp < cached.ttl)) {
        return cached.value;
    }
    const value = await fn();
    if (!value.ok) {
        throw new Error("Failed to fetch cache value");
    }
    const jsonData = await value.json();
    cacheMap.set(name, { value: jsonData, timestamp: Date.now(), ttl: 60_000 });
    return jsonData;
}
