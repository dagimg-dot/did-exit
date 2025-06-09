// Main application controller
import { FileUploader } from "./file-uploader.js";
import { PDFProcessor } from "./pdf-processor.js";
import { AIIntegration } from "./ai-integration.js";
import { QuizManager } from "./quiz-manager.js";
import { UIComponents } from "./ui-components.js";

class App {
	constructor() {
		this.currentSection = "upload-section";
		this.quizData = null;
		this.userAnswers = [];
		this.correctAnswers = [];

		this.initializeComponents();
		this.setupEventListeners();
	}

	initializeComponents() {
		this.fileUploader = new FileUploader();
		this.pdfProcessor = new PDFProcessor();
		this.aiIntegration = new AIIntegration();
		this.quizManager = new QuizManager();
		this.ui = new UIComponents();
	}

	setupEventListeners() {
		// File upload events
		this.fileUploader.on("fileSelected", this.handleFileSelected.bind(this));
		this.fileUploader.on(
			"processingStart",
			this.handleProcessingStart.bind(this),
		);

		// PDF processing events
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
	}

	async handleFileSelected(file) {
		console.log("File selected:", file.name);
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

	async handleTextExtracted(extractedText) {
		console.log("Text extracted, length:", extractedText.length);
		this.ui.updateLoadingMessage("Generating quiz questions with AI...");

		try {
			await this.aiIntegration.generateQuestions(extractedText);
		} catch (error) {
			this.handleAIError(error);
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

	startQuiz() {
		this.ui.hideLoading();
		this.showSection("quiz-section");
		this.quizManager.initialize(this.quizData);
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
		this.fileUploader.reset();
		this.quizManager.reset();
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
document.addEventListener("DOMContentLoaded", () => {
	window.app = new App();
});

export { App };
