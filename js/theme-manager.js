const themeButtons = {
	light: document.getElementById("theme-light"),
	dark: document.getElementById("theme-dark"),
	system: document.getElementById("theme-system"),
};

function applyTheme(theme) {
	if (theme === "dark") {
		document.documentElement.classList.add("dark-theme");
		document.documentElement.classList.remove("light-theme");
	} else if (theme === "light") {
		document.documentElement.classList.add("light-theme");
		document.documentElement.classList.remove("dark-theme");
	} else {
		document.documentElement.classList.remove("light-theme", "dark-theme");
	}
}

function updateActiveButton(theme) {
	for (const key in themeButtons) {
		if (themeButtons[key]) {
			themeButtons[key].classList.toggle("active", key === theme);
		}
	}
}

function handleThemeSelection(selectedTheme) {
	localStorage.setItem("theme", selectedTheme);
	applyTheme(selectedTheme);
	updateActiveButton(selectedTheme);
}

export function initializeTheme() {
	const savedTheme = localStorage.getItem("theme") || "system";

	for (const key in themeButtons) {
		if (themeButtons[key]) {
			themeButtons[key].addEventListener("click", () =>
				handleThemeSelection(key),
			);
		}
	}

	// Initial theme application
	applyTheme(savedTheme);
	updateActiveButton(savedTheme);

	// The listener for system theme changes is not needed, as the browser
	// now handles this automatically via the corrected CSS media queries.
	// window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
	//     if (localStorage.getItem('theme') === 'system') {
	//         applyTheme(e.matches ? 'dark' : 'light');
	//     }
	// });
}
