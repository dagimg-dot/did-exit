// Main application controller
import { FileUploader } from "./file-uploader.js";
import { PDFProcessor } from "./pdf-processor.js";
import { AIIntegration } from "./ai-integration.js";
import { QuizManager } from "./quiz-manager.js";
import { UIComponents } from "./ui-components.js";
import { DatabaseManager } from "./database-manager.js";
import { BatchProcessor } from "./batch-processor.js";

class App {
	constructor() {
		this.currentSection = "upload-section";
		this.quizData = null;
		this.userAnswers = [];
		this.correctAnswers = [];
		this.currentPdfId = null;
		this.currentFile = null;

		this.initializeApp();
	}

	async initializeApp() {
		await this.initializeComponents();
		this.setupEventListeners();
	}

	async initializeComponents() {
		this.fileUploader = new FileUploader();
		this.pdfProcessor = new PDFProcessor();
		this.aiIntegration = new AIIntegration();
		this.quizManager = new QuizManager();
		this.ui = new UIComponents();

		// Initialize database
		this.databaseManager = new DatabaseManager();
		await this.databaseManager.initialize();

		// Initialize batch processor with dependencies
		this.batchProcessor = new BatchProcessor(
			this.aiIntegration,
			this.databaseManager,
		);
	}

	setupEventListeners() {
		// File upload events
		this.fileUploader.on("fileSelected", this.handleFileSelected.bind(this));
		this.fileUploader.on(
			"processingStart",
			this.handleProcessingStart.bind(this),
		);

		// PDF processing events
		this.pdfProcessor.on("pdfAnalyzed", this.handlePDFAnalyzed.bind(this));
		this.pdfProcessor.on("textExtracted", this.handleTextExtracted.bind(this));
		this.pdfProcessor.on("error", this.handleProcessingError.bind(this));

		// AI integration events
		this.aiIntegration.on(
			"questionsGenerated",
			this.handleQuestionsGenerated.bind(this),
		);
		this.aiIntegration.on(
			"answersAnalyzed",
			this.handleAnswersAnalyzed.bind(this),
		);
		this.aiIntegration.on("error", this.handleAIError.bind(this));

		// Batch processing events
		this.batchProcessor.on("cacheHit", this.handleCacheHit.bind(this));
		this.batchProcessor.on(
			"firstBatchReady",
			this.handleFirstBatchReady.bind(this),
		);
		this.batchProcessor.on(
			"batchCompleted",
			this.handleBatchCompleted.bind(this),
		);
		this.batchProcessor.on(
			"processingComplete",
			this.handleProcessingComplete.bind(this),
		);
		this.batchProcessor.on(
			"processingCancelled",
			this.handleProcessingCancelled.bind(this),
		);
		this.batchProcessor.on(
			"processingError",
			this.handleProcessingError.bind(this),
		);

		// Quiz events
		this.quizManager.on("answerSelected", this.handleAnswerSelected.bind(this));
		this.quizManager.on("quizCompleted", this.handleQuizCompleted.bind(this));

		// Navigation events
		document
			.getElementById("restart-btn")
			.addEventListener("click", this.restart.bind(this));
		document
			.getElementById("review-btn")
			.addEventListener("click", this.showReview.bind(this));

		// Cancel button event
		document
			.getElementById("cancel-processing-btn")
			.addEventListener("click", this.cancelProcessing.bind(this));
	}

	async handleFileSelected(file) {
		console.log("File selected:", file.name);
		this.currentFile = file;
		this.ui.showLoading("Processing PDF and extracting text...");

		try {
			await this.pdfProcessor.processFile(file);
		} catch (error) {
			this.handleProcessingError(error);
		}
	}

	handleProcessingStart() {
		this.ui.showLoading("Processing PDF...");
	}

	handlePDFAnalyzed(pdfAnalysis) {
		console.log("📊 PDF analysis complete:", pdfAnalysis.metadata);
		this.currentPDFAnalysis = pdfAnalysis;

		// Show cancel button when processing starts
		this.showCancelButton();

		if (pdfAnalysis.metadata.hasQuestions) {
			const breakdown = pdfAnalysis.metadata.patternBreakdown;
			const mainQuestions =
				breakdown.mainQuestions || breakdown.numberedQuestions || 0;
			const optionGroups = breakdown.optionGroups || 0;

			this.ui.updateLoadingMessage(
				`📋 Detected ~${pdfAnalysis.metadata.estimatedQuestions} questions (${mainQuestions} numbered, ${optionGroups} option groups). Starting AI extraction...`,
			);
		} else {
			this.ui.updateLoadingMessage(
				"No obvious question patterns detected. Analyzing content with AI...",
			);
		}
	}

	async handleTextExtracted(extractedText, pdfAnalysis = null) {
		console.log("Text extracted, length:", extractedText.length);

		try {
			// Use enhanced batch processor with PDF analysis
			const result = await this.batchProcessor.processPDFInBatches(
				this.currentFile,
				extractedText,
				pdfAnalysis || this.currentPDFAnalysis,
			);

			if (!result) {
				// Processing was cancelled
				return;
			}

			if (result.fromCache) {
				// Handle cached result
				this.handleCacheHit(result);
			}
			// First batch processing is handled by events
		} catch (error) {
			this.handleProcessingError(error);
		}
	}

	async handleQuestionsGenerated(questions) {
		console.log("Questions generated:", questions.length);
		this.quizData = questions;

		// Store correct answers with AI for comparison later
		this.ui.updateLoadingMessage("Preparing quiz...");

		try {
			this.correctAnswers =
				await this.aiIntegration.getCorrectAnswers(questions);
			this.startQuiz();
		} catch (error) {
			this.handleAIError(error);
		}
	}

	// New batch processing event handlers
	handleCacheHit(data) {
		console.log(
			"📦 Cache hit! Loading existing questions:",
			data.questions.length,
		);
		this.currentPdfId = data.pdfId;
		this.quizData = data.questions;
		this.ui.updateLoadingMessage("Loading cached questions...");
		this.startQuizFromCache();
	}

	handleFirstBatchReady(data) {
		console.log("⚡ First batch ready:", data.questions.length, "questions");
		this.currentPdfId = data.pdfId;
		this.quizData = data.questions;

		// Immediately show the questions - no delay
		if (data.questions.length > 0) {
			console.log("📚 Starting quiz with first batch immediately");
			this.startQuizWithProgress(data.totalBatches, data.completedBatches);
		} else {
			console.warn(
				"⚠️ First batch was empty, waiting for background processing",
			);
			this.ui.updateLoadingMessage(
				"First batch contained no questions. Processing more content...",
			);
		}
	}

	handleBatchCompleted(data) {
		console.log(
			`📦 Batch ${data.batchNumber} completed:`,
			data.questions.length,
			"new questions",
		);

		// Update quiz with new questions if user is still active
		if (
			this.currentPdfId === data.pdfId &&
			this.currentSection === "quiz-section"
		) {
			this.quizManager.handleQuestionExpansion(data.questions);
			this.ui.showNotification(
				`${data.questions.length} new questions added! Total: ${data.newTotal}`,
			);
		}
	}

	handleProcessingComplete(data) {
		console.log("✅ All batches completed for PDF:", data.pdfId);
		this.hideCancelButton();

		if (this.currentPdfId === data.pdfId) {
			this.ui.showNotification(
				"All questions extracted! Quiz is now complete.",
				"success",
			);
			this.ui.hideProgressIndicator();
		}
	}

	handleProcessingCancelled(event) {
		console.log("🛑 Processing was cancelled:", event);
		this.hideCancelButton();
		this.ui.hideLoading();
		this.ui.showNotification(
			"Processing cancelled. You can upload a new PDF.",
			"info",
		);
	}

	cancelProcessing() {
		console.log("🛑 User requested to cancel processing");
		this.batchProcessor.cancelProcessing();
	}

	showCancelButton() {
		const cancelBtn = document.getElementById("cancel-processing-btn");
		if (cancelBtn) {
			cancelBtn.style.display = "block";
			cancelBtn.style.margin = "1rem auto 0 auto";
		}
	}

	hideCancelButton() {
		const cancelBtn = document.getElementById("cancel-processing-btn");
		if (cancelBtn) {
			cancelBtn.style.display = "none";
		}
	}

	startQuiz() {
		this.ui.hideLoading();
		this.showSection("quiz-section");
		this.quizManager.initialize(this.quizData);
	}

	startQuizFromCache() {
		this.ui.hideLoading();
		this.showSection("quiz-section");
		this.quizManager.initialize(this.quizData);
		this.ui.showNotification(
			`Loaded ${this.quizData.length} questions from cache!`,
			"success",
		);
	}

	startQuizWithProgress(totalBatches, completedBatches) {
		this.ui.hideLoading();
		this.showSection("quiz-section");
		this.quizManager.initialize(this.quizData);

		// Show background processing progress
		if (completedBatches < totalBatches) {
			this.ui.showProgressIndicator(completedBatches, totalBatches);
			this.ui.showNotification(
				`Quiz started with ${this.quizData.length} questions! More questions are being processed in the background.`,
				"info",
			);
		}
	}

	handleAnswerSelected(questionIndex, selectedAnswer) {
		this.userAnswers[questionIndex] = selectedAnswer;
	}

	async handleQuizCompleted(userAnswers) {
		this.userAnswers = userAnswers;
		this.ui.showLoading("Analyzing your answers...");

		try {
			const results = await this.aiIntegration.analyzeAnswers(
				this.quizData,
				this.userAnswers,
				this.correctAnswers,
			);
			this.showResults(results);
		} catch (error) {
			this.handleAIError(error);
		}
	}

	handleAnswersAnalyzed(results) {
		this.showResults(results);
	}

	showResults(results) {
		this.ui.hideLoading();
		this.showSection("results-section");
		this.ui.displayResults(results);
	}

	showReview() {
		this.showSection("quiz-section");
		this.quizManager.showReview(this.userAnswers, this.correctAnswers);
	}

	restart() {
		this.quizData = null;
		this.userAnswers = [];
		this.correctAnswers = [];
		this.currentPdfId = null;
		this.currentFile = null;
		this.fileUploader.reset();
		this.quizManager.reset();
		this.ui.hideProgressIndicator();
		this.ui.clearNotifications();
		this.showSection("upload-section");
	}

	showSection(sectionId) {
		// Hide all sections
		const sections = document.querySelectorAll(".section");
		sections.forEach((section) => section.classList.remove("active"));

		// Show target section
		const targetSection = document.getElementById(sectionId);
		if (targetSection) {
			targetSection.classList.add("active");
			this.currentSection = sectionId;
		}
	}

	handleProcessingError(error) {
		console.error("Processing error:", error);
		this.ui.hideLoading();
		this.ui.showError("Error processing PDF: " + error.message);
	}

	handleAIError(error) {
		console.error("AI error:", error);
		this.ui.hideLoading();
		this.ui.showError("AI service error: " + error.message);
	}
}

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {
	try {
		window.app = new App();
		console.log("🚀 PDF Quiz App initialized successfully");
	} catch (error) {
		console.error("❌ Failed to initialize app:", error);

		// Show basic error message to user
		document.body.innerHTML = `
			<div style="padding: 2rem; text-align: center; color: #dc2626;">
				<h2>Initialization Error</h2>
				<p>Failed to start the application. Please refresh the page and try again.</p>
				<details style="margin-top: 1rem; text-align: left;">
					<summary>Technical Details</summary>
					<pre style="background: #f9fafb; padding: 1rem; border-radius: 4px; margin-top: 0.5rem;">${error.stack}</pre>
				</details>
			</div>
		`;
	}
});

export { App };
