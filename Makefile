lint:
	npx @biomejs/biome format . --fix

run:
	python -m http.server 8000

dev:
	uv run --with watchdog watchmedo auto-restart --patterns="*.html;*.css;*.js" -- python -m http.server 8000
