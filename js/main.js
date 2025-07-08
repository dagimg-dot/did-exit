// Main application controller

import { AIIntegration } from "./ai-integration.js";
import { CURRENT_APP_VERSION, content } from "./app-info.js";
import { BatchProcessor } from "./batch-processor.js";
import { DatabaseManager } from "./database-manager.js";
import { FileUploader } from "./file-uploader.js";
import { P2PSyncManager } from "./p2p-sync-manager.js";
import { PDFProcessor } from "./pdf-processor.js";
import { QuizManager } from "./quiz-manager.js";
import { initializeTheme } from "./theme-manager.js";
import { UIComponents } from "./ui-components.js";

class App {
  constructor() {
    this.currentSection = "upload-section";
    this.quizData = null;
    this.userAnswers = [];
    this.flaggedQuestions = [];
    this.correctAnswers = [];
    this.currentPdfId = null;
    this.currentFile = null;
    this.quizMode = "exam"; // Default quiz mode

    this.initializeApp();
  }

  async initializeApp() {
    await this.initializeComponents();
    this.setupEventListeners();
    this.showNewFeaturesPrompt();
    initializeTheme();
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
      this.databaseManager
    );

    // Initialize P2P sync engine
    this.p2pSyncManager = new P2PSyncManager(this.databaseManager);
    this.p2pSyncManager.on("dataReceived", this.handleSyncedData.bind(this));
    this.p2pSyncManager.on("syncStart", () =>
      this.ui.showProgressIndicator(0, 1, "Starting sync...")
    );
    this.p2pSyncManager.on("sendingProgress", ({ current, total }) =>
      this.ui.updateProgressIndicator(current, total, "Sending questions...")
    );
    this.p2pSyncManager.on("receivingProgress", ({ current, total }) =>
      this.ui.updateProgressIndicator(current, total, "Receiving questions...")
    );
    this.p2pSyncManager.on("syncComplete", () =>
      this.ui.hideProgressIndicator()
    );
    this.p2pSyncManager.on("error", () => this.ui.hideProgressIndicator());
  }

  setupEventListeners() {
    // File upload events
    this.fileUploader.on("fileSelected", this.handleFileSelected.bind(this));
    this.fileUploader.on(
      "processingStart",
      this.handleProcessingStart.bind(this)
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
    this.pdfProcessor.on(
      "imagesExtracted",
      this.handleImagesExtracted.bind(this)
    );

    // Batch processing events - focus on AI
    this.batchProcessor.on("cacheHit", this.handleCacheHit.bind(this));
    this.batchProcessor.on(
      "firstBatchReady",
      this.handleFirstBatchReady.bind(this)
    );
    this.batchProcessor.on(
      "batchCompleted",
      this.handleBatchCompleted.bind(this)
    );
    this.batchProcessor.on(
      "processingComplete",
      this.handleProcessingComplete.bind(this)
    );
    this.batchProcessor.on(
      "processingCancelled",
      this.handleProcessingCancelled.bind(this)
    );
    this.batchProcessor.on(
      "processingError",
      this.handleProcessingError.bind(this)
    );

    // Quiz events
    this.quizManager.on("answerSelected", this.handleAnswerSelected.bind(this));
    this.quizManager.on("quizCompleted", this.handleQuizCompleted.bind(this));
    this.quizManager.on("modeChanged", this.handleModeChanged.bind(this));

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

    // Global receive button
    document.getElementById("receive-btn").addEventListener("click", () => {
      console.log("[UI] Global 'Receive an Exam' button clicked.");
      this.ui.showSyncModal(null, this.p2pSyncManager);
    });
  }

  async handleFileSelected(file) {
    console.log("File selected:", file.name);
    this.currentFile = file;
    this.ui.showLoading("Extracting text from PDF...");

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
      "characters"
    );

    try {
      this.ui.updateLoadingMessage(
        "Starting AI analysis and question extraction..."
      );

      // Use simplified batch processor focused on AI
      const result = await this.batchProcessor.processPDFInBatches(
        this.currentFile,
        extractedText
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
      data.questions.length
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

    // Try to load saved answers before starting quiz
    this.databaseManager
      .getUserAnswers(data.pdfId)
      .then(({ userAnswers, flaggedQuestions }) => {
        // If we have saved answers, use them
        if (userAnswers && userAnswers.length > 0) {
          // Resize if needed
          if (userAnswers.length !== data.questions.length) {
            this.userAnswers = new Array(data.questions.length).fill(null);
            // Copy over existing answers that fit within the new array
            userAnswers.forEach((answer, index) => {
              if (index < this.userAnswers.length) {
                this.userAnswers[index] = answer;
              }
            });
            console.log(
              `Loaded ${
                userAnswers.filter((a) => a !== null).length
              } saved answers (resized)`
            );
          } else {
            this.userAnswers = userAnswers;
            console.log(
              `Loaded ${
                userAnswers.filter((a) => a !== null).length
              } saved answers`
            );
          }
        } else {
          // No saved answers, create empty array
          this.userAnswers = new Array(data.questions.length).fill(null);
        }
      })
      .catch((error) => {
        console.error("Error loading saved answers:", error);
        this.userAnswers = new Array(data.questions.length).fill(null);
      })
      .finally(() => {
        // Immediately show the questions
        if (data.questions.length > 0) {
          console.log("📚 Starting quiz with first batch immediately");
          this.startQuizWithProgress(data.totalBatches, data.completedBatches);

          // Set correct answers for immediate feedback to work properly
          this.correctAnswers = data.questions.map((q) => ({
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || "No explanation available.",
          }));
        } else {
          console.warn(
            "⚠️ First batch was empty, this shouldn't happen with AI processing"
          );
          this.ui.showError(
            "No questions could be extracted from this PDF. Please try a different document."
          );
        }
      });
  }

  handleBatchCompleted(data) {
    console.log(
      `📦 Batch ${data.batchNumber} completed:`,
      data.questions.length,
      "new questions"
    );

    // Update quiz with new questions if user is still active
    if (
      this.currentPdfId === data.pdfId &&
      this.currentSection === "quiz-section"
    ) {
      // Add new questions to existing quiz
      this.quizData = [...this.quizData, ...data.questions];

      // Extend userAnswers array with nulls for new questions
      // This preserves existing answers while adding space for new ones
      const additionalAnswers = new Array(data.questions.length).fill(null);
      this.userAnswers = [...this.userAnswers, ...additionalAnswers];

      // Update the quiz manager
      this.quizManager.addQuestions(data.questions);

      // Make sure quiz manager has updated userAnswers
      this.quizManager.userAnswers = this.userAnswers;

      // Update correctAnswers array for all batches - fixes instant feedback issues
      const newCorrectAnswers = data.questions.map((q) => ({
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || "No explanation available.",
      }));

      // Extend correctAnswers array with new answers
      if (!this.correctAnswers) {
        this.correctAnswers = newCorrectAnswers;
      } else {
        this.correctAnswers = [...this.correctAnswers, ...newCorrectAnswers];
      }

      // Pass updated correctAnswers to quiz manager for instant feedback
      this.quizManager.correctAnswers = this.correctAnswers;

      this.ui.showNotification(
        `${data.questions.length} new questions added! Total: ${data.newTotal}`,
        "info"
      );

      // Update progress indicator
      this.ui.updateProgressIndicator(data.completedBatches, data.totalBatches);

      this.quizManager.displayQuestionNavigation();
      this.quizManager.displayCondensedQuestionNavigation();

      // Refresh feedback if user has already answered current question
      // This fixes the issue with instant feedback during background processing
      this.quizManager.refreshFeedbackIfNeeded();
    }
  }

  handleProcessingComplete(data) {
    console.log("✅ All batches completed for PDF:", data.pdfId);
    this.ui.hideLoading();

    if (this.currentPdfId === data.pdfId) {
      this.ui.showNotification(
        `All questions extracted! Quiz completed with ${data.totalQuestions} total questions.`,
        "success"
      );
      this.ui.hideProgressIndicator();

      // 📊 Analytics: track successful PDF processing
      if (window.plausible) {
        window.plausible("pdf_processed", {
          props: {
            questions: data.totalQuestions,
          },
        });
      }
    }
  }

  handleProcessingCancelled(event) {
    console.log("🛑 Processing was cancelled:", event);
    this.ui.hideLoading();
    this.ui.showNotification(
      "Processing cancelled. You can upload a new PDF.",
      "info"
    );
  }

  cancelProcessing() {
    console.log("🛑 User requested to cancel processing");
    this.batchProcessor.cancel();
    this.ui.hideLoading();
  }

  async startQuiz() {
    this.ui.hideLoading();
    this.showSection("quiz-section");

    this.correctAnswers = this.quizData.map((q) => ({
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || "No explanation available.",
    }));

    await this.loadSavedQuizState(this.quizData.length);

    this.quizManager.initialize(
      this.quizData,
      this.userAnswers,
      this.currentPdfId,
      this.flaggedQuestions
    );
    this.quizManager.correctAnswers = this.correctAnswers;
  }

  async startQuizFromCache() {
    this.ui.hideLoading();
    this.showSection("quiz-section");

    // Initialize correctAnswers from quizData
    this.correctAnswers = this.quizData.map((q) => ({
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || "No explanation available.",
    }));

    await this.loadSavedQuizState(this.quizData.length);

    // Initialize quiz manager and pass correctAnswers
    this.quizManager.initialize(
      this.quizData,
      this.userAnswers,
      this.currentFile.name,
      this.flaggedQuestions
    );
    this.quizManager.correctAnswers = this.correctAnswers;

    this.ui.showNotification(
      `Loaded ${this.quizData.length} questions from cache!`,
      "success"
    );
  }

  async startQuizWithProgress(totalBatches, completedBatches) {
    this.ui.hideLoading();
    this.showSection("quiz-section");

    // Initialize correctAnswers from quizData if not already set
    if (
      !this.correctAnswers ||
      this.correctAnswers.length !== this.quizData.length
    ) {
      this.correctAnswers = this.quizData.map((q) => ({
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || "No explanation available.",
      }));
    }

    await this.loadSavedQuizState(this.quizData.length);

    // Initialize quiz manager and pass correctAnswers
    this.quizManager.initialize(
      this.quizData,
      this.userAnswers,
      this.currentFile.name,
      this.flaggedQuestions
    );
    this.quizManager.correctAnswers = this.correctAnswers;

    // Show background processing progress
    if (completedBatches < totalBatches) {
      this.ui.showProgressIndicator(completedBatches, totalBatches);
      this.ui.showNotification(
        `Quiz started with ${this.quizData.length} questions! More questions are being processed in the background.`,
        "info"
      );
    } else {
      this.ui.showNotification(
        `Quiz ready with ${this.quizData.length} questions!`,
        "success"
      );
    }
  }

  handleAnswerSelected(questionIndex, selectedAnswer) {
    this.userAnswers[questionIndex] = selectedAnswer;

    // Save user answers to persist across page refreshes
    if (this.currentPdfId) {
      // Use debounce to avoid too many database writes
      clearTimeout(this._saveAnswersTimeout);
      this._saveAnswersTimeout = setTimeout(() => {
        this.databaseManager
          .storeUserAnswers(
            this.currentPdfId,
            this.userAnswers,
            this.flaggedQuestions
          )
          .catch((error) => console.error("Error saving user answers:", error));
      }, 500); // Wait 500ms after last answer before saving
    }
  }

  async handleQuizCompleted(userAnswers) {
    // Ensure the app's userAnswers are updated from the quiz
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
          this.quizData
        );
      }

      // Use the updated userAnswers for analysis
      const results = await this.aiIntegration.analyzeAnswers(
        this.quizData,
        this.userAnswers,
        this.correctAnswers
      );
      this.showResults(results);

      // Save the final state to the database
      if (this.currentPdfId) {
        this.databaseManager
          .storeUserAnswers(this.currentPdfId, this.userAnswers)
          .catch((error) =>
            console.error("Error saving final answers:", error)
          );
      }

      // 📊 Analytics: track quiz completion event with score
      if (window.plausible) {
        const correctCount = results.correct;
        window.plausible("quiz_completed", {
          props: {
            total: results.total,
            correct: correctCount,
          },
        });
      }
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
    this.ui.showError(`Error processing PDF: ${error.message}`);
  }

  handleAIError(error) {
    console.error("AI error:", error);
    this.ui.hideLoading();
    this.ui.showError(`AI service error: ${error.message}`);
  }

  async handleSaveAPIKey() {
    const apiKeyInput = document.getElementById("api-key-input");
    const _statusElement = document.getElementById("api-key-status");
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
        this.showAPIKeyStatus(`❌ ${testResult.message}`, "error");
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

      // Add CSS for the reset answers button if it doesn't exist
      if (!document.getElementById("recent-exams-css")) {
        const style = document.createElement("style");
        style.id = "recent-exams-css";
        style.textContent = `
					.reset-answers-btn {
						background: #4b5563;
						color: white;
						border: none;
						border-radius: 50%;
						width: 28px;
						height: 28px;
						font-size: 16px;
						cursor: pointer;
						margin-right: 8px;
						display: flex;
						align-items: center;
						justify-content: center;
						transition: background-color 0.2s;
					}
					.reset-answers-btn:hover {
						background: #1e40af;
					}
					.answer-status {
						color: #4f46e5;
						font-weight: 500;
					}
				`;
        document.head.appendChild(style);
      }

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
      "readonly"
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
    const hasUserAnswers =
      pdf.userAnswers && pdf.userAnswers.filter((a) => a !== null).length > 0;
    const answeredCount = hasUserAnswers
      ? pdf.userAnswers.filter((a) => a !== null).length
      : 0;

    return `
			<div class="recent-exam-item" data-pdf-id="${pdf.id}">
				<div class="recent-exam-info">
					<div class="recent-exam-name">${pdf.filename}</div>
					<div class="recent-exam-meta">
						<span>${questionCount} questions</span>
						<span>Last accessed: ${lastAccessed}</span>
						${
              hasUserAnswers
                ? `<span class="answer-status">${answeredCount} answered</span>`
                : ""
            }
					</div>
				</div>
				<div class="recent-exam-actions">
					${
            hasUserAnswers
              ? `<button class="reset-answers-btn" data-pdf-id="${pdf.id}" title="Reset answers">↺</button>`
              : ""
          }
					<button class="sync-exam-btn" data-pdf-id="${
            pdf.id
          }" title="Sync exam">🔄</button>
					<button class="delete-exam-btn" data-pdf-id="${
            pdf.id
          }" title="Delete exam">×</button>
				</div>
			</div>
		`;
  }

  attachRecentExamListeners() {
    // Handle exam item clicks (start quiz)
    document.querySelectorAll(".recent-exam-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        // Don't trigger if delete button or reset button was clicked
        if (
          e.target.classList.contains("delete-exam-btn") ||
          e.target.classList.contains("reset-answers-btn")
        )
          return;

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

    // Handle reset answers button clicks
    document.querySelectorAll(".reset-answers-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent exam item click
        const pdfId = btn.dataset.pdfId;
        this.resetExamAnswers(pdfId);
      });
    });

    // Handle sync button clicks
    document.querySelectorAll(".sync-exam-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const pdfId = btn.dataset.pdfId;
        console.log(`[UI] Sync button clicked for PDF:`, pdfId);
        this.ui.showSyncModal(pdfId, this.p2pSyncManager);
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

      // Load saved answers and flagged questions
      await this.loadSavedQuizState(questions.length);

      // Initialize correctAnswers properly for instant feedback
      this.correctAnswers = questions.map((q) => ({
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || "No explanation available.",
      }));

      // Start quiz
      this.showSection("quiz-section");
      this.quizManager.initialize(
        this.quizData,
        this.userAnswers,
        pdf.filename,
        this.flaggedQuestions
      );

      // Pass the correctAnswers to quiz manager for instant feedback
      this.quizManager.correctAnswers = this.correctAnswers;

      this.ui.showNotification(
        `Loaded ${questions.length} questions from "${pdf.filename}"`,
        "success"
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
        `Delete "${pdf.filename}" and all its questions?`
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

  showNewFeaturesPrompt() {
    const lastSeenVersion = localStorage.getItem("did-exit-version") || "0.0";

    if (CURRENT_APP_VERSION > lastSeenVersion) {
      // Generate version history HTML
      let versionHistoryHTML = "";

      // Sort versions in descending order (newest first)
      const sortedVersions = [...content.versionHistory].sort(
        (a, b) => parseFloat(b.version) - parseFloat(a.version)
      );

      // Get all versions that are newer than the last seen version
      const newVersions = sortedVersions.filter(
        (version) => version.version > lastSeenVersion
      );

      if (newVersions.length > 0) {
        versionHistoryHTML = newVersions
          .map(
            (versionInfo) => `
					<div class="version-block">
						<h4 style="margin-bottom: 0.5rem;">Version ${versionInfo.version}</h4>
						<ul style="padding-left: 20px; margin-top: 0.5rem;">
							${versionInfo.features
                .map(
                  (feature) => `
								<li style="margin-bottom: 0.5rem;">
									<strong>${feature.title}:</strong> ${feature.description}
								</li>
							`
                )
                .join("")}
						</ul>
					</div>
				`
          )
          .join("");
      }

      const htmlContent = `
                <div style="text-align: left; padding: 0 1rem;">
                    <h3 style="margin-top: 0;">What's New in v${CURRENT_APP_VERSION}!</h3>
                    <p>We've added new features to improve your experience:</p>
                    ${versionHistoryHTML}
                </div>
            `;

      this.ui.showModal("What's New", htmlContent, [
        {
          text: "Got it!",
          className: "btn-primary",
          onClick: (() => {
            const self = this;
            return () => {
              localStorage.setItem("did-exit-version", CURRENT_APP_VERSION);
              self.ui.hideModal();
            };
          })(),
        },
      ]);
    }
  }

  async handleImagesExtracted(images) {
    console.log(`Image-based PDF detected with ${images.length} pages`);
    console.log(
      "handleImagesExtracted: images array first items:",
      images.slice(0, 2)
    );
    this.ui.updateLoadingMessage(
      "PDF appears image-based, performing AI image analysis..."
    );
    try {
      console.log(
        "handleImagesExtracted: invoking batchProcessor.processPDFInBatches"
      );
      const result = await this.batchProcessor.processPDFInBatches(
        this.currentFile,
        images
      );
      console.log("handleImagesExtracted: batchProcessor result:", result);
      if (result?.fromCache) {
        this.handleCacheHit(result);
      }
    } catch (error) {
      this.handleProcessingError(error);
    }
  }

  // Add a new method to reset exam answers
  async resetExamAnswers(pdfId) {
    try {
      // Get PDF info for confirmation
      const pdf = await this.databaseManager.getPDF(pdfId);
      if (!pdf) return;

      // Count number of answers to reset
      const answeredCount = pdf.userAnswers
        ? pdf.userAnswers.filter((a) => a !== null).length
        : 0;

      // Confirm reset
      const confirmed = confirm(
        `Reset ${answeredCount} answers for "${pdf.filename}"?`
      );
      if (!confirmed) return;

      // Clear user answers
      await this.databaseManager.clearUserAnswers(pdfId);

      // Reload the recent exams list
      this.loadRecentExams();

      this.ui.showNotification("Answers reset successfully", "info");
    } catch (error) {
      console.error("Error resetting exam answers:", error);
      this.ui.showError("Failed to reset answers");
    }
  }

  handleModeChanged(mode) {
    console.log("Quiz mode changed:", mode);

    // Store the current mode for later use when processing results
    this.quizMode = mode;

    // If switching to normal mode, we might need to pre-load correct answers
    if (mode === "normal" && this.quizData && this.quizData.length > 0) {
      // If we don't have correct answers yet, let's get them
      if (
        !this.correctAnswers ||
        this.correctAnswers.length !== this.quizData.length
      ) {
        this.ui.showLoading("Loading answer data...");

        // Use a promise to get correct answers
        this.aiIntegration
          .getCorrectAnswers(this.quizData)
          .then((correctAnswers) => {
            this.correctAnswers = correctAnswers;
            this.ui.hideLoading();

            // Refresh the current question's feedback if needed
            this.quizManager.refreshFeedbackIfNeeded();
          })
          .catch((error) => {
            this.handleAIError(error);
          });
      } else {
        // We already have correct answers, just refresh the feedback
        this.quizManager.refreshFeedbackIfNeeded();
      }
    }
  }

  async handleSyncedData(data) {
    try {
      console.log("[App] Received synced data, refreshing UI.", data);
      this.ui.showNotification(
        "Questions synchronized successfully!",
        "success"
      );
      // Refresh recent exams list so the newly imported PDF appears
      await this.loadRecentExams();
    } catch (err) {
      console.error("Failed handling synced data", err);
      this.ui.showError(`Sync failed: ${err.message}`);
    }
  }

  async loadSavedQuizState(quizLength) {
    let savedAnswers = null;
    let savedFlags = null;
    if (this.currentPdfId) {
      try {
        const { userAnswers, flaggedQuestions } =
          await this.databaseManager.getUserAnswers(this.currentPdfId);
        savedAnswers = userAnswers;
        savedFlags = flaggedQuestions;
        // Handle userAnswers
        if (savedAnswers && savedAnswers.length > 0) {
          if (savedAnswers.length !== quizLength) {
            this.userAnswers = new Array(quizLength).fill(null);
            savedAnswers.forEach((answer, index) => {
              if (index < this.userAnswers.length) {
                this.userAnswers[index] = answer;
              }
            });
          } else {
            this.userAnswers = savedAnswers;
          }
        } else {
          this.userAnswers = new Array(quizLength).fill(null);
        }
        // Handle flaggedQuestions
        if (savedFlags && savedFlags.length > 0) {
          if (savedFlags.length !== quizLength) {
            this.flaggedQuestions = new Array(quizLength).fill(false);
            savedFlags.forEach((flag, index) => {
              if (index < this.flaggedQuestions.length) {
                this.flaggedQuestions[index] = flag;
              }
            });
          } else {
            this.flaggedQuestions = savedFlags;
          }
        } else {
          this.flaggedQuestions = new Array(quizLength).fill(false);
        }
      } catch (error) {
        console.error("Error loading saved answers:", error);
        this.userAnswers = new Array(quizLength).fill(null);
        this.flaggedQuestions = new Array(quizLength).fill(false);
      }
    } else {
      this.userAnswers = new Array(quizLength).fill(null);
      this.flaggedQuestions = new Array(quizLength).fill(false);
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
