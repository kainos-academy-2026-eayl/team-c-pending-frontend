const cacheMap = new Map<
	string,
	{
		value: any;
		timestamp: number;
		ttl: number;
	}
>();

export default async function cache(
	name: string,
	fn: () => ReturnType<typeof fetch>,
) {
	const cached = cacheMap.get(name);
	if (cached && Date.now() - cached.timestamp < cached.ttl) {
		return cached.value;
	}
	try {
		const value = await fn();
		if (!value.ok) {
			const emptyData: unknown[] = [];
			cacheMap.set(name, {
				value: emptyData,
				timestamp: Date.now(),
				ttl: 60_000,
			});
			return emptyData;
		}
		const jsonData = await value.json();
		cacheMap.set(name, {
			value: jsonData,
			timestamp: Date.now(),
			ttl: 60_000,
		});
		return jsonData;
	} catch {
		const emptyData: unknown[] = [];
		cacheMap.set(name, {
			value: emptyData,
			timestamp: Date.now(),
			ttl: 60_000,
		});
		return emptyData;
	}
}
