// Google Generative AI Integration
class AIIntegration {
	constructor() {
		this.events = {};
		this.apiKey = null;
		this.model = null;
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

			// Try different model names in order of preference
			const modelNames = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];

			for (const modelName of modelNames) {
				try {
					this.model = genAI.getGenerativeModel({ model: modelName });
					console.log(
						`Google AI initialized successfully with model: ${modelName}`,
					);
					break;
				} catch (modelError) {
					console.warn(`Failed to initialize model ${modelName}:`, modelError);
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

	async generateQuestions(extractedText) {
		try {
			if (!this.model && this.apiKey !== "YOUR_GOOGLE_AI_API_KEY_HERE") {
				await this.initializeAPI();
			}

			let questions;

			if (this.model) {
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
			this.emit("error", error);
			throw error;
		}
	}

	async generateWithGoogleAI(extractedText) {
		const prompt = `
        Based on the following text content from a PDF exam/quiz, extract and create interactive multiple-choice questions.
        
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
        
        Extract up to 10 questions. Make sure each question has exactly 4 options.
        
        Content:
        ${extractedText.substring(0, 4000)}
        `;

		try {
			const result = await this.model.generateContent(prompt);
			const response = await result.response;
			const text = response.text();

			// Clean the response text to extract JSON
			let jsonText = text;
			if (text.includes("```json")) {
				jsonText = text.match(/```json\s*([\s\S]*?)\s*```/)?.[1] || text;
			} else if (text.includes("```")) {
				jsonText = text.match(/```\s*([\s\S]*?)\s*```/)?.[1] || text;
			}

			const parsed = JSON.parse(jsonText);
			return parsed.questions || [];
		} catch (error) {
			console.error("Failed to generate questions with Google AI:", error);
			console.log("Falling back to mock questions...");
			return this.generateMockQuestions(extractedText);
		}
	}

	generateMockQuestions(extractedText) {
		// Generate mock questions for demo purposes
		const mockQuestions = [
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

		// Add more questions if the text is substantial
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

		return mockQuestions;
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
