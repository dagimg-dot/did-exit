// PDF text extraction using PDF.js with enhanced analysis
import { PDFAnalyzer } from "./pdf-analyzer.js";

class PDFProcessor {
	constructor() {
		this.events = {};
		this.analyzer = new PDFAnalyzer();
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

			// Enhanced analysis using PDFAnalyzer
			const analysis = await this.analyzer.analyzeContent(pdf);

			// Emit enhanced analysis data
			this.emit("pdfAnalyzed", analysis);

			// Also emit basic text for backward compatibility
			if (!analysis.textContent.trim()) {
				throw new Error(
					"No text found in PDF. Please ensure the PDF contains readable text.",
				);
			}

			console.log(
				"Enhanced analysis complete:",
				analysis.textContent.length,
				"characters,",
				analysis.metadata.questionsFound,
				"questions detected",
			);

			this.emit("textExtracted", analysis.textContent, analysis);
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

				// Extract text items
				const pageText = textContent.items.map((item) => item.str).join(" ");

				fullText += pageText + "\n\n";

				console.log(`Page ${pageNum} processed: ${pageText.length} characters`);
			} catch (error) {
				console.warn(`Error processing page ${pageNum}:`, error);
				// Continue with other pages
			}
		}

		return this.cleanExtractedText(fullText);
	}

	cleanExtractedText(text) {
		return (
			text
				// Remove excessive whitespace
				.replace(/\s+/g, " ")
				// Remove page numbers and headers/footers patterns
				.replace(/^\d+\s*$/gm, "")
				// Clean up multiple line breaks
				.replace(/\n\s*\n\s*\n/g, "\n\n")
				// Trim whitespace
				.trim()
		);
	}

	// Simple text analysis to identify potential questions
	identifyQuestions(text) {
		const questionPatterns = [
			/\d+[\.\)]\s+.+?\?/g, // 1. Question?
			/\([A-Da-d]\)\s+.+/g, // (A) Option
			/[A-Da-d][\.\)]\s+.+/g, // A. Option
			/Question\s+\d+/gi, // Question 1
			/\d+\.\s+Which|What|How|Why|Where|When/gi, // Numbered questions
		];

		const matches = [];
		questionPatterns.forEach((pattern) => {
			const found = text.match(pattern);
			if (found) {
				matches.push(...found);
			}
		});

		return {
			hasQuestions: matches.length > 0,
			potentialQuestions: matches.slice(0, 5), // First 5 matches
			questionCount: matches.length,
		};
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
