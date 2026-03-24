const themeToggleBtn = document.getElementById("theme-toggle");

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

/** Sun when dark (tap → light); moon when light (tap → dark). */
function updateThemeToggleUI() {
	if (!themeToggleBtn) return;

	const isDark = document.documentElement.classList.contains("dark-theme");
	const iconName = isDark ? "sun" : "moon";
	const label = isDark ? "Switch to light mode" : "Switch to dark mode";

	themeToggleBtn.setAttribute("aria-label", label);
	themeToggleBtn.setAttribute("title", label);

	let icon = themeToggleBtn.querySelector("[data-lucide]");
	if (!icon) {
		icon = document.createElement("i");
		icon.setAttribute("aria-hidden", "true");
		themeToggleBtn.appendChild(icon);
	}
	icon.setAttribute("data-lucide", iconName);

	if (typeof lucide !== "undefined") {
		try {
			lucide.createIcons({ root: themeToggleBtn });
		} catch {
			lucide.createIcons();
		}
	}
}

function normalizeTheme(value) {
	if (value === "light" || value === "dark") return value;
	return "dark";
}

function handleThemeSelection(selectedTheme) {
	const theme = normalizeTheme(selectedTheme);
	localStorage.setItem("theme", theme);
	applyTheme(theme);
	updateThemeToggleUI();
}

export function initializeTheme() {
	const savedTheme = normalizeTheme(localStorage.getItem("theme"));

	if (themeToggleBtn) {
		themeToggleBtn.addEventListener("click", () => {
			const isDark =
				document.documentElement.classList.contains("dark-theme");
			handleThemeSelection(isDark ? "light" : "dark");
		});
	}

	applyTheme(savedTheme);
	updateThemeToggleUI();
}
