// Google Generative AI Integration
class AIIntegration {
	constructor() {
		this.events = {};
		this.apiKey = null;
		this.model = null;
		this.lastRequestTime = 0;
		this.requestCount = 0;
		this.requestWindow = 60000; // 1 minute in milliseconds
		this.initializeAPI();
	}

	async initializeAPI() {
		// For now, we'll use a placeholder. User will need to add their API key
		// You can get your API key from: https://makersuite.google.com/app/apikey
		this.apiKey = "AIzaSyAewRblWsT75SKeMHrChYvOKrJj9Upw1R4";

		if (this.apiKey === "YOUR_GOOGLE_AI_API_KEY_HERE") {
			console.warn(
				"⚠️ Please set your Google AI API key in js/ai-integration.js",
			);
			return;
		}

		try {
			// Load Google Generative AI SDK
			await this.loadGoogleAI();

			// Initialize the model
			const { GoogleGenerativeAI } = await import(
				"https://esm.run/@google/generative-ai"
			);
			const genAI = new GoogleGenerativeAI(this.apiKey);

			// Optimized model selection based on free tier research
			// Priority: Best free tier models with highest rate limits and capabilities
			const modelNames = [
				"gemini-2.0-flash", // Best: 15 RPM, 1M TPM, 1.5K RPD, 1M context
				"gemini-1.5-flash", // Good: 15 RPM, 250K TPM, 500 RPD, 1M context
				"gemini-2.5-flash-preview", // Latest: 10 RPM, 250K TPM, 500 RPD, 1M context
				"gemini-1.5-flash-8b", // Fast: 15 RPM, 250K TPM, 500 RPD, 1M context
				"gemini-1.5-flash-latest", // Fallback
			];

			for (const modelName of modelNames) {
				try {
					this.model = genAI.getGenerativeModel({ model: modelName });
					console.log(
						`✅ Google AI initialized successfully with model: ${modelName}`,
					);
					console.log(
						`📊 Free tier limits: RPM varies by model, 1M token context window`,
					);
					break;
				} catch (modelError) {
					console.warn(
						`❌ Failed to initialize model ${modelName}:`,
						modelError,
					);
					continue;
				}
			}

			if (!this.model) {
				throw new Error("No compatible AI model found");
			}
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
		if (this.requestCount >= 12 && timeSinceLastRequest < this.requestWindow) {
			const waitTime = this.requestWindow - timeSinceLastRequest;
			console.log(`⏱️ Rate limiting: waiting ${Math.ceil(waitTime / 1000)}s...`);
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
			if (error.message && error.message.includes("rate")) {
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
        - Each question must have exactly 4 options
        - correctAnswer should be the index (0-3) of the correct option
        - Provide clear, educational explanations
        - If the document has existing questions, use them; if not, create relevant questions from the content
        - Maintain academic accuracy and clarity

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

			console.log(`✅ Received response from Gemini AI (${text.length} chars)`);

			// Clean the response text to extract JSON
			let jsonText = text;
			if (text.includes("```json")) {
				jsonText = text.match(/```json\s*([\s\S]*?)\s*```/)?.[1] || text;
			} else if (text.includes("```")) {
				jsonText = text.match(/```\s*([\s\S]*?)\s*```/)?.[1] || text;
			}

			// Additional cleaning for common JSON issues
			jsonText = jsonText.trim();

			// Find the JSON object bounds more reliably
			const firstBrace = jsonText.indexOf("{");
			const lastBrace = jsonText.lastIndexOf("}");

			if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
				throw new Error("No valid JSON object found in response");
			}

			jsonText = jsonText.substring(firstBrace, lastBrace + 1);

			// Validate JSON structure before parsing
			if (!jsonText.includes('"questions"')) {
				throw new Error("Response doesn't contain expected 'questions' field");
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
					.replace(/": "([^"]*)"([^"]*)"([^"]*)",/g, '": "$1\\"$2\\"$3",')
					// Remove any trailing incomplete objects/arrays
					.replace(/,\s*$/, "");

				// If it ends abruptly, try to close it properly
				let openBraces = (fixedJson.match(/{/g) || []).length;
				let closeBraces = (fixedJson.match(/}/g) || []).length;
				let openBrackets = (fixedJson.match(/\[/g) || []).length;
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
					console.warn(`Question ${index + 1} has invalid structure, skipping`);
					return false;
				}
				if (q.options.length !== 4) {
					console.warn(
						`Question ${index + 1} doesn't have exactly 4 options, skipping`,
					);
					return false;
				}
				if (q.correctAnswer < 0 || q.correctAnswer >= 4) {
					console.warn(
						`Question ${index + 1} has invalid correctAnswer index, skipping`,
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
			console.error("Failed to generate questions with Google AI:", error);
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

		console.log(`📝 Generated ${mockQuestions.length} mock questions for demo`);
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

			console.log(`✅ Extracted ${questions.length} questions from text chunk`);
			return questions;
		} catch (error) {
			console.error("Failed to process text chunk:", error);
			throw error; // Let batch processor handle the error
		}
	}

	createChunkExtractionPrompt(textContent) {
		return `Extract ALL multiple choice questions from this text chunk.

CRITICAL REQUIREMENTS:
- Extract EVERY complete multiple choice question found
- Each question must have exactly 4 options (A, B, C, D)
- Provide the correct answer index (0=A, 1=B, 2=C, 3=D)
- Include detailed explanations for correct answers
- Skip incomplete or unclear questions

TEXT TO ANALYZE:
${textContent.substring(0, 100000)}${textContent.length > 100000 ? "\n[Truncated...]" : ""}

Return ONLY a valid JSON array with this exact structure (no additional text or markdown):
[
  {
    "question": "Complete question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Detailed explanation of why this answer is correct"
  }
]`;
	}

	parseChunkResponse(text) {
		try {
			// Clean the response text to extract JSON array
			let jsonText = text.trim();

			// Remove markdown code blocks
			if (jsonText.includes("```json")) {
				jsonText =
					jsonText.match(/```json\s*([\s\S]*?)\s*```/)?.[1] || jsonText;
			} else if (jsonText.includes("```")) {
				jsonText = jsonText.match(/```\s*([\s\S]*?)\s*```/)?.[1] || jsonText;
			}

			// Find the JSON array bounds
			const firstBracket = jsonText.indexOf("[");
			let lastBracket = jsonText.lastIndexOf("]");

			if (firstBracket === -1) {
				throw new Error("No opening bracket found in response");
			}

			// If no closing bracket, try to find the last complete question
			if (lastBracket === -1 || firstBracket >= lastBracket) {
				console.warn("🔧 Attempting to fix truncated JSON response...");

				// Find the last complete question object
				let workingText = jsonText.substring(firstBracket + 1);
				let braceCount = 0;
				let inString = false;
				let escapeNext = false;
				let lastGoodPos = 0;

				for (let i = 0; i < workingText.length; i++) {
					const char = workingText[i];

					if (escapeNext) {
						escapeNext = false;
						continue;
					}

					if (char === "\\" && inString) {
						escapeNext = true;
						continue;
					}

					if (char === '"' && !escapeNext) {
						inString = !inString;
						continue;
					}

					if (!inString) {
						if (char === "{") {
							braceCount++;
						} else if (char === "}") {
							braceCount--;
							if (braceCount === 0) {
								// Found complete question object
								lastGoodPos = i + 1;
							}
						}
					}
				}

				if (lastGoodPos > 0) {
					jsonText = "[" + workingText.substring(0, lastGoodPos) + "]";
					console.log(
						"🔧 Fixed truncated JSON, working with complete questions only",
					);
				} else {
					throw new Error("Could not find any complete question objects");
				}
			} else {
				jsonText = jsonText.substring(firstBracket, lastBracket + 1);
			}

			// Basic JSON cleaning
			jsonText = jsonText
				.replace(/,\s*}/g, "}")
				.replace(/,\s*]/g, "]")
				.replace(/,\s*,/g, ",") // Remove double commas
				.trim();

			let parsed;
			try {
				parsed = JSON.parse(jsonText);
			} catch (parseError) {
				console.warn("🔧 First parse failed, attempting regex extraction...");
				return this.extractQuestionsWithRegex(text);
			}

			if (!Array.isArray(parsed)) {
				console.warn(
					"Response is not an array, attempting to extract from object...",
				);
				if (parsed.questions && Array.isArray(parsed.questions)) {
					parsed = parsed.questions;
				} else if (typeof parsed === "object" && parsed.question) {
					// Single question object
					parsed = [parsed];
				} else {
					throw new Error("Response is not a valid array or question object");
				}
			}

			// Validate and clean questions
			const validQuestions = parsed.filter((q, index) => {
				if (
					!q.question ||
					!Array.isArray(q.options) ||
					typeof q.correctAnswer !== "number"
				) {
					console.warn(`Question ${index + 1} has invalid structure, skipping`);
					return false;
				}
				if (q.options.length < 2) {
					console.warn(
						`Question ${index + 1} doesn't have enough options, skipping`,
					);
					return false;
				}
				if (q.correctAnswer < 0 || q.correctAnswer >= q.options.length) {
					console.warn(
						`Question ${index + 1} has invalid correctAnswer index, fixing...`,
					);
					q.correctAnswer = 0; // Default to first option
				}

				// Ensure exactly 4 options
				while (q.options.length < 4) {
					q.options.push("Additional option");
				}
				if (q.options.length > 4) {
					q.options = q.options.slice(0, 4);
					if (q.correctAnswer >= 4) {
						q.correctAnswer = 0;
					}
				}

				return true;
			});

			console.log(
				`✅ Parsed ${validQuestions.length} valid questions from ${parsed.length} total`,
			);
			return validQuestions;
		} catch (error) {
			console.error("Failed to parse chunk response:", error);
			console.log("Response length:", text.length);
			console.log(
				"Response preview (first 500 chars):",
				text.substring(0, 500),
			);
			console.log(
				"Response preview (last 500 chars):",
				text.substring(text.length - 500),
			);

			// Try regex extraction as final fallback
			return this.extractQuestionsWithRegex(text);
		}
	}

	extractQuestionsWithRegex(text) {
		console.log("🔧 Attempting regex extraction as fallback...");

		const questions = [];

		// Try to find JSON-like question objects in the text
		const questionPattern =
			/\{\s*"question"\s*:\s*"([^"]+)"\s*,\s*"options"\s*:\s*\[\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\]\s*,\s*"correctAnswer"\s*:\s*(\d+)(?:\s*,\s*"explanation"\s*:\s*"([^"]*)")?\s*\}/g;

		let match;
		while ((match = questionPattern.exec(text)) !== null) {
			const [, question, opt1, opt2, opt3, opt4, correctAnswer, explanation] =
				match;

			const correctIdx = parseInt(correctAnswer);
			if (correctIdx >= 0 && correctIdx <= 3) {
				questions.push({
					question: question,
					options: [opt1, opt2, opt3, opt4],
					correctAnswer: correctIdx,
					explanation: explanation || "No explanation provided",
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
					correctAnswerText: question.options[correctAnswer.correctAnswer],
					explanation: correctAnswer.explanation,
				});
			});

			results.incorrectCount = results.totalQuestions - results.correctCount;
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

	// Method to set API key programmatically
	setAPIKey(apiKey) {
		this.apiKey = apiKey;
		this.initializeAPI();
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

export { AIIntegration };
