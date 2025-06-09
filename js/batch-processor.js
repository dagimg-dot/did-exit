// Batch Processing Manager for Progressive PDF Question Extraction with AI
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

	// Simplified chunking for AI processing
	createTextChunks(textContent, questionsPerBatch = 15) {
		console.log(`📝 Creating chunks for ${textContent.length} characters`);

		// For smaller documents (under 50k chars), process in one go
		if (textContent.length < 50000) {
			return [
				{
					content: textContent,
					batchNumber: 1,
					isFirstBatch: true,
				},
			];
		}

		// For larger documents, create meaningful chunks
		const estimatedWords = textContent.split(/\s+/).length;
		const wordsPerChunk = Math.max(5000, Math.floor(estimatedWords / 4)); // Max 4 chunks

		const chunks = [];
		const words = textContent.split(/\s+/);

		for (let i = 0; i < words.length; i += wordsPerChunk) {
			const chunkWords = words.slice(i, i + wordsPerChunk);
			const chunkContent = chunkWords.join(" ");

			chunks.push({
				content: chunkContent,
				batchNumber: chunks.length + 1,
				isFirstBatch: chunks.length === 0,
				wordsCount: chunkWords.length,
			});

			// Limit to 4 chunks to respect rate limits
			if (chunks.length >= 4) break;
		}

		console.log(
			`📊 Created ${chunks.length} chunks, first chunk: ${chunks[0].wordsCount} words`,
		);
		return chunks;
	}

	// Main Processing Method - Simplified AI-only approach
	async processPDFInBatches(pdfFile, textContent) {
		try {
			// Create abort controller for cancellation
			this.abortController = new AbortController();
			this.currentOperation = `Processing ${pdfFile.name}`;

			console.log(`🚀 Starting AI-only batch processing for: ${pdfFile.name}`);

			// Generate PDF ID and check cache
			const pdfId = await this.db.generatePDFHash(textContent);
			const existingPDF = await this.db.getPDF(pdfId);

			if (existingPDF && existingPDF.isComplete) {
				console.log(`✅ PDF already processed: ${pdfFile.name}`);
				const questions = await this.db.getQuestions(pdfId);
				this.emit("cacheHit", { pdfId, questions, pdfData: existingPDF });
				return { pdfId, questions, fromCache: true };
			}

			// Create text chunks for AI processing
			const chunks = this.createTextChunks(textContent);
			const totalBatches = chunks.length;

			console.log(`📋 Will process ${totalBatches} batches with AI`);

			// Store PDF metadata
			await this.db.storePDF({
				id: pdfId,
				filename: pdfFile.name,
				fileSize: pdfFile.size,
				textContent: textContent,
				totalQuestions: 0,
				isComplete: false,
				processingStatus: "processing",
				batchCount: totalBatches,
				completedBatches: 0,
			});

			// Process first chunk immediately with AI
			console.log(`⚡ Processing first batch with AI...`);
			const firstBatch = chunks[0];
			const firstBatchQuestions = await this.processChunkWithAI(
				firstBatch,
				pdfId,
			);

			if (this.abortController?.signal.aborted) {
				console.log("🛑 Processing cancelled during first batch");
				return null;
			}

			if (firstBatchQuestions && firstBatchQuestions.length > 0) {
				// Store first batch results
				await this.db.storeQuestions(pdfId, firstBatchQuestions, 1);
				await this.db.updatePDFProgress(pdfId, 1);

				console.log(
					`✅ First batch ready: ${firstBatchQuestions.length} questions`,
				);

				// Emit first batch ready event
				this.emit("firstBatchReady", {
					pdfId,
					questions: firstBatchQuestions,
					batchNumber: 1,
					totalBatches,
					completedBatches: 1,
				});

				// Queue remaining batches for background processing
				if (chunks.length > 1) {
					this.queueRemainingBatches(chunks.slice(1), pdfId, totalBatches);
				} else {
					// Mark as complete if only one batch
					await this.db.markPDFComplete(pdfId);
					this.emit("processingComplete", {
						pdfId,
						totalQuestions: firstBatchQuestions.length,
					});
				}

				return { pdfId, questions: firstBatchQuestions, fromCache: false };
			} else {
				throw new Error(
					"First batch generated no questions. The content might not contain extractable questions.",
				);
			}
		} catch (error) {
			console.error("Batch processing error:", error);
			this.emit("processingError", error);
			throw error;
		}
	}

	// Process a single chunk with AI
	async processChunkWithAI(chunk, pdfId) {
		try {
			console.log(
				`🤖 Processing batch ${chunk.batchNumber} with AI (${chunk.wordsCount || "unknown"} words)`,
			);

			// Check for cancellation
			if (this.abortController?.signal.aborted) {
				console.log("🛑 Processing cancelled");
				return null;
			}

			// Create AI prompt for this chunk
			const prompt = this.createAIPrompt(chunk);

			// Process with AI
			const questions = await this.ai.generateQuestionsFromText(
				chunk.content,
				prompt,
			);

			if (questions && questions.length > 0) {
				console.log(
					`✅ Generated ${questions.length} questions from batch ${chunk.batchNumber}`,
				);
				return questions;
			} else {
				console.warn(
					`⚠️ No questions generated from batch ${chunk.batchNumber}`,
				);
				return [];
			}
		} catch (error) {
			console.error(`❌ Error processing batch ${chunk.batchNumber}:`, error);

			// Return empty array instead of throwing to allow other batches to continue
			return [];
		}
	}

	// Create optimized AI prompt for chunk processing
	createAIPrompt(chunk) {
		return `Extract ALL multiple choice questions from this content. Focus on creating high-quality educational questions.

IMPORTANT INSTRUCTIONS:
- Extract ALL existing questions if they're already in the content
- If no questions exist, create relevant questions from the key concepts
- Each question must have exactly 4 options (A, B, C, D)
- Provide the correct answer index (0-3)
- Include brief explanations

Format as JSON:
{
  "questions": [
    {
      "id": 1,
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Why this answer is correct"
    }
  ]
}

Batch ${chunk.batchNumber} content:
${chunk.content}`;
	}

	// Queue remaining batches for background processing
	async queueRemainingBatches(remainingChunks, pdfId, totalBatches) {
		console.log(
			`📋 Queuing ${remainingChunks.length} remaining batches for background processing`,
		);

		for (const chunk of remainingChunks) {
			this.processingQueue.push({
				chunk,
				pdfId,
				totalBatches,
				type: "ai-batch",
			});
		}

		// Start background processing
		if (!this.isProcessing) {
			this.processQueue();
		}
	}

	// Background queue processor
	async processQueue() {
		if (this.isProcessing || this.processingQueue.length === 0) {
			return;
		}

		this.isProcessing = true;
		console.log(
			`⚙️ Starting background processing of ${this.processingQueue.length} items`,
		);

		while (
			this.processingQueue.length > 0 &&
			!this.abortController?.signal.aborted
		) {
			const item = this.processingQueue.shift();

			try {
				// Enforce rate limiting
				await this.enforceRateLimit();

				// Process the chunk
				const questions = await this.processChunkWithAI(item.chunk, item.pdfId);

				if (questions && questions.length > 0) {
					// Store results
					await this.db.storeQuestions(
						item.pdfId,
						questions,
						item.chunk.batchNumber,
					);
					await this.db.updatePDFProgress(item.pdfId, item.chunk.batchNumber);

					// Get updated question count
					const allQuestions = await this.db.getQuestions(item.pdfId);

					// Emit batch completed event
					this.emit("batchCompleted", {
						pdfId: item.pdfId,
						batchNumber: item.chunk.batchNumber,
						questions: questions,
						newTotal: allQuestions.length,
						completedBatches: item.chunk.batchNumber,
						totalBatches: item.totalBatches,
					});
				}

				// Check if this was the last batch
				if (this.processingQueue.length === 0) {
					await this.db.markPDFComplete(item.pdfId);
					const finalQuestions = await this.db.getQuestions(item.pdfId);

					this.emit("processingComplete", {
						pdfId: item.pdfId,
						totalQuestions: finalQuestions.length,
					});
				}
			} catch (error) {
				console.error(
					`Error processing background batch ${item.chunk.batchNumber}:`,
					error,
				);
				// Continue with next item rather than stopping entire queue
			}
		}

		this.isProcessing = false;

		if (this.abortController?.signal.aborted) {
			console.log("🛑 Background processing cancelled");
			this.emit("processingCancelled", { reason: "user_cancelled" });
		}
	}

	// Rate limiting for AI requests
	async enforceRateLimit() {
		const now = Date.now();
		if (
			this.lastRequestTime &&
			now - this.lastRequestTime < this.rateLimitDelay
		) {
			const waitTime = this.rateLimitDelay - (now - this.lastRequestTime);
			console.log(`⏱️ Rate limiting: waiting ${Math.ceil(waitTime / 1000)}s...`);
			await new Promise((resolve) => setTimeout(resolve, waitTime));
		}
		this.lastRequestTime = now;
	}

	// Cancellation support
	cancelProcessing() {
		console.log("🛑 Cancelling batch processing...");

		if (this.abortController) {
			this.abortController.abort();
		}

		// Clear the queue
		this.processingQueue = [];
		this.isProcessing = false;
		this.currentOperation = null;

		this.emit("processingCancelled", { reason: "user_cancelled" });
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

	// Status helpers
	getProcessingStatus() {
		return {
			isProcessing: this.isProcessing,
			queueLength: this.processingQueue.length,
			currentOperation: this.currentOperation,
		};
	}
}

export { BatchProcessor };
