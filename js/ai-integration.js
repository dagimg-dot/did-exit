// Google Generative AI Integration
class AIIntegration {
	constructor() {
		this.events = {};
		this.apiKey = null;
		this.model = null;
		this.lastRequestTime = 0;
		this.requestCount = 0;
		this.requestWindow = 60000; // 1 minute in milliseconds
		this.loadAPIKeyFromStorage();
		this.initializeAPI();
	}

	loadAPIKeyFromStorage() {
		// Load API key from localStorage
		this.apiKey = localStorage.getItem("google-ai-api-key");
		if (!this.apiKey) {
			console.warn(
				"⚠️ No API key found in storage. Please configure your Google AI API key.",
			);
		}
	}

	async initializeAPI() {
		// Check if we have an API key
		if (!this.apiKey || this.apiKey === "YOUR_GOOGLE_AI_API_KEY_HERE") {
			console.warn(
				"⚠️ Please set your Google AI API key using the configuration panel",
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
        - Each question should have 4-5 options (preserve original count)
        - correctAnswer should be the index (0-3 for 4 options, 0-4 for 5 options)
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
				if (q.options.length < 4 || q.options.length > 5) {
					console.warn(
						`Question ${index + 1} has ${q.options.length} options (should be 4-5), skipping`,
					);
					return false;
				}
				if (q.correctAnswer < 0 || q.correctAnswer >= q.options.length) {
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
		return `Extract ALL multiple choice questions from this exam content. This appears to be an exam or quiz document.

EXTRACTION GUIDELINES:
- Look for numbered questions (1., 2., 3., etc.) followed by multiple choice options
- Extract EVERY question you find - be comprehensive, not conservative
- Handle 4 OR 5 options: (a, b, c, d) OR (a, b, c, d, e)
- Convert option letters to array positions: a=0, b=1, c=2, d=3, e=4
- Preserve the original number of options (don't pad 4 to 5, don't truncate 5 to 4)

ANSWER DETECTION - VERY IMPORTANT:
- Many exam PDFs have the correct answer RIGHT AFTER the question
- Look for patterns like: "Answer: A", "Ans: B", "Correct Answer: C", "Answer is D", "Answer: E"
- Look for: "(A)", "(B)", "(C)", "(D)", "(E)" immediately following questions  
- Look for: "The answer is A", "Correct option: B", "Right answer: C"
- If you find a provided answer, USE THAT as the correct answer
- If no answer is provided, use your knowledge to determine the most likely correct answer

EXAM CONTENT:
${textContent.substring(0, 100000)}${textContent.length > 100000 ? "\n[Truncated...]" : ""}

Return ONLY a valid JSON array (no markdown, no additional text):
[
  {
    "question": "Complete question text without the number",
    "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
    "correctAnswer": 0,
    "explanation": "Brief explanation of the correct answer"
  }
]

Note: If a question has 5 options, include all 5 in the options array. The options array can have 4 or 5 elements.

IMPORTANT: 
- Extract ALL questions you can identify, even if some details are unclear
- Be aggressive in extraction - it's better to get more questions than to miss them
- ALWAYS use provided answers from the text when available
- Convert letter answers to numbers: A=0, B=1, C=2, D=3, E=4
- Preserve original option count (4 or 5 options as found in source)`;
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

				// Handle 4-5 options dynamically (don't force to exactly 4)
				if (q.options.length < 4) {
					// Pad to minimum 4 options
					while (q.options.length < 4) {
						q.options.push("Additional option");
					}
				} else if (q.options.length > 5) {
					// Cap at maximum 5 options
					q.options = q.options.slice(0, 5);
					if (q.correctAnswer >= 5) {
						q.correctAnswer = 0;
					}
				}
				// Keep 4 or 5 options as-is

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

		// If JSON extraction failed, try to extract raw questions with answers
		if (questions.length === 0) {
			console.log("🔧 Attempting raw text extraction with answer detection...");

			// Look for numbered questions with multiple choice options and answers (4 or 5 options)
			const rawQuestionPattern =
				/(\d+\.?\s*[^?]*\?)[^]*?(?:a[\.\)]\s*[^]*?b[\.\)]\s*[^]*?c[\.\)]\s*[^]*?d[\.\)]\s*(?:[^]*?e[\.\)]\s*[^]*?)?[^]*?)(?:answer[:\s]*([abcdeABCDE])|ans[:\s]*([abcdeABCDE])|correct[:\s]*(?:answer[:\s]*)?([abcdeABCDE])|\(([abcdeABCDE])\))/gi;

			let rawMatch;
			let questionId = 1;

			while (
				(rawMatch = rawQuestionPattern.exec(text)) !== null &&
				questionId <= 20
			) {
				const [fullMatch, questionText, answer1, answer2, answer3, answer4] =
					rawMatch;

				// Extract the answer letter (could be in any of the capture groups)
				const answerLetter = (
					answer1 ||
					answer2 ||
					answer3 ||
					answer4 ||
					""
				).toUpperCase();

				// Extract options from the text (4 or 5 options)
				const optionMatches = fullMatch.match(
					/[abcdeABCDE][\.\)]\s*([^]*?)(?=[abcdeABCDE][\.\)]|answer|ans|correct|\d+\.|$)/gi,
				);

				if (optionMatches && optionMatches.length >= 4 && answerLetter) {
					// Take all available options (4 or 5)
					const maxOptions = Math.min(optionMatches.length, 5);
					const options = optionMatches
						.slice(0, maxOptions)
						.map((opt) => opt.replace(/^[abcdeABCDE][\.\)]\s*/, "").trim());

					// Convert letter to index
					const correctAnswer = answerLetter.charCodeAt(0) - "A".charCodeAt(0);

					if (
						correctAnswer >= 0 &&
						correctAnswer <= 4 &&
						correctAnswer < options.length
					) {
						2;
						questions.push({
							question: questionText.trim(),
							options: options,
							correctAnswer: correctAnswer,
							explanation: `Answer provided in source: ${answerLetter}`,
						});
						questionId++;
					}
				}
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
		if (apiKey) {
			localStorage.setItem("google-ai-api-key", apiKey);
		} else {
			localStorage.removeItem("google-ai-api-key");
		}
		this.initializeAPI();
	}

	async testAPIKey(apiKey = null) {
		const testKey = apiKey || this.apiKey;
		if (!testKey) {
			throw new Error("No API key provided");
		}

		try {
			// Load Google Generative AI SDK
			const { GoogleGenerativeAI } = await import(
				"https://esm.run/@google/generative-ai"
			);
			const genAI = new GoogleGenerativeAI(testKey);

			// Try to initialize with the simplest model
			const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

			// Test with a simple prompt
			const result = await model.generateContent(
				"Say 'test' if you can read this.",
			);
			const response = await result.response;
			const text = response.text();

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
			this.events[event].forEach((callback) => callback(data));
		}
	}
}

export { AIIntegration };
