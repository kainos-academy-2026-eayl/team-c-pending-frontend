(() => {
	const globe = document.querySelector(".product-globe");
	const toggle = document.querySelector(".globe-toggle");
	if (!globe || !toggle) return;

	const items = [...globe.querySelectorAll(".globe-item")];
	const navigation = document.querySelector(".globe-navigation");
	const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
	let paused = false;
	let hovered = null;
	let focused = null;
	let activeIndex = 0;
	let timer = null;
	const previousOffsets = new Map();

	function render() {
		const visibleSides = globe.clientWidth < 480 ? 1 : 2;
		const cardWidth = 136;
		const outerScale = 1 - visibleSides * 0.16;
		const rowScale = visibleSides === 1 ? 1 + 2 * 0.84 : 1 + 2 * (0.84 + 0.68);
		const fit = Math.min(
			1,
			Math.max(0, globe.clientWidth - 16 - visibleSides * 24) /
				(cardWidth * rowScale),
		);
		const spacing = Math.max(
			0,
			(globe.clientWidth - 16 - cardWidth * outerScale * fit) /
				(visibleSides * 2),
		);
		const layout = items.map((item, index) => {
			let offset = (index - activeIndex + items.length) % items.length;
			if (offset > items.length / 2) offset -= items.length;
			const distance = Math.abs(offset);
			return {
				item,
				offset,
				distance,
				visible: distance <= visibleSides,
				x:
					distance <= visibleSides
						? offset * spacing
						: Math.sign(offset) * (globe.clientWidth / 2 + cardWidth),
				scale: Math.max(0.55, 1 - distance * 0.16) * fit,
			};
		});
		layout.forEach((entry) => {
			const previousOffset = previousOffsets.get(entry.item);
			if (
				previousOffset !== undefined &&
				Math.abs(entry.offset - previousOffset) > 1
			) {
				entry.item.style.transition = "none";
				entry.item.style.transform = `translate(-50%, -50%) translateX(${Math.sign(entry.offset) * (globe.clientWidth / 2 + cardWidth)}px) scale(${entry.scale})`;
				// Reposition wrapped products offscreen before their next entrance.
				entry.item.getBoundingClientRect?.();
				entry.item.style.removeProperty("transition");
			}
			entry.item.style.transform = `translate(-50%, -50%) translateX(${entry.x}px) scale(${entry.scale})`;
			entry.item.style.zIndex = String(100 - entry.distance);
			entry.item.style.transitionDelay = entry.visible ? "0s, 0s" : "0s, 600ms";
			entry.item.style.visibility = entry.visible ? "visible" : "hidden";
			entry.item.inert = !entry.visible;
			previousOffsets.set(entry.item, entry.offset);
		});
	}

	function update() {
		if (timer !== null) clearTimeout(timer);
		timer = null;
		const animated = !motion.matches && items.length > 1;
		globe.classList.toggle("is-animated", animated);
		toggle.hidden = !animated;
		if (navigation) navigation.hidden = !animated;
		const toggleLabel = paused ? "Resume rotation" : "Pause rotation";
		toggle.setAttribute("aria-label", toggleLabel);
		toggle.setAttribute("title", toggleLabel);
		toggle.setAttribute("aria-pressed", String(paused));
		if (!animated) {
			previousOffsets.clear();
			for (const item of items) {
				item.style.removeProperty("transform");
				item.style.removeProperty("z-index");
				item.style.removeProperty("opacity");
				item.style.removeProperty("visibility");
				item.style.removeProperty("transition-delay");
				item.inert = false;
			}
			return;
		}
		render();
		if (!paused && !hovered && !focused && !document.hidden) {
			timer = setTimeout(() => {
				activeIndex = (activeIndex + 1) % items.length;
				update();
			}, 3000);
		}
	}

	for (const item of items) {
		item.addEventListener("pointerenter", () => {
			hovered = item;
			update();
		});
		item.addEventListener("pointerleave", () => {
			hovered = null;
			update();
		});
		item.addEventListener("focusin", () => {
			focused = item;
			update();
		});
		item.addEventListener("focusout", () => {
			focused = null;
			update();
		});
	}
	for (const image of globe.querySelectorAll("img")) {
		const showPlaceholder = () => {
			image.hidden = true;
			const placeholder = image.nextElementSibling;
			if (placeholder) placeholder.hidden = false;
		};
		image.addEventListener("error", showPlaceholder);
		if (image.complete && image.naturalWidth === 0) showPlaceholder();
	}
	toggle.addEventListener("click", () => {
		paused = !paused;
		update();
	});
	for (const button of document.querySelectorAll("[data-carousel-step]")) {
		button.addEventListener("click", () => {
			activeIndex =
				(activeIndex + Number(button.dataset.carouselStep) + items.length) %
				items.length;
			hovered = null;
			update();
		});
	}
	motion.addEventListener("change", update);
	document.addEventListener("visibilitychange", update);
	window.addEventListener("resize", update);
	update();
})();
