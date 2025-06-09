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
			const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
			this.currentPdf = pdf;
			console.log("PDF loaded:", pdf.numPages, "pages");

			// Extract text from all pages
			const extractedText = await this.extractTextFromPDF(pdf);

			if (!extractedText.trim()) {
				throw new Error(
					"No text found in PDF. Please ensure the PDF contains readable text.",
				);
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

		// Process each page
		for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
			try {
				const page = await pdf.getPage(pageNum);
				const textContent = await page.getTextContent();

				// Extract text items with better formatting
				const pageText = this.processPageText(textContent);
				fullText += pageText + "\n\n";

				console.log(`Page ${pageNum} processed: ${pageText.length} characters`);
			} catch (error) {
				console.warn(`Error processing page ${pageNum}:`, error);
				// Continue with other pages
			}
		}

		return this.cleanExtractedText(fullText);
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

			pageText += item.str + " ";
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
}

export { PDFProcessor };
