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

		// API key management events
		document
			.getElementById("save-api-key-btn")
			.addEventListener("click", this.handleSaveAPIKey.bind(this));

		document
			.getElementById("change-api-key-btn")
			.addEventListener("click", this.showAPIKeyConfig.bind(this));

		document
			.getElementById("cancel-api-key-btn")
			.addEventListener("click", this.hideAPIKeyConfig.bind(this));

		document
			.getElementById("api-key-input")
			.addEventListener("keypress", (e) => {
				if (e.key === "Enter") {
					this.handleSaveAPIKey();
				}
			});

		// Load existing API key on startup
		this.loadExistingAPIKey();

		// Load recent exams
		this.loadRecentExams();

		// PDF processing events - simplified
		this.pdfProcessor.on("textExtracted", this.handleTextExtracted.bind(this));
		this.pdfProcessor.on("error", this.handleProcessingError.bind(this));

		// Batch processing events - focus on AI
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
		this.ui.showLoading("Extracting text from PDF...");

		// Show cancel button immediately
		this.showCancelButton();

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
		console.log(
			"Text extracted, starting AI processing:",
			extractedText.length,
			"characters",
		);

		try {
			this.ui.updateLoadingMessage(
				"Starting AI analysis and question extraction...",
			);

			// Use simplified batch processor focused on AI
			const result = await this.batchProcessor.processPDFInBatches(
				this.currentFile,
				extractedText,
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

	// Batch processing event handlers
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

		// Immediately show the questions
		if (data.questions.length > 0) {
			console.log("📚 Starting quiz with first batch immediately");
			this.startQuizWithProgress(data.totalBatches, data.completedBatches);
		} else {
			console.warn(
				"⚠️ First batch was empty, this shouldn't happen with AI processing",
			);
			this.ui.showError(
				"No questions could be extracted from this PDF. Please try a different document.",
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
			// Add new questions to existing quiz
			this.quizData = [...this.quizData, ...data.questions];
			this.quizManager.addQuestions(data.questions);

			this.ui.showNotification(
				`${data.questions.length} new questions added! Total: ${data.newTotal}`,
				"info",
			);

			// Update progress indicator
			this.ui.updateProgressIndicator(data.completedBatches, data.totalBatches);
		}
	}

	handleProcessingComplete(data) {
		console.log("✅ All batches completed for PDF:", data.pdfId);
		this.hideCancelButton();

		if (this.currentPdfId === data.pdfId) {
			this.ui.showNotification(
				`All questions extracted! Quiz completed with ${data.totalQuestions} total questions.`,
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
		} else {
			this.ui.showNotification(
				`Quiz ready with ${this.quizData.length} questions!`,
				"success",
			);
		}
	}

	handleAnswerSelected(questionIndex, selectedAnswer) {
		this.userAnswers[questionIndex] = selectedAnswer;
	}

	async handleQuizCompleted(userAnswers) {
		this.userAnswers = userAnswers;
		this.ui.showLoading("Analyzing your answers with AI...");

		try {
			// Get correct answers from AI if not already available
			if (
				!this.correctAnswers ||
				this.correctAnswers.length !== this.quizData.length
			) {
				console.log("Getting correct answers from AI...");
				this.correctAnswers = await this.aiIntegration.getCorrectAnswers(
					this.quizData,
				);
			}

			// Analyze answers with AI
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
		this.hideCancelButton();
		this.loadRecentExams(); // Refresh recent exams
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
		this.hideCancelButton();
		this.ui.showError("Error processing PDF: " + error.message);
	}

	handleAIError(error) {
		console.error("AI error:", error);
		this.ui.hideLoading();
		this.ui.showError("AI service error: " + error.message);
	}

	async handleSaveAPIKey() {
		const apiKeyInput = document.getElementById("api-key-input");
		const statusElement = document.getElementById("api-key-status");
		const saveButton = document.getElementById("save-api-key-btn");
		const apiKey = apiKeyInput.value.trim();

		if (!apiKey) {
			this.showAPIKeyStatus("Please enter an API key", "error");
			return;
		}

		// Show loading state
		saveButton.disabled = true;
		saveButton.textContent = "Testing...";
		this.showAPIKeyStatus("Testing API key...", "");

		try {
			// Test the API key
			const testResult = await this.aiIntegration.testAPIKey(apiKey);

			if (testResult.success) {
				// Save the API key
				this.aiIntegration.setAPIKey(apiKey);
				this.showAPIKeyStatus("✅ API key saved and verified!", "success");

				// Clear the input for security
				apiKeyInput.value = "";
				apiKeyInput.placeholder = "API key configured ✓";

				// Hide the config and show collapsed state after a short delay
				setTimeout(() => {
					this.hideAPIKeyConfig();
				}, 1500);
			} else {
				this.showAPIKeyStatus("❌ " + testResult.message, "error");
			}
		} catch (error) {
			console.error("API key test error:", error);
			this.showAPIKeyStatus("❌ Failed to verify API key", "error");
		} finally {
			// Reset button state
			saveButton.disabled = false;
			saveButton.textContent = "Save Key";
		}
	}

	loadExistingAPIKey() {
		const existingKey = localStorage.getItem("google-ai-api-key");
		if (existingKey) {
			// Show collapsed state if API key exists
			this.hideAPIKeyConfig();
		} else {
			// Show expanded state if no API key
			this.showAPIKeyConfig();
			this.showAPIKeyStatus("No API key configured", "warning");
		}
	}

	showAPIKeyStatus(message, type) {
		const statusElement = document.getElementById("api-key-status");
		if (statusElement) {
			statusElement.textContent = message;
			statusElement.className = `api-key-status ${type}`;
		}
	}

	showAPIKeyConfig() {
		const expandedSection = document.getElementById("api-key-section");
		const collapsedSection = document.getElementById("api-key-collapsed");
		const cancelButton = document.getElementById("cancel-api-key-btn");
		const apiKeyInput = document.getElementById("api-key-input");

		if (expandedSection && collapsedSection) {
			expandedSection.style.display = "block";
			collapsedSection.style.display = "none";

			// Show cancel button if there's an existing API key
			const existingKey = localStorage.getItem("google-ai-api-key");
			if (existingKey && cancelButton) {
				cancelButton.style.display = "inline-flex";
			}

			// Clear and focus input
			if (apiKeyInput) {
				apiKeyInput.value = "";
				apiKeyInput.placeholder = "Enter your Google AI API key";
				apiKeyInput.focus();
			}

			// Clear status
			this.showAPIKeyStatus("", "");
		}
	}

	hideAPIKeyConfig() {
		const expandedSection = document.getElementById("api-key-section");
		const collapsedSection = document.getElementById("api-key-collapsed");
		const cancelButton = document.getElementById("cancel-api-key-btn");

		if (expandedSection && collapsedSection) {
			expandedSection.style.display = "none";
			collapsedSection.style.display = "block";

			// Hide cancel button
			if (cancelButton) {
				cancelButton.style.display = "none";
			}
		}
	}

	async loadRecentExams() {
		try {
			const recentExamsList = document.getElementById("recent-exams-list");
			const noRecentExams = document.getElementById("no-recent-exams");

			// Get all PDFs from IndexedDB
			const pdfs = await this.getAllPDFs();

			if (pdfs.length === 0) {
				recentExamsList.innerHTML = "";
				noRecentExams.style.display = "block";
				return;
			}

			// Sort PDFs by last accessed date (most recent first)
			pdfs.sort((a, b) => new Date(b.lastAccessed) - new Date(a.lastAccessed));

			// Generate HTML for each PDF
			const examsHTML = pdfs
				.map((pdf) => this.createExamItemHTML(pdf))
				.join("");
			recentExamsList.innerHTML = examsHTML;
			noRecentExams.style.display = "none";

			// Add event listeners for exam items and delete buttons
			this.attachRecentExamListeners();
		} catch (error) {
			console.error("Error loading recent exams:", error);
		}
	}

	async getAllPDFs() {
		const transaction = this.databaseManager.db.transaction(
			["pdfs"],
			"readonly",
		);
		const store = transaction.objectStore("pdfs");

		return new Promise((resolve, reject) => {
			const request = store.getAll();
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	createExamItemHTML(pdf) {
		const lastAccessed = new Date(pdf.lastAccessed).toLocaleDateString();
		const questionCount = pdf.totalQuestions || 0;

		return `
			<div class="recent-exam-item" data-pdf-id="${pdf.id}">
				<div class="recent-exam-info">
					<div class="recent-exam-name">${pdf.filename}</div>
					<div class="recent-exam-meta">
						<span>${questionCount} questions</span>
						<span>Last accessed: ${lastAccessed}</span>
					</div>
				</div>
				<div class="recent-exam-actions">
					<button class="delete-exam-btn" data-pdf-id="${pdf.id}" title="Delete exam">×</button>
				</div>
			</div>
		`;
	}

	attachRecentExamListeners() {
		// Handle exam item clicks (start quiz)
		document.querySelectorAll(".recent-exam-item").forEach((item) => {
			item.addEventListener("click", (e) => {
				// Don't trigger if delete button was clicked
				if (e.target.classList.contains("delete-exam-btn")) return;

				const pdfId = item.dataset.pdfId;
				this.startQuizFromRecent(pdfId);
			});
		});

		// Handle delete button clicks
		document.querySelectorAll(".delete-exam-btn").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				e.stopPropagation(); // Prevent exam item click
				const pdfId = btn.dataset.pdfId;
				this.deleteRecentExam(pdfId);
			});
		});
	}

	async startQuizFromRecent(pdfId) {
		try {
			// Get PDF and questions from IndexedDB
			const pdf = await this.databaseManager.getPDF(pdfId);
			const questions = await this.databaseManager.getQuestions(pdfId);

			if (!pdf || questions.length === 0) {
				this.ui.showError("Could not load exam data");
				return;
			}

			// Set current data
			this.currentPdfId = pdfId;
			this.quizData = questions;
			this.userAnswers = [];
			this.correctAnswers = [];

			// Start quiz
			this.showSection("quiz-section");
			this.quizManager.initialize(this.quizData);
			this.ui.showNotification(
				`Loaded ${questions.length} questions from "${pdf.filename}"`,
				"success",
			);
		} catch (error) {
			console.error("Error starting quiz from recent:", error);
			this.ui.showError("Failed to load exam");
		}
	}

	async deleteRecentExam(pdfId) {
		try {
			// Get PDF info for confirmation
			const pdf = await this.databaseManager.getPDF(pdfId);
			if (!pdf) return;

			// Confirm deletion
			const confirmed = confirm(
				`Delete "${pdf.filename}" and all its questions?`,
			);
			if (!confirmed) return;

			// Delete from IndexedDB
			await this.databaseManager.deletePDFAndQuestions(pdfId);

			// Reload the recent exams list
			this.loadRecentExams();

			this.ui.showNotification("Exam deleted successfully", "info");
		} catch (error) {
			console.error("Error deleting exam:", error);
			this.ui.showError("Failed to delete exam");
		}
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
					<summary>Error Details</summary>
					<pre style="background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; overflow: auto;">${error.stack}</pre>
				</details>
			</div>
		`;
	}
});

export { App };
