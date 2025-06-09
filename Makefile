lint:
	npx @biomejs/biome format . --fix

run:
	uv run --with watchdog watchmedo auto-restart --patterns="*.html;*.css;*.js" -- python -m http.server 8000
