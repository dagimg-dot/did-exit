// PDF text extraction using PDF.js - Simplified for AI Processing

class PDFProcessor {
	constructor() {
		this.events = {};
		this.currentPdf = null;
		this.initializePDFJS();
	}

	async initializePDFJS() {
		// Load PDF.js from CDN
		if (!window.pdfjsLib) {
			await this.loadPDFJS();
		}

		// Configure PDF.js worker
		if (window.pdfjsLib) {
			pdfjsLib.GlobalWorkerOptions.workerSrc =
				"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
		}
	}

	async loadPDFJS() {
		return new Promise((resolve, reject) => {
			// Check if PDF.js is already loaded
			if (window.pdfjsLib) {
				resolve();
				return;
			}

			const script = document.createElement("script");
			script.src =
				"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
			script.onload = () => {
				console.log("PDF.js loaded successfully");
				resolve();
			};
			script.onerror = () => {
				reject(new Error("Failed to load PDF.js library"));
			};
			document.head.appendChild(script);
		});
	}

	async processFile(file) {
		try {
			this.emit("processingStart");

			// Ensure PDF.js is loaded
			await this.initializePDFJS();

			// Convert file to ArrayBuffer
			const arrayBuffer = await this.fileToArrayBuffer(file);

			// Load PDF document
			const pdf = await pdfjsLib.getDocument({ data: arrayBuffer })
				.promise;
			this.currentPdf = pdf;
			console.log("PDF loaded:", pdf.numPages, "pages");

			// Detect image-based PDF by sampling first page text items
			{
				const firstPage = await pdf.getPage(1);
				const firstTextContent = await firstPage.getTextContent();
				console.log(
					`processFile: first page text items count: ${firstTextContent.items.length}`,
				);
				if (!firstTextContent.items.length) {
					console.warn(
						"No text items on first page - falling back to image extraction.",
					);
					const images = await this.extractImagesFromPDF(pdf);
					this.emit("imagesExtracted", images);
					return;
				}
			}

			// Extract text from all pages, tracking per-page length
			const { text: extractedText, pageLengths } =
				await this.extractTextFromPDF(pdf);
			const _trimmedText = extractedText.trim();
			// Log pages with significant text
			const pagesWithText = pageLengths.filter((len) => len > 50).length;
			console.log(
				`processFile: pagesWithText=${pagesWithText}/${pdf.numPages} (threshold 50 chars)`,
			);
			// If fewer than 20% of pages have meaningful text, use image-based flow
			if (pagesWithText / pdf.numPages < 0.2) {
				console.warn(
					"Insufficient pages with text - falling back to image extraction.",
				);
				const images = await this.extractImagesFromPDF(pdf);
				this.emit("imagesExtracted", images);
				return;
			}

			console.log(
				"Text extraction complete:",
				extractedText.length,
				"characters",
			);

			// Emit extracted text directly for AI processing
			this.emit("textExtracted", extractedText);
		} catch (error) {
			console.error("PDF processing error:", error);
			this.emit("error", error);
		}
	}

	async fileToArrayBuffer(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result);
			reader.onerror = () => reject(new Error("Failed to read file"));
			reader.readAsArrayBuffer(file);
		});
	}

	async extractTextFromPDF(pdf) {
		let fullText = "";
		const pageLengths = [];
		// Process each page
		for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
			try {
				const page = await pdf.getPage(pageNum);
				const textContent = await page.getTextContent();
				// Extract text items with better formatting
				const pageText = this.processPageText(textContent);
				const len = pageText.trim().length;
				pageLengths.push(len);
				fullText += `${pageText}\n\n`;
				console.log(`Page ${pageNum} processed: ${len} characters`);
			} catch (error) {
				console.warn(`Error processing page ${pageNum}:`, error);
				pageLengths.push(0);
			}
		}
		const cleaned = this.cleanExtractedText(fullText);
		return { text: cleaned, pageLengths };
	}

	processPageText(textContent) {
		// Extract text items and maintain better structure
		let pageText = "";
		let lastY = null;

		for (const item of textContent.items) {
			const currentY = item.transform[5];

			// Add line break if we moved to a different line
			if (lastY !== null && Math.abs(currentY - lastY) > 5) {
				pageText += "\n";
			}

			pageText += `${item.str} `;
			lastY = currentY;
		}

		return pageText.trim();
	}

	cleanExtractedText(text) {
		return (
			text
				// Normalize whitespace
				.replace(/\s+/g, " ")
				// Remove page numbers (standalone numbers on their own lines)
				.replace(/^\s*\d+\s*$/gm, "")
				// Clean up excessive line breaks
				.replace(/\n\s*\n\s*\n+/g, "\n\n")
				// Remove leading/trailing whitespace
				.trim()
				// Ensure we have reasonable line breaks
				.replace(/(.{100,}?)(\s)/g, "$1\n")
		);
	}

	// Event system
	on(event, callback) {
		if (!this.events[event]) {
			this.events[event] = [];
		}
		this.events[event].push(callback);
	}

	emit(event, data) {
		if (this.events[event]) {
			this.events[event].forEach((callback) => callback(data));
		}
	}

	// Add a new method to extract images from PDF pages
	async extractImagesFromPDF(pdf) {
		const images = [];
		console.log(
			`extractImagesFromPDF: starting extraction for ${pdf.numPages} pages`,
		);
		for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
			console.log(
				`extractImagesFromPDF: processing page ${pageNum}/${pdf.numPages}`,
			);
			const page = await pdf.getPage(pageNum);
			const viewport = page.getViewport({ scale: 1.5 });
			const canvas = document.createElement("canvas");
			const context = canvas.getContext("2d");
			canvas.width = viewport.width;
			canvas.height = viewport.height;
			await page.render({ canvasContext: context, viewport }).promise;
			const dataUrl = canvas.toDataURL("image/png");
			console.log(
				`extractImagesFromPDF: dataUrl length for page ${pageNum}: ${dataUrl.length}`,
			);
			images.push(dataUrl);
		}
		return images;
	}
}

export { PDFProcessor };
