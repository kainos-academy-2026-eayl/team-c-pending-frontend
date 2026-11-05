const searchForm = document.querySelector(".header-search");
const searchInput = document.querySelector("#product-search");
const searchStatus = document.querySelector("#search-status");

if (searchForm && searchInput && searchStatus) {
	let timer;
	let controller;

	async function updateResults(requestController) {
		const url = new URL(searchForm.action);
		url.search = new URLSearchParams(new FormData(searchForm)).toString();
		searchStatus.textContent = "Searching...";

		try {
			const response = await fetch(url, {
				signal: requestController.signal,
			});
			if (!response.ok) {
				throw new Error(`Search failed (${response.status})`);
			}
			const html = await response.text();
			if (requestController.signal.aborted) {
				return;
			}
			const nextPage = new DOMParser().parseFromString(html, "text/html");
			const products = nextPage.querySelector(".products-container");
			const categories = nextPage.querySelector(".categories-container");
			if (!products || !categories) {
				throw new Error("Search response is missing results");
			}
			document.querySelector(".products-container").replaceWith(products);
			document.querySelector(".categories-container").replaceWith(categories);
			history.replaceState(null, "", url);
			searchStatus.textContent = "";
		} catch (error) {
			if (requestController.signal.aborted) {
				return;
			}
			console.error("Unable to update search results", error);
			searchStatus.textContent =
				"Unable to update results. Press Search to try again.";
		}
	}

	searchInput.addEventListener("input", () => {
		clearTimeout(timer);
		controller?.abort();
		searchStatus.textContent = "";
		controller = new AbortController();
		const requestController = controller;
		timer = setTimeout(() => {
			updateResults(requestController);
		}, 250);
	});

	searchForm.addEventListener("submit", () => {
		clearTimeout(timer);
		controller?.abort();
	});
}
