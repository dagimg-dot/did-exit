// Google Generative AI Integration
const LIST_MODELS_BASE =
	"https://generativelanguage.googleapis.com/v1beta/models";

class AIIntegration {
	constructor() {
		this.events = {};
		this.apiKey = null;
		this.modelId = null;
		this.model = null;
		this.lastRequestTime = 0;
		this.requestCount = 0;
		this.requestWindow = 60000; // 1 minute in milliseconds
		this.loadAPIKeyFromStorage();
		this.initializeAPI();
	}

	loadAPIKeyFromStorage() {
		this.apiKey = localStorage.getItem("google-ai-api-key");
		this.modelId = localStorage.getItem("google-ai-model-id");
		if (!this.apiKey) {
			console.warn(
				"⚠️ No API key found in storage. Please configure your Google AI API key.",
			);
		}
	}

	/** Prefer Gemini Flash-style models for default ordering (dropdown + auto-pick). */
	sortModelsForDefault(models) {
		const score = (id) => {
			const lower = id.toLowerCase();
			let s = 0;
			if (lower.includes("gemini")) s += 10;
			if (lower.includes("flash")) s += 5;
			if (lower.includes("preview")) s -= 1;
			return s;
		};
		return [...models].sort((a, b) => score(b.id) - score(a.id));
	}

	/**
	 * List models that support generateContent for this API key.
	 * @returns {Promise<Array<{ id: string, displayName: string }>>}
	 */
	async listModels(apiKey) {
		const collected = [];
		let pageToken = null;
		do {
			const url = new URL(LIST_MODELS_BASE);
			url.searchParams.set("key", apiKey);
			url.searchParams.set("pageSize", "100");
			if (pageToken) {
				url.searchParams.set("pageToken", pageToken);
			}
			const res = await fetch(url.toString());
			if (!res.ok) {
				const body = await res.text();
				throw new Error(
					`List models failed (${res.status}): ${body || res.statusText}`,
				);
			}
			const data = await res.json();
			const raw = data.models || [];
			for (const m of raw) {
				if (
					!m.supportedGenerationMethods?.includes("generateContent")
				) {
					continue;
				}
				const id = (m.name || "").replace(/^models\//, "");
				if (!id) {
					continue;
				}
				collected.push({
					id,
					displayName: m.displayName || id,
				});
			}
			pageToken = data.nextPageToken || null;
		} while (pageToken);
		return this.sortModelsForDefault(collected);
	}

	setSelectedModel(modelId) {
		if (modelId) {
			localStorage.setItem("google-ai-model-id", modelId);
			this.modelId = modelId;
		} else {
			localStorage.removeItem("google-ai-model-id");
			this.modelId = null;
		}
		this.model = null;
		return this.initializeAPI();
	}

	async initializeAPI() {
		this.model = null;
		if (!this.apiKey || this.apiKey === "YOUR_GOOGLE_AI_API_KEY_HERE") {
			console.warn(
				"⚠️ Please set your Google AI API key using the configuration panel",
			);
			return;
		}

		try {
			await this.loadGoogleAI();

			const { GoogleGenerativeAI } = await import(
				"https://esm.run/@google/generative-ai"
			);
			const genAI = new GoogleGenerativeAI(this.apiKey);

			const list = await this.listModels(this.apiKey);
			if (list.length === 0) {
				throw new Error(
					"No models with generateContent are available for this API key.",
				);
			}

			let resolvedId = this.modelId;
			const known = list.some((m) => m.id === resolvedId);
			if (!resolvedId || !known) {
				if (resolvedId && !known) {
					console.warn(
						`Stored model "${resolvedId}" is not available; using ${list[0].id}.`,
					);
				}
				resolvedId = list[0].id;
				localStorage.setItem("google-ai-model-id", resolvedId);
				this.modelId = resolvedId;
			}

			this.model = genAI.getGenerativeModel({ model: resolvedId });
			console.log(`✅ Google AI initialized with model: ${resolvedId}`);
		} catch (error) {
			console.error("Failed to initialize Google AI:", error);
			console.log("App will use mock questions instead");
		}
	}

	async loadGoogleAI() {
		// For demo purposes, we'll create a mock implementation
		// In production, you would load the actual Google AI SDK
		return Promise.resolve();
	}

	// Rate limiting helper for free tier
	async enforceRateLimit() {
		const now = Date.now();
		const timeSinceLastRequest = now - this.lastRequestTime;

		// Reset counter if more than a minute has passed
		if (timeSinceLastRequest > this.requestWindow) {
			this.requestCount = 0;
		}

		// Free tier: ~15 requests per minute max, so we'll be conservative with 12
		if (
			this.requestCount >= 12 &&
			timeSinceLastRequest < this.requestWindow
		) {
			const waitTime = this.requestWindow - timeSinceLastRequest;
			console.log(
				`⏱️ Rate limiting: waiting ${Math.ceil(waitTime / 1000)}s...`,
			);
			await new Promise((resolve) => setTimeout(resolve, waitTime));
			this.requestCount = 0;
		}

		this.requestCount++;
		this.lastRequestTime = Date.now();
	}

	async generateQuestions(extractedText) {
		try {
			if (!this.model && this.apiKey !== "YOUR_GOOGLE_AI_API_KEY_HERE") {
				await this.initializeAPI();
			}

			let questions;

			if (this.model) {
				// Enforce rate limiting for free tier
				await this.enforceRateLimit();

				// Use real Google AI
				questions = await this.generateWithGoogleAI(extractedText);
			} else {
				// Use mock data for demo
				questions = this.generateMockQuestions(extractedText);
			}

			this.emit("questionsGenerated", questions);
			return questions;
		} catch (error) {
			console.error("Question generation error:", error);

			// If rate limited, provide helpful message
			if (error.message?.includes("rate")) {
				console.log("📝 Rate limit hit - trying again in a moment...");
				await new Promise((resolve) => setTimeout(resolve, 5000));
				return this.generateMockQuestions(extractedText);
			}

			this.emit("error", error);
			throw error;
		}
	}

	async generateWithGoogleAI(extractedText) {
		// Optimized prompt for free tier and better extraction
		const prompt = `
        You are an expert quiz generator. Extract and create interactive multiple-choice questions from the following PDF content.

        IMPORTANT: Extract ALL questions found in the document, not just a limited number. If the document contains many questions, extract them all.

        Please format your response as valid JSON with this structure:
        {	
            "questions": [
                {
                    "id": 1,
                    "question": "Question text here?",
                    "options": [
                        "Option A text",
                        "Option B text", 
                        "Option C text",
                        "Option D text"
                    ],
                    "correctAnswer": 0,
                    "explanation": "Brief explanation of why this is correct"
                }
            ]
        }

        Guidelines:
        - Extract ALL questions from the document (don't limit to 10)
        - Each question should have 4-5 options (preserve original count)
        - correctAnswer should be the index (0-3 for 4 options, 0-4 for 5 options)
        - CRITICALLY IMPORTANT: Carefully analyze each option to determine the correct answer. Consider:
          * Which option directly answers the question based on the document content
          * Eliminate options that are partially correct but not the best answer
          * Check for subtle differences between similar-looking options
          * Verify that your selected answer aligns with the document information
        - Provide clear, educational explanations that justify why the chosen option is correct and others are incorrect
        - If the document has existing questions, use them; if not, create relevant questions from the content
        - Maintain academic accuracy and clarity
        - Double-check your work before finalizing answers

        Content to analyze (truncated to fit 1M token limit):
        ${extractedText.substring(0, 800000)} ${extractedText.length > 800000 ? "\n\n[Content truncated due to length...]" : ""}
        `;

		try {
			console.log(
				`🔄 Sending request to Gemini AI (${extractedText.length} chars)...`,
			);

			const result = await this.model.generateContent(prompt);
			const response = await result.response;
			const text = response.text();

			console.log(
				`✅ Received response from Gemini AI (${text.length} chars)`,
			);

			// Clean the response text to extract JSON
			let jsonText = text;
			if (text.includes("```json")) {
				jsonText =
					text.match(/```json\s*([\s\S]*?)\s*```/)?.[1] || text;
			} else if (text.includes("```")) {
				jsonText = text.match(/```\s*([\s\S]*?)\s*```/)?.[1] || text;
			}

			// Additional cleaning for common JSON issues
			jsonText = jsonText.trim();

			// Find the JSON object bounds more reliably
			const firstBrace = jsonText.indexOf("{");
			const lastBrace = jsonText.lastIndexOf("}");

			if (
				firstBrace === -1 ||
				lastBrace === -1 ||
				firstBrace >= lastBrace
			) {
				throw new Error("No valid JSON object found in response");
			}

			jsonText = jsonText.substring(firstBrace, lastBrace + 1);

			// Validate JSON structure before parsing
			if (!jsonText.includes('"questions"')) {
				throw new Error(
					"Response doesn't contain expected 'questions' field",
				);
			}

			let parsed;
			try {
				parsed = JSON.parse(jsonText);
			} catch (parseError) {
				console.warn(
					"Initial JSON parse failed, attempting to fix common issues...",
				);

				// Try to fix common JSON issues
				let fixedJson = jsonText
					// Fix trailing commas
					.replace(/,\s*}/g, "}")
					.replace(/,\s*]/g, "]")
					// Fix unescaped quotes in strings (basic attempt)
					.replace(
						/": "([^"]*)"([^"]*)"([^"]*)",/g,
						'": "$1\\"$2\\"$3",',
					)
					// Remove any trailing incomplete objects/arrays
					.replace(/,\s*$/, "");

				// If it ends abruptly, try to close it properly
				const openBraces = (fixedJson.match(/{/g) || []).length;
				let closeBraces = (fixedJson.match(/}/g) || []).length;
				const openBrackets = (fixedJson.match(/\[/g) || []).length;
				let closeBrackets = (fixedJson.match(/]/g) || []).length;

				// Add missing closing brackets/braces
				while (closeBrackets < openBrackets) {
					fixedJson += "]";
					closeBrackets++;
				}
				while (closeBraces < openBraces) {
					fixedJson += "}";
					closeBraces++;
				}

				try {
					parsed = JSON.parse(fixedJson);
					console.log("✅ JSON fixed successfully");
				} catch (secondParseError) {
					console.error("JSON fixing failed:", secondParseError);
					throw new Error(
						`Failed to parse JSON response: ${parseError.message}`,
					);
				}
			}

			const questions = parsed.questions || [];

			if (!Array.isArray(questions)) {
				throw new Error("Questions field is not an array");
			}

			if (questions.length === 0) {
				console.warn(
					"No questions found in response, generating mock questions",
				);
				return this.generateMockQuestions(extractedText);
			}

			// Validate question structure
			const validQuestions = questions.filter((q, index) => {
				if (
					!q.question ||
					!Array.isArray(q.options) ||
					typeof q.correctAnswer !== "number"
				) {
					console.warn(
						`Question ${index + 1} has invalid structure, skipping`,
					);
					return false;
				}
				if (q.options.length < 4 || q.options.length > 5) {
					console.warn(
						`Question ${index + 1} has ${q.options.length} options (should be 4-5), skipping`,
					);
					return false;
				}
				if (
					q.correctAnswer < 0 ||
					q.correctAnswer >= q.options.length
				) {
					console.warn(
						`Question ${index + 1} has invalid correctAnswer index ${q.correctAnswer} for ${q.options.length} options, skipping`,
					);
					return false;
				}
				return true;
			});

			console.log(
				`📝 Successfully extracted ${validQuestions.length} valid questions (${questions.length - validQuestions.length} invalid skipped)`,
			);
			return validQuestions;
		} catch (error) {
			console.error(
				"Failed to generate questions with Google AI:",
				error,
			);
			console.log("🔄 Falling back to mock questions...");
			return this.generateMockQuestions(extractedText);
		}
	}

	generateMockQuestions(extractedText) {
		// Enhanced mock questions for demo purposes
		const baseQuestions = [
			{
				id: 1,
				question:
					"Based on the content provided, which of the following best describes the main topic?",
				options: [
					"Technical documentation",
					"Academic examination material",
					"General knowledge content",
					"Research methodology",
				],
				correctAnswer: 1,
				explanation:
					"The content appears to be from an academic examination based on its structure and format.",
			},
			{
				id: 2,
				question:
					"What is the most important aspect to consider when analyzing this type of document?",
				options: [
					"Length of the document",
					"Font size and formatting",
					"Content structure and organization",
					"Publication date",
				],
				correctAnswer: 2,
				explanation:
					"Content structure and organization are key to understanding and extracting meaningful information.",
			},
			{
				id: 3,
				question:
					"Which approach would be most effective for processing this content?",
				options: [
					"Manual transcription only",
					"Automated text extraction with AI analysis",
					"Image recognition techniques",
					"Audio conversion methods",
				],
				correctAnswer: 1,
				explanation:
					"Automated text extraction combined with AI analysis provides the most comprehensive and efficient processing.",
			},
		];

		// Add more questions based on content length and complexity
		const mockQuestions = [...baseQuestions];

		if (extractedText.length > 1000) {
			mockQuestions.push({
				id: 4,
				question:
					"What would be the best strategy for handling large amounts of text content?",
				options: [
					"Process everything at once",
					"Break into smaller chunks and analyze systematically",
					"Focus only on the beginning",
					"Skip complex sections",
				],
				correctAnswer: 1,
				explanation:
					"Breaking content into manageable chunks allows for more thorough and accurate analysis.",
			});
		}

		if (extractedText.length > 5000) {
			mockQuestions.push({
				id: 5,
				question:
					"When working with comprehensive documents, what is crucial for maintaining accuracy?",
				options: [
					"Speed of processing",
					"Consistent methodology and verification",
					"Using multiple different tools",
					"Prioritizing quantity over quality",
				],
				correctAnswer: 1,
				explanation:
					"Consistent methodology and verification ensure accuracy when processing large documents.",
			});
		}

		console.log(
			`📝 Generated ${mockQuestions.length} mock questions for demo`,
		);
		return mockQuestions;
	}

	// New method for batch processing - uses custom prompts and simpler structure
	async generateQuestionsFromText(textContent, customPrompt = null) {
		try {
			console.log(
				`🤖 Processing text chunk: ${textContent.length} characters...`,
			);

			if (!this.model) {
				throw new Error(
					"Google AI model not initialized. Please check your API key.",
				);
			}

			// Use custom prompt or fall back to simple chunk extraction
			const prompt =
				customPrompt || this.createChunkExtractionPrompt(textContent);

			const result = await this.model.generateContent(prompt);
			const response = await result.response;
			const text = response.text();

			console.log(`📝 AI Response length: ${text.length} characters`);

			// Parse and validate the JSON response - simpler array format
			const questions = this.parseChunkResponse(text);

			if (!questions || questions.length === 0) {
				console.warn("⚠️ No valid questions extracted from AI response");
				return [];
			}

			console.log(
				`✅ Extracted ${questions.length} questions from text chunk`,
			);
			return questions;
		} catch (error) {
			console.error("Failed to process text chunk:", error);
			throw error; // Let batch processor handle the error
		}
	}

	createChunkExtractionPrompt(textContent) {
		return `You are an expert quiz generator. Extract and create interactive multiple-choice questions from the following text content.

Format your response as a single, valid JSON object containing a "questions" array. Each question object must have: "id", "question", "options" (array of strings), "correctAnswer" (0-indexed integer), and "explanation".

Guidelines:
- Extract ALL questions. Do not stop prematurely.
- Ensure the JSON is well-formed. Do not include trailing commas.
- Escape any double quotes within the question or explanation text.
- If the text contains numbered questions and options (e.g., "1.", "A.", "B."), preserve them accurately.
- CRITICALLY IMPORTANT: For each question, deeply analyze all options before selecting the correct answer:
  * Compare each option against the exact information in the text
  * Watch for subtle wording differences that change meaning
  * Consider which option most completely answers the question
  * Verify your choice is consistent with the source material
- Provide explanations that clearly justify why the correct answer is right and why others are wrong
- If answers are explicitly marked in the text, use those markings

Content to analyze:
${textContent}`;
	}

	// New robust JSON parsing logic
	parseChunkResponse(text) {
		console.log("🧼 Cleaning and parsing AI response...");

		const jsonText = this.extractJsonFromText(text);

		if (!jsonText) {
			console.warn(
				"⚠️ No JSON block found in response. Trying regex fallback.",
			);
			return this.extractQuestionsWithRegex(text);
		}

		try {
			// First, try a direct parse
			const parsed = JSON.parse(jsonText);
			if (parsed.questions && Array.isArray(parsed.questions)) {
				console.log(
					`✅ Successfully parsed ${parsed.questions.length} questions directly.`,
				);
				return this.validateQuestions(parsed.questions);
			}
		} catch (_e) {
			console.warn("⚠️ Direct JSON.parse failed. Attempting to repair...");
		}

		// If direct parse fails, try to repair and parse the whole string
		try {
			const repairedParsed = this.repairAndParseJson(jsonText);
			if (
				repairedParsed.questions &&
				Array.isArray(repairedParsed.questions)
			) {
				console.log(
					`✅ Successfully repaired and parsed ${repairedParsed.questions.length} questions.`,
				);
				return this.validateQuestions(repairedParsed.questions);
			}
		} catch (e) {
			console.warn(
				`⚠️ JSON repair failed: ${e.message}. Attempting iterative parsing...`,
			);
		}

		// As a robust fallback, find and parse question objects iteratively
		console.log("🔧 Attempting iterative parsing of question objects...");
		const questions = [];
		// Regex to find individual JSON objects that look like questions
		const questionObjectRegex =
			/{\s*"id":\s*\d+,\s*"question":\s*"[\s\S]*?,\s*"options":\s*\[[\s\S]*?\],\s*"correctAnswer":\s*\d+,\s*"explanation":\s*"[\s\S]*?"\s*}/g;

		const matches = jsonText.match(questionObjectRegex);

		if (matches) {
			console.log(`Found ${matches.length} potential question objects.`);
			for (const match of matches) {
				try {
					questions.push(JSON.parse(match));
				} catch (e) {
					console.warn(
						"Could not parse individual question object:",
						match,
						e,
					);
				}
			}
		}

		if (questions.length > 0) {
			console.log(
				`✅ Successfully extracted ${questions.length} questions iteratively.`,
			);
			return this.validateQuestions(questions);
		}

		console.error("🚨 Failed to parse chunk response after all attempts.");
		console.log("Original text length:", text.length);
		console.log("Preview (first 500):", text.substring(0, 500));
		console.log("Preview (last 500):", text.substring(text.length - 500));

		// Final fallback to broad regex on the original text
		return this.extractQuestionsWithRegex(text);
	}

	// Utility to extract JSON from markdown or plain text
	extractJsonFromText(text) {
		const match = text.match(/```json\s*([\s\S]*?)\s*```/);
		if (match?.[1]) {
			return match[1].trim();
		}
		// Fallback for responses that might not have the markdown block
		const firstBrace = text.indexOf("{");
		const lastBrace = text.lastIndexOf("}");
		if (firstBrace !== -1 && lastBrace > firstBrace) {
			return text.substring(firstBrace, lastBrace + 1);
		}
		return null;
	}

	// Utility to fix common JSON errors and parse
	repairAndParseJson(jsonString) {
		let repaired = jsonString
			// Remove trailing commas from objects and arrays
			.replace(/,\s*([}\]])/g, "$1")
			// Add missing commas between properties (basic case)
			.replace(/}"\s*"/g, '}, "')
			// Attempt to escape unescaped quotes (simple version)
			.replace(/\\"/g, '"') // First, un-escape correctly escaped ones to avoid double-escaping
			.replace(/([:[,]\s*)"([^"\\]*)"([^"\\]*)"/g, '$1"$2\\"$3"'); // A common error pattern

		// Balance braces and brackets
		const openBraces = (repaired.match(/{/g) || []).length;
		let closeBraces = (repaired.match(/}/g) || []).length;
		while (openBraces > closeBraces) {
			repaired += "}";
			closeBraces++;
		}

		const openBrackets = (repaired.match(/\[/g) || []).length;
		let closeBrackets = (repaired.match(/]/g) || []).length;
		while (openBrackets > closeBrackets) {
			repaired += "]";
			closeBrackets++;
		}

		return JSON.parse(repaired);
	}

	validateQuestions(questions) {
		// First, normalize the questions to handle common format issues
		const normalizedQuestions = this.normalizeQuestions(questions);

		// Then validate the normalized questions
		const validQuestions = normalizedQuestions.filter((q, index) => {
			const hasQuestion = q.question && typeof q.question === "string";
			const hasOptions = Array.isArray(q.options) && q.options.length > 1;
			const hasCorrectAnswer = typeof q.correctAnswer === "number";
			const hasExplanation =
				q.explanation && typeof q.explanation === "string";

			if (
				!hasQuestion ||
				!hasOptions ||
				!hasCorrectAnswer ||
				!hasExplanation
			) {
				console.warn(`Skipping invalid question at index ${index}:`, q);
				return false;
			}
			return true;
		});
		return validQuestions;
	}

	// Add a function to normalize questions with common format issues
	normalizeQuestions(questions) {
		return questions.map((q, index) => {
			// Create a normalized copy
			const normalized = { ...q };

			// Add ID if missing
			if (!normalized.id) {
				normalized.id = index + 1;
			}

			// Convert 'answer' to 'correctAnswer' if needed
			if (
				normalized.answer !== undefined &&
				normalized.correctAnswer === undefined
			) {
				// Only log once if we're doing conversions
				if (index === 0) {
					console.log(
						`ℹ️ Normalizing question format (answer → correctAnswer)`,
					);
				}

				// If answer is a string (like "A" or "Option A"), convert to index
				if (typeof normalized.answer === "string") {
					const answerStr = normalized.answer.trim().toLowerCase();

					// Check if it's a single letter answer (A, B, C, D)
					if (/^[a-e]$/.test(answerStr)) {
						// Convert A->0, B->1, etc.
						normalized.correctAnswer =
							answerStr.charCodeAt(0) - "a".charCodeAt(0);
					}
					// Check if it's something like "Option A" or "A)"
					else if (/^(option\s*)?[a-e][.)]/.test(answerStr)) {
						normalized.correctAnswer =
							answerStr
								.charAt(answerStr.search(/[a-e]/i))
								.toLowerCase()
								.charCodeAt(0) - "a".charCodeAt(0);
					}
					// Try to find the answer text in the options
					else if (Array.isArray(normalized.options)) {
						const optionIndex = normalized.options.findIndex(
							(opt) => opt.toLowerCase().includes(answerStr),
						);
						if (optionIndex >= 0) {
							normalized.correctAnswer = optionIndex;
						} else {
							// Default to first option if we can't determine
							normalized.correctAnswer = 0;
						}
					} else {
						// Default to first option
						normalized.correctAnswer = 0;
					}
				} else if (typeof normalized.answer === "number") {
					// If it's already a number, use it directly
					normalized.correctAnswer = normalized.answer;
				} else {
					// Default to first option
					normalized.correctAnswer = 0;
				}
			}

			// If explanation is missing, add a default one
			if (!normalized.explanation) {
				normalized.explanation =
					"This answer is correct based on the information in the document.";
			}

			return normalized;
		});
	}

	extractQuestionsWithRegex(text) {
		console.log("🔧 Attempting regex extraction as final fallback...");
		const questions = [];
		// Regex to find question blocks, more tolerant of formatting
		const questionBlockRegex =
			/(\d+[.)]\s*|Question\s*\d+:?\s*)([\s\S]+?)(Answer:|Correct Answer:|Explanation:)/gi;

		let idCounter = 1;
		const match = questionBlockRegex.exec(text);
		while (match !== null) {
			const questionText = match[2].trim();
			const optionsRegex =
				/([A-Ea-e][.)]\s*)([\s\S]+?)(?=[A-Ea-e][.)]\s*|$)/g;

			const options = [];
			const optionsMatch = optionsRegex.exec(questionText);
			while (optionsMatch !== null) {
				options.push(optionsMatch[2].trim());
			}

			// Simple validation
			if (questionText.length > 10 && options.length >= 2) {
				questions.push({
					id: idCounter++,
					question: questionText.split(optionsRegex)[0].trim(), // Get text before options
					options: options,
					correctAnswer: 0, // Placeholder
					explanation: "N/A - Extracted via regex",
				});
			}
		}

		console.log(`🔧 Regex extraction found ${questions.length} questions`);
		return questions;
	}

	async getCorrectAnswers(questions) {
		// Extract correct answers from questions
		return questions.map((q) => ({
			questionId: q.id,
			correctAnswer: q.correctAnswer,
			explanation: q.explanation,
		}));
	}

	async analyzeAnswers(questions, userAnswers, correctAnswers) {
		try {
			const results = {
				totalQuestions: questions.length,
				correctCount: 0,
				incorrectCount: 0,
				score: 0,
				percentage: 0,
				details: [],
			};

			questions.forEach((question, index) => {
				const userAnswer = userAnswers[index];
				const correctAnswer = correctAnswers[index];
				const isCorrect = userAnswer === correctAnswer.correctAnswer;

				if (isCorrect) {
					results.correctCount++;
				}

				results.details.push({
					questionId: question.id,
					question: question.question,
					userAnswer: userAnswer,
					correctAnswer: correctAnswer.correctAnswer,
					isCorrect,
					userAnswerText: question.options[userAnswer] || "No answer",
					correctAnswerText:
						question.options[correctAnswer.correctAnswer],
					explanation: correctAnswer.explanation,
				});
			});

			results.incorrectCount =
				results.totalQuestions - results.correctCount;
			results.score = `${results.correctCount}/${results.totalQuestions}`;
			results.percentage = Math.round(
				(results.correctCount / results.totalQuestions) * 100,
			);

			this.emit("answersAnalyzed", results);
			return results;
		} catch (error) {
			console.error("Answer analysis error:", error);
			this.emit("error", error);
			throw error;
		}
	}

	// Utility method to check if API is configured
	isConfigured() {
		return this.apiKey && this.apiKey !== "YOUR_GOOGLE_AI_API_KEY_HERE";
	}

	// Method to set API key programmatically (optional modelId saves both before init)
	setAPIKey(apiKey, modelId = undefined) {
		this.apiKey = apiKey;
		if (apiKey) {
			localStorage.setItem("google-ai-api-key", apiKey);
		} else {
			localStorage.removeItem("google-ai-api-key");
			localStorage.removeItem("google-ai-model-id");
			this.modelId = null;
		}
		if (modelId !== undefined) {
			if (modelId) {
				localStorage.setItem("google-ai-model-id", modelId);
				this.modelId = modelId;
			} else {
				localStorage.removeItem("google-ai-model-id");
				this.modelId = null;
			}
		}
		this.model = null;
		this.initializeAPI();
	}

	async testAPIKey(apiKey = null, modelId = null) {
		const testKey = apiKey || this.apiKey;
		if (!testKey) {
			throw new Error("No API key provided");
		}
		if (!modelId?.trim()) {
			return {
				success: false,
				message: "Select a model from the list before saving.",
			};
		}

		try {
			const { GoogleGenerativeAI } = await import(
				"https://esm.run/@google/generative-ai"
			);
			const genAI = new GoogleGenerativeAI(testKey);
			const model = genAI.getGenerativeModel({
				model: modelId.trim(),
			});

			const result = await model.generateContent(
				"Say 'test' if you can read this.",
			);
			const response = await result.response;
			const _text = response.text();

			return { success: true, message: "API key is valid and working" };
		} catch (error) {
			console.error("API key test failed:", error);
			return {
				success: false,
				message: error.message || "Invalid API key or network error",
			};
		}
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
			this.events[event].forEach((callback) => {
				callback(data);
			});
		}
	}

	// Add support for image-based question generation
	async generateQuestionsFromImage(imageData, customPrompt = null) {
		try {
			// Basic logging with less verbosity
			console.log(`🤖 Processing image chunk with AI`);
			const prompt = customPrompt || this.createImageExtractionPrompt();

			if (!this.model) {
				throw new Error(
					"Google AI model not initialized. Please check your API key.",
				);
			}

			await this.enforceRateLimit();

			// Properly format the request for image data
			// First, create the multipart request with text and image
			const parts = [];

			// If imageData is a data URL string (what our PDF renderer produces)
			if (
				typeof imageData === "string" &&
				imageData.startsWith("data:image")
			) {
				// Extract base64 data and create a Blob
				const mimeType = imageData.split(";")[0].split(":")[1];
				const base64Data = imageData.split(",")[1];
				const binaryData = atob(base64Data);
				const byteArray = new Uint8Array(binaryData.length);
				for (let i = 0; i < binaryData.length; i++) {
					byteArray[i] = binaryData.charCodeAt(i);
				}
				const _blob = new Blob([byteArray], { type: mimeType });

				// Add image part
				parts.push({
					inlineData: {
						data: base64Data,
						mimeType: mimeType,
					},
				});
			} else if (imageData instanceof Blob) {
				// Convert Blob to base64
				const base64Data = await new Promise((resolve) => {
					const reader = new FileReader();
					reader.onloadend = () =>
						resolve(reader.result.split(",")[1]);
					reader.readAsDataURL(imageData);
				});

				// Add image part
				parts.push({
					inlineData: {
						data: base64Data,
						mimeType: imageData.type,
					},
				});
			} else {
				throw new Error("Unsupported image data format");
			}

			// Add text prompt part
			parts.push({
				text: prompt,
			});

			// Create the content structure
			const contents = [
				{
					role: "user",
					parts: parts,
				},
			];

			console.log("⏳ Sending image analysis request...");

			// Generate content with properly structured request
			const result = await this.model.generateContent({ contents });
			const response = await result.response;
			const text = response.text();
			console.log(
				`✅ Received image analysis response (${text.length} chars)`,
			);
			const questions = this.parseChunkResponse(text);
			return questions;
		} catch (error) {
			console.error("Failed to process image chunk:", error);
			console.warn("Falling back to mock questions for image chunk");
			// Use mock questions when image AI fails or is unavailable
			return this.generateMockQuestions(imageData);
		}
	}

	createImageExtractionPrompt() {
		return `You are an expert quiz generator. OCR and analyze the content of the provided PDF page image and extract all multiple-choice questions.

Your response MUST be a valid JSON in this exact format:
{
  "questions": [
    {
      "id": 1,
      "question": "Full question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Explanation of why this answer is correct"
    }
  ]
}

Important details:
- The correctAnswer field must be a number (0 for Option A, 1 for Option B, etc.)
- Make sure to extract all visible multiple-choice questions on the page
- Include all options (usually 4 or 5)
- Maintain the exact format shown above
- CRITICALLY IMPORTANT: For determining the correct answer:
  * If answers are indicated on the page (e.g., "Answer: B"), use that for correctAnswer (where A=0, B=1, C=2, D=3, E=4)
  * Otherwise, carefully analyze each option against the content visible in the image
  * Compare options to find the one that best answers the question based on the visible information
  * Check for subtle differences between similar options
  * Look for contextual clues in the image that may indicate the correct answer
  * Provide a thorough explanation that justifies your choice
`;
	}
}

export { AIIntegration };
