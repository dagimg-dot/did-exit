// Simplified PDF Analysis focusing on common patterns
class PDFAnalyzer {
	constructor() {
		// Focus on the most common patterns only
		this.commonPatterns = {
			numberedQuestions: /^\s*(\d+)[\.\)]\s+(.+)/gm, // "1. text" or "1) text"
			questionMarkers: /\?/g,
			mcChoiceMarkers: /[A-D][\.\)]/g,
		};
	}

	// Simplified analysis - just detect if PDF has questions and estimate count
	async analyzeContent(pdfDocument) {
		console.log("🔍 Starting simplified PDF analysis...");

		const analysis = {
			textContent: "",
			metadata: {
				totalPages: pdfDocument.numPages,
				questionsFound: 0,
				hasQuestions: false,
				estimatedQuestions: 0,
			},
		};

		// Extract text from all pages
		for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
			const pageText = await this.extractPageText(pdfDocument, pageNum);
			analysis.textContent += pageText + "\n\n";
		}

		// Simple pattern detection
		const questionAnalysis = this.detectQuestionPatterns(analysis.textContent);
		analysis.metadata = { ...analysis.metadata, ...questionAnalysis };

		console.log(
			`📊 Simple analysis complete: ${analysis.metadata.estimatedQuestions} questions estimated`,
		);

		return analysis;
	}

	async extractPageText(pdfDocument, pageNum) {
		const page = await pdfDocument.getPage(pageNum);
		const textContent = await page.getTextContent();
		return textContent.items.map((item) => item.str).join(" ");
	}

	detectQuestionPatterns(text) {
		// Count numbered questions (most common pattern: "1. text")
		const numberedMatches =
			text.match(this.commonPatterns.numberedQuestions) || [];

		// Count question marks
		const questionMarks = text.match(this.commonPatterns.questionMarkers) || [];

		// Count multiple choice indicators
		const mcMarkers = text.match(this.commonPatterns.mcChoiceMarkers) || [];

		// Simple estimation
		const numberedQuestions = numberedMatches.length;
		const questionMarkCount = questionMarks.length;
		const mcOptionCount = mcMarkers.length;

		// Estimate actual questions
		let estimatedQuestions = Math.max(
			numberedQuestions,
			Math.floor(questionMarkCount / 2), // Assume some question marks are in answers
			Math.floor(mcOptionCount / 4), // Assume 4 options per MC question
		);

		// Conservative estimate - most PDFs have fewer questions than markers
		estimatedQuestions = Math.min(estimatedQuestions, 50);

		const hasQuestions = estimatedQuestions > 0;

		console.log(
			`📊 Pattern detection: ${numberedQuestions} numbered items, ${questionMarkCount} question marks, ${mcOptionCount} MC markers`,
		);

		return {
			questionsFound: estimatedQuestions,
			hasQuestions: hasQuestions,
			estimatedQuestions: estimatedQuestions,
			patternBreakdown: {
				numberedQuestions,
				questionMarkCount,
				mcOptionCount,
			},
		};
	}

	// Simple chunking based on content length only
	createIntelligentChunks(analysis, maxChunkSize = 15000) {
		const textContent = analysis.textContent;
		const chunks = [];

		if (textContent.length <= maxChunkSize) {
			// Single chunk
			return {
				aiChunks: [
					{
						content: textContent,
						estimatedQuestions: analysis.metadata.estimatedQuestions,
						type: "ai_processing",
					},
				],
			};
		}

		// Split into multiple chunks
		const chunkCount = Math.ceil(textContent.length / maxChunkSize);
		const chunkSize = Math.floor(textContent.length / chunkCount);

		for (let i = 0; i < chunkCount; i++) {
			const start = i * chunkSize;
			const end =
				i === chunkCount - 1 ? textContent.length : (i + 1) * chunkSize;

			// Try to break at sentence boundaries
			let actualEnd = end;
			if (i < chunkCount - 1) {
				const nextPeriod = textContent.indexOf(".", end);
				const nextNewline = textContent.indexOf("\n", end);

				if (nextPeriod > 0 && nextPeriod < end + 200) {
					actualEnd = nextPeriod + 1;
				} else if (nextNewline > 0 && nextNewline < end + 200) {
					actualEnd = nextNewline + 1;
				}
			}

			const chunkContent = textContent.substring(start, actualEnd);
			const chunkQuestionEstimate = Math.ceil(
				analysis.metadata.estimatedQuestions / chunkCount,
			);

			chunks.push({
				content: chunkContent,
				estimatedQuestions: chunkQuestionEstimate,
				type: "ai_processing",
			});
		}

		return {
			aiChunks: chunks,
		};
	}
}

export { PDFAnalyzer };
