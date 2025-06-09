lint:
	npx @biomejs/biome format . --fix

run:
	python -m http.server 8000