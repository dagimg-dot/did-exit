// Batch Processing Manager for Progressive PDF Question Extraction
class BatchProcessor {
	constructor(aiIntegration, databaseManager) {
		this.ai = aiIntegration;
		this.db = databaseManager;
		this.events = {};
		this.processingQueue = [];
		this.isProcessing = false;
		this.rateLimitDelay = 5000; // 5 seconds between requests (12 RPM)
		this.abortController = null;
		this.currentOperation = null;
	}

	// Smart Chunking Algorithm
	calculateBatchSize(textContent) {
		const estimatedTokens = textContent.length / 4; // Rough token estimation
		const estimatedQuestions = this.estimateQuestionCount(textContent);

		console.log(
			`📊 Content analysis: ${estimatedTokens.toLocaleString()} tokens, ~${estimatedQuestions} questions`,
		);

		if (estimatedQuestions <= 15) {
			return { batchSize: estimatedQuestions, batchCount: 1 };
		}

		// For large documents, create manageable batches
		const optimalBatchSize = Math.min(
			15,
			Math.max(5, Math.floor(estimatedQuestions / 6)),
		);
		const batchCount = Math.ceil(estimatedQuestions / optimalBatchSize);

		return {
			batchSize: optimalBatchSize,
			batchCount: Math.min(batchCount, 10), // Cap at 10 batches to respect rate limits
		};
	}

	estimateQuestionCount(textContent) {
		// Multiple heuristics to estimate question count
		const questionMarkers = [
			/^\s*\d+[\.\)]\s+/gm, // 1. Question or 1) Question
			/^\s*[A-Z][\.\)]\s+/gm, // A. Question or A) Question
			/\bquestion\s+\d+/gi, // "Question 1", "Question 2"
			/^\s*Q\d+/gm, // Q1, Q2, etc.
			/\?\s*$/gm, // Lines ending with ?
		];

		let maxCount = 0;
		questionMarkers.forEach((pattern) => {
			const matches = textContent.match(pattern) || [];
			maxCount = Math.max(maxCount, matches.length);
		});

		// Use multiple choice indicators as confirmation
		const mcMarkers = [
			/^\s*[A-D][\.\)]/gm, // A. B. C. D. options
			/^\s*\([A-D]\)/gm, // (A) (B) (C) (D) options
		];

		let optionCount = 0;
		mcMarkers.forEach((pattern) => {
			const matches = textContent.match(pattern) || [];
			optionCount += matches.length;
		});

		// If we have 4x more options than questions, that's a good sign
		const mcQuestionEstimate = Math.floor(optionCount / 4);

		// Use the more conservative estimate
		const finalEstimate = Math.max(
			5,
			Math.min(maxCount, mcQuestionEstimate || maxCount),
		);

		console.log(
			`🔍 Question estimation: markers=${maxCount}, mc=${mcQuestionEstimate}, final=${finalEstimate}`,
		);
		return finalEstimate;
	}

	createTextChunks(textContent, batchCount) {
		if (batchCount === 1) {
			return [
				{
					content: textContent,
					batchNumber: 1,
					startIndex: 0,
					endIndex: textContent.length,
				},
			];
		}

		const chunks = [];
		const baseChunkSize = Math.floor(textContent.length / batchCount);

		for (let i = 0; i < batchCount; i++) {
			const start = i * baseChunkSize;
			let end =
				i === batchCount - 1 ? textContent.length : (i + 1) * baseChunkSize;

			// Find natural break points to avoid cutting questions in half
			if (i < batchCount - 1) {
				const searchEnd = end + 300; // Look ahead 300 chars
				const breakPoints = [
					textContent.indexOf("\n\n", end), // Paragraph break
					textContent.indexOf("\n\n\n", end), // Multiple line breaks
					textContent.lastIndexOf("\n\n", searchEnd), // Previous paragraph
					textContent.indexOf("Question", end), // Next question
					textContent.indexOf(/\d+\./, end), // Next numbered item
				].filter((pos) => pos > end && pos < searchEnd);

				if (breakPoints.length > 0) {
					end = Math.min(...breakPoints);
				}
			}

			// Ensure some overlap to avoid missing questions at boundaries
			const overlapSize = i > 0 ? 200 : 0;
			const actualStart = Math.max(0, start - overlapSize);

			chunks.push({
				content: textContent.slice(actualStart, end),
				batchNumber: i + 1,
				startIndex: actualStart,
				endIndex: end,
				hasOverlap: overlapSize > 0,
			});
		}

		console.log(`📝 Created ${chunks.length} text chunks`);
		return chunks;
	}

	// Main Processing Method with enhanced analysis and cancellation support
	async processPDFInBatches(pdfFile, textContent, pdfAnalysis = null) {
		try {
			// Create abort controller for cancellation
			this.abortController = new AbortController();
			this.currentOperation = `Processing ${pdfFile.name}`;

			console.log(`🚀 Starting batch processing for: ${pdfFile.name}`);

			// Generate PDF ID and check cache
			const pdfId = await this.db.generatePDFHash(textContent);
			const existingPDF = await this.db.getPDF(pdfId);

			if (existingPDF && existingPDF.isComplete) {
				console.log(`✅ PDF already processed: ${pdfFile.name}`);
				const questions = await this.db.getQuestions(pdfId);
				this.emit("cacheHit", { pdfId, questions, pdfData: existingPDF });
				return { pdfId, questions, fromCache: true };
			}

			let firstBatchQuestions = [];
			let totalBatches = 1;

			// Use simplified analysis if available
			if (pdfAnalysis && pdfAnalysis.metadata.hasQuestions) {
				console.log(
					`📊 Using PDF analysis: ${pdfAnalysis.metadata.estimatedQuestions} questions estimated`,
				);

				// Create intelligent chunks based on analysis
				const chunkData = this.createIntelligentChunks(pdfAnalysis);
				totalBatches = Math.max(1, chunkData.aiChunks.length);
			} else {
				// Fallback to basic processing
				const { batchSize, batchCount } = this.calculateBatchSize(textContent);
				totalBatches = batchCount;
			}

			// Store PDF metadata
			const pdfData = await this.db.storePDF({
				id: pdfId,
				filename: pdfFile.name,
				fileSize: pdfFile.size,
				textContent: textContent,
				totalQuestions: firstBatchQuestions.length,
				isComplete: false,
				processingStatus: "processing",
				batchCount: totalBatches,
				completedBatches: firstBatchQuestions.length > 0 ? 1 : 0,
			});

			// Process first chunk with AI immediately
			let chunks;
			if (pdfAnalysis && pdfAnalysis.metadata.hasQuestions) {
				chunks = this.createIntelligentChunks(pdfAnalysis).aiChunks;
			} else {
				chunks = this.createBasicChunks(textContent);
			}

			console.log(`⚡ Processing first batch with AI (priority)...`);
			const aiBatch = await this.processChunk(chunks[0], pdfId, true);

			if (aiBatch && aiBatch.length > 0) {
				await this.db.storeQuestions(pdfId, aiBatch, 1);
				await this.db.updatePDFProgress(pdfId, 1);

				console.log(`✅ First batch ready: ${aiBatch.length} questions`);
				this.emit("firstBatchReady", {
					pdfId,
					questions: aiBatch,
					totalBatches: totalBatches,
					completedBatches: 1,
					pdfData: pdfData,
				});

				firstBatchQuestions = aiBatch;
			}

			// Queue remaining chunks for background processing
			if (chunks.length > 1) {
				this.queueRemainingBatches(chunks.slice(1), pdfId);
			}

			// Complete if no background processing needed
			if (totalBatches === 1) {
				await this.db.completePDFProcessing(pdfId);
				this.emit("processingComplete", { pdfId });
			}

			return {
				pdfId,
				questions: firstBatchQuestions,
				fromCache: false,
				totalBatches: totalBatches,
			};
		} catch (error) {
			if (error.name === "AbortError") {
				console.log("🛑 Processing cancelled by user");
				this.emit("processingCancelled", { pdfFile });
				return null;
			}
			console.error("❌ Batch processing failed:", error);
			this.emit("processingError", { error, pdfFile });
			throw error;
		} finally {
			this.abortController = null;
			this.currentOperation = null;
		}
	}

	async processChunk(chunk, pdfId, isPriority = false) {
		try {
			const chunkPrefix = isPriority
				? "🔥 PRIORITY"
				: `📦 BATCH ${chunk.batchNumber}`;
			console.log(
				`${chunkPrefix} Processing chunk: ${chunk.content.length} chars`,
			);

			// Create optimized prompt for chunk processing
			const prompt = this.createChunkPrompt(
				chunk.content,
				chunk.batchNumber,
				chunk.hasOverlap,
			);

			// Use AI to extract questions
			const questions = await this.ai.generateQuestionsFromText(
				chunk.content,
				prompt,
			);

			if (!questions || questions.length === 0) {
				console.warn(
					`⚠️ No questions extracted from batch ${chunk.batchNumber}`,
				);
				return [];
			}

			// Add batch metadata to questions
			const processedQuestions = questions.map((q, index) => ({
				...q,
				id: (chunk.batchNumber - 1) * 20 + index + 1,
				batchNumber: chunk.batchNumber,
				source: "ai",
			}));

			console.log(
				`✅ Extracted ${processedQuestions.length} questions from batch ${chunk.batchNumber}`,
			);
			return processedQuestions;
		} catch (error) {
			console.error(
				`❌ Chunk processing failed (batch ${chunk.batchNumber}):`,
				error,
			);

			// Return mock questions to prevent total failure
			return this.createMockQuestions(chunk.batchNumber, 3);
		}
	}

	createChunkPrompt(content, batchNumber, hasOverlap) {
		const overlapNote = hasOverlap
			? "\n⚠️ NOTE: This chunk has some overlap with the previous chunk. Avoid extracting duplicate questions."
			: "";

		return `Extract ALL multiple choice questions from this text chunk (Batch ${batchNumber}).
		
${overlapNote}

CRITICAL REQUIREMENTS:
- Extract EVERY complete multiple choice question found
- Each question must have exactly 4 options (A, B, C, D)
- Provide the correct answer index (0=A, 1=B, 2=C, 3=D)
- Include detailed explanations for correct answers
- Maintain original question numbering if present
- Skip incomplete or unclear questions

TEXT TO ANALYZE:
${content}

Return ONLY a valid JSON array with this exact structure:
[
  {
    "question": "Complete question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Detailed explanation of why this answer is correct"
  }
]`;
	}

	// Background Processing Queue
	queueRemainingBatches(chunks, pdfId) {
		console.log(
			`📋 Queuing ${chunks.length} batches for background processing`,
		);

		chunks.forEach((chunk) => {
			this.processingQueue.push({
				chunk,
				pdfId,
				priority: "background",
				timestamp: Date.now(),
			});
		});

		// Start processing if not already running
		if (!this.isProcessing) {
			this.processQueue();
		}
	}

	async processQueue() {
		if (this.processingQueue.length === 0) {
			this.isProcessing = false;
			return;
		}

		this.isProcessing = true;

		while (this.processingQueue.length > 0) {
			const job = this.processingQueue.shift();

			try {
				console.log(
					`🔄 Processing background job: PDF ${job.pdfId.substring(0, 8)}... batch ${job.chunk.batchNumber}`,
				);

				// Enforce rate limiting
				await this.enforceRateLimit();

				// Process the chunk
				const questions = await this.processChunk(job.chunk, job.pdfId, false);

				if (questions && questions.length > 0) {
					// Store questions in database
					await this.db.storeQuestions(
						job.pdfId,
						questions,
						job.chunk.batchNumber,
					);

					// Update progress
					await this.db.updatePDFProgress(job.pdfId, job.chunk.batchNumber);

					// Get updated question count
					const totalQuestions = await this.db.getQuestionCount(job.pdfId);

					this.emit("batchCompleted", {
						pdfId: job.pdfId,
						batchNumber: job.chunk.batchNumber,
						questions: questions,
						newTotal: totalQuestions,
					});
				}

				// Check if all batches are complete
				const pdfData = await this.db.getPDF(job.pdfId);
				if (pdfData && pdfData.completedBatches >= pdfData.batchCount) {
					await this.db.completePDFProcessing(job.pdfId);
					this.emit("processingComplete", { pdfId: job.pdfId });
				}
			} catch (error) {
				console.error(`❌ Background job failed:`, error);
				this.emit("batchError", {
					pdfId: job.pdfId,
					batchNumber: job.chunk.batchNumber,
					error,
				});
			}
		}

		this.isProcessing = false;
		console.log("✅ Background processing queue completed");
	}

	async enforceRateLimit() {
		// Conservative rate limiting: 12 requests per minute (5 second intervals)
		const now = Date.now();
		const timeSinceLastRequest = now - (this.lastRequestTime || 0);

		if (timeSinceLastRequest < this.rateLimitDelay) {
			const waitTime = this.rateLimitDelay - timeSinceLastRequest;
			console.log(`⏳ Rate limiting: waiting ${waitTime}ms`);
			await new Promise((resolve) => setTimeout(resolve, waitTime));
		}

		this.lastRequestTime = Date.now();
	}

	// Utility Methods
	createMockQuestions(batchNumber, count = 3) {
		const mockQuestions = [];

		for (let i = 1; i <= count; i++) {
			mockQuestions.push({
				id: (batchNumber - 1) * 20 + i,
				question: `Sample question ${i} from batch ${batchNumber} (AI extraction failed)`,
				options: [
					"This is option A",
					"This is option B",
					"This is option C",
					"This is option D",
				],
				correctAnswer: 0,
				explanation:
					"This is a mock question created when AI extraction failed. The actual questions could not be processed.",
				batchNumber: batchNumber,
				source: "mock",
			});
		}

		return mockQuestions;
	}

	// Event System
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

	// Public API for getting processing status
	async getProcessingStatus(pdfId) {
		const pdfData = await this.db.getPDF(pdfId);
		const questionCount = await this.db.getQuestionCount(pdfId);

		return {
			pdfData,
			questionCount,
			progress: pdfData
				? (pdfData.completedBatches / pdfData.batchCount) * 100
				: 0,
			isComplete: pdfData ? pdfData.isComplete : false,
		};
	}

	// Create basic chunks (fallback method)
	createBasicChunks(textContent) {
		const { batchSize, batchCount } = this.calculateBatchSize(textContent);
		return this.createTextChunks(textContent, batchCount);
	}

	// Create intelligent chunks from PDF analysis (simplified)
	createIntelligentChunks(pdfAnalysis) {
		// Use the analyzer's built-in chunking
		return pdfAnalysis.createIntelligentChunks
			? pdfAnalysis.createIntelligentChunks()
			: {
					aiChunks: [
						{
							content: pdfAnalysis.textContent,
							estimatedQuestions: pdfAnalysis.metadata.estimatedQuestions,
							type: "ai_processing",
						},
					],
				};
	}

	// Cancel current processing
	cancelProcessing() {
		if (this.abortController) {
			console.log("🛑 Cancelling current processing operation...");
			this.abortController.abort();
			this.currentOperation = null;
		}

		// Clear the queue
		this.clearQueue();

		this.emit("processingCancelled", {
			message: "Processing cancelled by user",
			operation: this.currentOperation,
		});
	}

	// Get current processing status
	getProcessingStatus() {
		return {
			isProcessing: this.isProcessing,
			currentOperation: this.currentOperation,
			queueLength: this.processingQueue.length,
			canCancel: this.abortController !== null,
		};
	}

	// Clear processing queue (useful for cleanup)
	clearQueue() {
		this.processingQueue = [];
		this.isProcessing = false;
		console.log("🧹 Processing queue cleared");
	}
}

export { BatchProcessor };
