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

		// Estimate question count based on content patterns
		const estimatedQuestions = this.estimateQuestionCount(textContent);
		console.log(`📊 Estimated ${estimatedQuestions} questions in document`);

		// For documents with many questions or large content, always split
		if (estimatedQuestions > 20 || textContent.length > 25000) {
			console.log(
				`📋 Large document detected - will split into multiple batches`,
			);
			return this.createMultipleBatches(textContent, estimatedQuestions);
		}

		// For smaller documents (under 25k chars AND estimated < 20 questions), process in one go
		if (textContent.length < 25000 && estimatedQuestions <= 20) {
			console.log(`📋 Small document - processing in single batch`);
			return [
				{
					content: textContent,
					batchNumber: 1,
					isFirstBatch: true,
				},
			];
		}

		// Default to splitting for safety
		return this.createMultipleBatches(textContent, estimatedQuestions);
	}

	// Estimate question count using multiple heuristics
	estimateQuestionCount(textContent) {
		const questionPatterns = [
			/\d+[\.\)]\s+[A-Z]/g, // 1. Question or 1) Question
			/Question\s+\d+/gi, // "Question 1", "Question 2"
			/^\s*\d+\.\s+/gm, // Numbered items starting lines
			/\?\s*$/gm, // Lines ending with ?
		];

		let maxCount = 0;
		questionPatterns.forEach((pattern) => {
			const matches = textContent.match(pattern) || [];
			maxCount = Math.max(maxCount, matches.length);
		});

		// Use multiple choice indicators as confirmation
		const mcMarkers = [
			/^\s*[A-Ea-e][\.\)]/gm, // A. B. C. D. E. options
			/^\s*\([A-Ea-e]\)/gm, // (A) (B) (C) (D) (E) options
		];

		let optionCount = 0;
		mcMarkers.forEach((pattern) => {
			const matches = textContent.match(pattern) || [];
			optionCount += matches.length;
		});

		// If we have 4x more options than questions, that's a good sign
		const mcQuestionEstimate = Math.floor(optionCount / 4);

		// Use the higher estimate but cap at reasonable limits
		const finalEstimate = Math.min(
			150,
			Math.max(10, maxCount, mcQuestionEstimate),
		);

		console.log(
			`🔍 Question estimation: numbered=${maxCount}, mc=${mcQuestionEstimate}, final=${finalEstimate}`,
		);
		return finalEstimate;
	}

	// Create multiple batches for larger documents
	createMultipleBatches(textContent, estimatedQuestions) {
		// Target 15-25 questions per batch
		const questionsPerBatch = 20;
		const targetBatches = Math.min(
			5,
			Math.max(2, Math.ceil(estimatedQuestions / questionsPerBatch)),
		);

		console.log(
			`📊 Creating ${targetBatches} batches for ${estimatedQuestions} estimated questions`,
		);

		// For larger documents, create meaningful chunks
		const estimatedWords = textContent.split(/\s+/).length;
		const wordsPerChunk = Math.floor(estimatedWords / targetBatches);

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

			// Don't exceed target batch count
			if (chunks.length >= targetBatches) {
				// Add remaining words to last chunk
				if (i + wordsPerChunk < words.length) {
					const remainingWords = words.slice(i + wordsPerChunk);
					chunks[chunks.length - 1].content += " " + remainingWords.join(" ");
					chunks[chunks.length - 1].wordsCount += remainingWords.length;
				}
				break;
			}
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
				console.log(
					`📦 Retrieved ${questions.length} questions from cache (from ${existingPDF.batchCount} batches)`,
				);

				// Verify we have questions from all expected batches
				const batchCounts = {};
				questions.forEach((q) => {
					batchCounts[q.batchNumber] = (batchCounts[q.batchNumber] || 0) + 1;
				});
				console.log(`📊 Questions per batch from cache:`, batchCounts);

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
				`🤖 Processing batch ${chunk.batchNumber} with AI (${
					chunk.wordsCount || "unknown"
				} words)`,
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
				// Check if any explanations indicate provided answers were found
				const providedAnswers = questions.filter(
					(q) =>
						q.explanation &&
						(q.explanation.toLowerCase().includes("answer provided") ||
							q.explanation.toLowerCase().includes("provided in source") ||
							q.explanation.toLowerCase().includes("given answer")),
				);

				if (providedAnswers.length > 0) {
					console.log(
						`✨ Found ${providedAnswers.length} questions with provided answers in batch ${chunk.batchNumber}`,
					);
				}

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
- LOOK FOR CORRECT ANSWERS: Many exam PDFs have the correct answer right after the question (e.g., "Answer: A", "Correct Answer: B", "Ans: C")
- If a correct answer is provided in the text, USE THAT as the correctAnswer index
- If no answer is provided, use your knowledge to determine the most likely correct answer
- Handle 4 OR 5 options dynamically (A, B, C, D) OR (A, B, C, D, E)
- Provide the correct answer index where 0=A, 1=B, 2=C, 3=D, 4=E
- Include brief explanations

FORMAT AS JSON:
{
  "questions": [
    {
      "id": 1,
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D", "Option E"],
      "correctAnswer": 0,
      "explanation": "Why this answer is correct"
    }
  ]
}

ANSWER DETECTION PATTERNS:
- Look for: "Answer: A", "Ans: B", "Correct Answer: C", "Answer is D", "Answer: E"
- Look for: "(A)", "(B)", "(C)", "(D)", "(E)" after questions
- Look for: "The answer is A", "Correct option: B"
- Convert A=0, B=1, C=2, D=3, E=4 for the correctAnswer field

OPTION HANDLING:
- If question has 4 options (A-D), provide exactly 4 options
- If question has 5 options (A-E), provide exactly 5 options
- DO NOT pad 4-option questions to 5, and DO NOT truncate 5-option questions to 4
- Preserve the original number of options from the source

EXTRACTION PRIORITY:
1. Use provided answers from the text when available
2. If no answer provided, make educated guess based on content
3. Always provide an explanation regardless of whether answer was given or guessed

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

					// Get updated question count and debug info
					const allQuestions = await this.db.getQuestions(item.pdfId);
					await this.db.getAllQuestionsDebug(item.pdfId); // Debug logging

					// Emit batch completed event
					this.emit("batchCompleted", {
						pdfId: item.pdfId,
						batchNumber: item.chunk.batchNumber,
						questions: questions,
						newTotal: allQuestions.length,
						completedBatches: item.chunk.batchNumber,
						totalBatches: item.totalBatches,
					});

					// Check if ALL batches are actually completed (not just queue empty)
					console.log(
						`✅ Batch ${item.chunk.batchNumber} of ${item.totalBatches} completed and stored`,
					);

					// Only mark complete when we've processed the last batch number
					if (item.chunk.batchNumber === item.totalBatches) {
						console.log(
							`🎉 All ${item.totalBatches} batches completed! Marking PDF as complete.`,
						);
						await this.db.markPDFComplete(item.pdfId);
						const finalQuestions = await this.db.getQuestions(item.pdfId);

						this.emit("processingComplete", {
							pdfId: item.pdfId,
							totalQuestions: finalQuestions.length,
						});
					}
				} else {
					console.warn(
						`⚠️ No questions generated for batch ${item.chunk.batchNumber}, but continuing...`,
					);

					// Still check for completion even if this batch was empty
					if (item.chunk.batchNumber === item.totalBatches) {
						console.log(
							`🎉 Reached final batch ${item.totalBatches}. Marking PDF as complete.`,
						);
						await this.db.markPDFComplete(item.pdfId);
						const finalQuestions = await this.db.getQuestions(item.pdfId);

						this.emit("processingComplete", {
							pdfId: item.pdfId,
							totalQuestions: finalQuestions.length,
						});
					}
				}
			} catch (error) {
				console.error(
					`Error processing background batch ${item.chunk.batchNumber}:`,
					error,
				);

				// Even if there's an error, check if we need to mark as complete
				if (item.chunk.batchNumber === item.totalBatches) {
					console.log(
						`🎉 Reached final batch ${item.totalBatches} (with error). Marking PDF as complete.`,
					);
					await this.db.markPDFComplete(item.pdfId);
					const finalQuestions = await this.db.getQuestions(item.pdfId);

					this.emit("processingComplete", {
						pdfId: item.pdfId,
						totalQuestions: finalQuestions.length,
					});
				}
			}
		}

		this.isProcessing = false;

		if (this.abortController?.signal.aborted) {
			console.log("🛑 Background processing cancelled");
			this.emit("processingCancelled", { reason: "user_cancelled" });
		}

		console.log("✅ Background processing queue completed");
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
