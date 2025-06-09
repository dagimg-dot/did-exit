// Simplified PDF Analysis focusing on common patterns
class PDFAnalyzer {
	constructor() {
		// Focus on the most common patterns only
		this.commonPatterns = {
			numberedQuestions: /^\s*(\d+)[\.\)]\s+(.+)/gm, // "1. text" or "1) text"
			questionMarkers: /\?/g,
			mcChoiceMarkers: /[A-Da-d][\.\)]/g, // Both uppercase and lowercase
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
		// Enhanced patterns for better detection
		const questionPatterns = {
			// Main question numbers: "1.", "2.", "3." with flexible spacing
			mainQuestions: /^\s*(\d+)\.\s+\S/gm,
			// Alternative: "1)", "2)", "3)" with flexible spacing
			parenthesisQuestions: /^\s*(\d+)\)\s+\S/gm,
			// Question keyword patterns
			questionKeywords: /^\s*(Question\s+\d+|Q\d+)/gim,
			// Multiple choice option groups - both lowercase and uppercase
			optionGroups: /^\s*[a-dA-D][\.\)]\s+\S/gm,
			// Additional pattern for spaced options like "a ." or "A ."
			spacedOptions: /^\s*[a-dA-D]\s*[\.\)]\s+\S/gm,
		};

		// Count main question patterns
		const mainQuestionMatches =
			text.match(questionPatterns.mainQuestions) || [];
		const parenthesisMatches =
			text.match(questionPatterns.parenthesisQuestions) || [];
		const keywordMatches = text.match(questionPatterns.questionKeywords) || [];
		const optionMatches = text.match(questionPatterns.optionGroups) || [];
		const spacedOptionMatches =
			text.match(questionPatterns.spacedOptions) || [];

		// Combine option matches (avoid double counting)
		const totalOptionMatches = Math.max(
			optionMatches.length,
			spacedOptionMatches.length,
		);

		// Get the highest count from reliable patterns
		const numberedQuestions = Math.max(
			mainQuestionMatches.length,
			parenthesisMatches.length,
		);
		const keywordQuestions = keywordMatches.length;
		const estimatedFromOptions = Math.floor(totalOptionMatches / 4);

		// Use the most reliable estimate
		let estimatedQuestions = Math.max(
			numberedQuestions,
			keywordQuestions,
			estimatedFromOptions,
		);

		// Don't be too conservative - let AI handle validation
		estimatedQuestions = Math.min(estimatedQuestions, 200); // Increased from 50

		const hasQuestions = estimatedQuestions > 0;

		console.log(
			`📊 Enhanced pattern detection: 
			- Main numbered (${mainQuestionMatches.length}): "${mainQuestionMatches.slice(0, 3).join('", "')}"
			- Parenthesis numbered: ${parenthesisMatches.length}
			- Keyword questions: ${keywordQuestions}
			- Option groups: ${optionMatches.length}, spaced: ${spacedOptionMatches.length} (total: ${totalOptionMatches}, est. ${estimatedFromOptions} questions)
			- Final estimate: ${estimatedQuestions}`,
		);

		return {
			questionsFound: estimatedQuestions,
			hasQuestions: hasQuestions,
			estimatedQuestions: estimatedQuestions,
			patternBreakdown: {
				mainQuestions: mainQuestionMatches.length,
				parenthesisQuestions: parenthesisMatches.length,
				keywordQuestions: keywordQuestions,
				optionGroups: totalOptionMatches,
				estimatedFromOptions: estimatedFromOptions,
			},
		};
	}

	// Intelligent chunking based on question patterns and content length
	createIntelligentChunks(analysis, maxChunkSize = 12000) {
		const textContent = analysis.textContent;
		const chunks = [];
		const estimatedQuestions = analysis.metadata.estimatedQuestions;

		// For better extraction, create smaller chunks if we have many questions
		if (estimatedQuestions > 30) {
			maxChunkSize = 8000; // Smaller chunks for dense content
		} else if (estimatedQuestions > 15) {
			maxChunkSize = 10000;
		}

		if (textContent.length <= maxChunkSize) {
			// Single chunk
			return {
				aiChunks: [
					{
						content: textContent,
						estimatedQuestions: estimatedQuestions,
						type: "ai_processing",
					},
				],
			};
		}

		// Create multiple chunks, aiming for ~10-15 questions per chunk
		const questionsPerChunk = Math.min(
			15,
			Math.max(5, Math.floor(estimatedQuestions / 6)),
		);
		const targetChunkCount = Math.ceil(estimatedQuestions / questionsPerChunk);
		const actualChunkSize = Math.floor(textContent.length / targetChunkCount);

		for (let i = 0; i < targetChunkCount; i++) {
			const start = i * actualChunkSize;
			const end =
				i === targetChunkCount - 1
					? textContent.length
					: (i + 1) * actualChunkSize;

			// Try to break at natural boundaries (question starts)
			let actualEnd = end;
			if (i < targetChunkCount - 1) {
				// Look for question number patterns near the break point
				const searchText = textContent.substring(
					end,
					Math.min(end + 500, textContent.length),
				);
				const questionBreaks = [
					searchText.search(/^\s*\d+\.\s+\S/m),
					searchText.search(/^\s*\d+\)\s+\S/m),
					searchText.search(/^\s*Question\s+\d+/im),
				].filter((pos) => pos >= 0);

				if (questionBreaks.length > 0) {
					actualEnd = end + Math.min(...questionBreaks);
				} else {
					// Fall back to sentence boundary
					const nextPeriod = textContent.indexOf(".", end);
					if (nextPeriod > 0 && nextPeriod < end + 200) {
						actualEnd = nextPeriod + 1;
					}
				}
			}

			const chunkContent = textContent.substring(start, actualEnd);
			const chunkQuestionEstimate = Math.ceil(
				estimatedQuestions / targetChunkCount,
			);

			chunks.push({
				content: chunkContent,
				estimatedQuestions: chunkQuestionEstimate,
				type: "ai_processing",
			});
		}

		console.log(
			`📝 Created ${chunks.length} intelligent chunks, ~${questionsPerChunk} questions per chunk`,
		);

		return {
			aiChunks: chunks,
		};
	}
}

export { PDFAnalyzer };
