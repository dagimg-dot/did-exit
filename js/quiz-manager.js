// Quiz management and navigation
class QuizManager {
	constructor() {
		this.events = {};
		this.questions = [];
		this.userAnswers = [];
		this.currentQuestionIndex = 0;
		this.isReviewMode = false;
		this.mode = "exam"; // Default mode: "exam" or "normal"
		this.correctAnswers = []; // Store correct answers for normal mode
		this.setupElements();
		this.setupEventListeners();

		// Ensure UI is in exam mode by default
		if (this.modeToggle) {
			this.modeToggle.checked = false; // Unchecked = exam mode
		}
	}

	setupElements() {
		this.questionText = document.getElementById("question-text");
		this.optionsContainer = document.getElementById("options-container");
		this.currentQuestionSpan = document.getElementById("current-question");
		this.totalQuestionsSpan = document.getElementById("total-questions");
		this.progressFill = document.getElementById("progress-fill");
		this.prevBtn = document.getElementById("prev-btn");
		this.nextBtn = document.getElementById("next-btn");
		this.submitBtn = document.getElementById("submit-quiz-btn");
		this.explanationContainer = document.getElementById(
			"explanation-container",
		);
		this.explanationText = document.getElementById("explanation-text");
		this.modeToggle = document.getElementById("quiz-mode-toggle");

		// Add event listener for mode toggle
		if (this.modeToggle) {
			this.modeToggle.addEventListener("change", () => {
				const newMode = this.modeToggle.checked ? "normal" : "exam";
				this.setMode(newMode);
			});
		}
	}

	setMode(mode) {
		if (this.mode === mode) return;

		this.mode = mode;

		// Update UI for the mode
		if (this.modeToggle) {
			this.modeToggle.checked = mode === "normal";
		}

		// When switching to exam mode, remove any correct/incorrect indicators
		if (mode === "exam") {
			this.optionsContainer.querySelectorAll(".option").forEach((opt) => {
				opt.classList.remove("correct");
				opt.classList.remove("incorrect");
			});

			// Hide explanation
			if (this.explanationContainer) {
				this.explanationContainer.style.display = "none";
			}
		}

		// Rerender current question with new mode settings
		this.displayCurrentQuestion();
		this.updateNavigation();

		// If switching to normal mode and the current question is already answered,
		// we need to show feedback immediately
		if (mode === "normal") {
			const currentAnswer = this.userAnswers[this.currentQuestionIndex];
			if (currentAnswer !== null) {
				// Short timeout to ensure DOM is ready
				setTimeout(() => {
					this.showImmediateFeedback(currentAnswer);
				}, 50);
			}
		}

		// Emit event for mode change
		this.emit("modeChanged", mode);
	}

	setupEventListeners() {
		this.prevBtn.addEventListener("click", () => this.previousQuestion());
		this.nextBtn.addEventListener("click", () => this.nextQuestion());
		this.submitBtn.addEventListener("click", () => this.submitQuiz());
		this.setupKeydownListener();
	}

	setupKeydownListener() {
		document.addEventListener("keydown", (event) => {
			const quizSection = document.getElementById("quiz-section");
			if (quizSection.classList.contains("active")) {
				if (event.key === "ArrowLeft" && !this.prevBtn.disabled) {
					this.previousQuestion();
				} else if (event.key === "ArrowRight" && !this.nextBtn.disabled) {
					this.nextQuestion();
				}
			}
		});
	}

	initialize(questions, existingAnswers = null) {
		this.questions = questions;
		this.userAnswers =
			existingAnswers || new Array(questions.length).fill(null);
		this.currentQuestionIndex = 0;
		this.isReviewMode = false;

		// Extract correct answers for normal mode
		this.correctAnswers = questions.map((q, index) => {
			return {
				correctAnswer: q.correctAnswer,
				explanation: q.explanation || "No explanation provided.",
			};
		});

		this.totalQuestionsSpan.textContent = questions.length;
		this.displayCurrentQuestion();
		this.updateNavigation();
		this.updateProgress();
	}

	displayCurrentQuestion() {
		if (!this.questions.length) return;

		const question = this.questions[this.currentQuestionIndex];
		this.questionText.textContent = question.question;
		this.currentQuestionSpan.textContent = this.currentQuestionIndex + 1;

		// Reset explanation container
		if (this.explanationContainer) {
			this.explanationContainer.style.display = "none";
		}
		if (this.explanationText) {
			this.explanationText.textContent = "";
		}

		this.renderOptions(question);

		// If in normal mode and already answered, show the feedback again
		const currentAnswer = this.userAnswers[this.currentQuestionIndex];
		if (this.mode === "normal" && currentAnswer !== null) {
			this.showImmediateFeedback(currentAnswer);
		}
	}

	renderOptions(question) {
		this.optionsContainer.innerHTML = "";

		question.options.forEach((option, index) => {
			const optionElement = this.createOptionElement(option, index);
			this.optionsContainer.appendChild(optionElement);
		});
	}

	createOptionElement(optionText, index) {
		const optionDiv = document.createElement("div");
		optionDiv.className = "option";
		optionDiv.dataset.optionIndex = index;

		// Check if this option is selected
		const isSelected = this.userAnswers[this.currentQuestionIndex] === index;
		if (isSelected) {
			optionDiv.classList.add("selected");
		}

		optionDiv.innerHTML = `
            <div class="option-radio"></div>
            <div class="option-text">${optionText}</div>
        `;

		// Add click handler for option selection
		optionDiv.addEventListener("click", () => {
			// Don't allow selection in review mode
			if (this.isReviewMode) {
				return;
			}

			// In normal mode, don't allow changing answer after selection
			const currentAnswer = this.userAnswers[this.currentQuestionIndex];
			if (
				this.mode === "normal" &&
				currentAnswer !== null &&
				currentAnswer !== index
			) {
				return;
			}

			this.selectOption(index);
		});

		return optionDiv;
	}

	selectOption(selectedIndex) {
		// Remove previous selection
		this.optionsContainer.querySelectorAll(".option").forEach((opt) => {
			opt.classList.remove("selected");

			// Only remove correct/incorrect classes in exam mode
			if (this.mode === "exam") {
				opt.classList.remove("correct");
				opt.classList.remove("incorrect");
			}
		});

		// Add selection to clicked option
		const selectedOption = this.optionsContainer.querySelector(
			`[data-option-index="${selectedIndex}"]`,
		);
		if (selectedOption) {
			selectedOption.classList.add("selected");
		}

		// Store user answer
		this.userAnswers[this.currentQuestionIndex] = selectedIndex;

		// In normal mode, show feedback immediately
		if (this.mode === "normal") {
			// Short timeout to ensure DOM updates
			setTimeout(() => {
				this.showImmediateFeedback(selectedIndex);
			}, 10);
		}

		// Update navigation
		this.updateNavigation();

		// Emit event
		this.emit("answerSelected", this.currentQuestionIndex, selectedIndex);
	}

	showImmediateFeedback(selectedIndex) {
		// Guard clause in case correctAnswers is not properly initialized
		if (
			!this.correctAnswers ||
			!this.correctAnswers[this.currentQuestionIndex]
		) {
			return;
		}

		const correctAnswer =
			this.correctAnswers[this.currentQuestionIndex].correctAnswer;
		const explanation =
			this.correctAnswers[this.currentQuestionIndex].explanation;

		// First clear any existing feedback
		this.optionsContainer.querySelectorAll(".option").forEach((opt) => {
			opt.classList.remove("correct");
			opt.classList.remove("incorrect");
		});

		// Then mark options as correct/incorrect
		this.optionsContainer.querySelectorAll(".option").forEach((opt) => {
			const optIndex = parseInt(opt.dataset.optionIndex);

			if (optIndex === correctAnswer) {
				opt.classList.add("correct");
			}

			if (optIndex === selectedIndex && selectedIndex !== correctAnswer) {
				opt.classList.add("incorrect");
			}
		});

		// Show explanation
		if (this.explanationText) {
			this.explanationText.textContent =
				explanation || "No explanation available.";
		} else {
			console.error("Explanation text element not found");
		}

		if (this.explanationContainer) {
			this.explanationContainer.style.display = "block";
		} else {
			console.error("Explanation container element not found");
		}
	}

	previousQuestion() {
		if (this.currentQuestionIndex > 0) {
			this.currentQuestionIndex--;
			this.displayCurrentQuestion();
			this.updateNavigation();
			this.updateProgress();
		}
	}

	nextQuestion() {
		if (this.currentQuestionIndex < this.questions.length - 1) {
			this.currentQuestionIndex++;
			this.displayCurrentQuestion();
			this.updateNavigation();
			this.updateProgress();
		}
	}

	updateNavigation() {
		// Previous button
		this.prevBtn.disabled = this.currentQuestionIndex === 0;

		// Next button
		const hasAnswer = this.userAnswers[this.currentQuestionIndex] !== null;
		const isLastQuestion =
			this.currentQuestionIndex === this.questions.length - 1;

		if (isLastQuestion) {
			this.nextBtn.style.display = "none";
			this.submitBtn.style.display = hasAnswer ? "inline-flex" : "none";
		} else {
			this.nextBtn.style.display = "inline-flex";

			// In normal mode, enable Next button regardless of answer
			this.nextBtn.disabled = this.mode === "exam" ? !hasAnswer : false;

			this.submitBtn.style.display = "none";
		}
	}

	updateProgress() {
		const progress =
			((this.currentQuestionIndex + 1) / this.questions.length) * 100;
		this.progressFill.style.width = `${progress}%`;
	}

	submitQuiz() {
		// Check if all questions are answered
		const unansweredCount = this.userAnswers.filter(
			(answer) => answer === null,
		).length;

		if (unansweredCount > 0) {
			const confirmSubmit = confirm(
				`You have ${unansweredCount} unanswered question(s). ` +
					"Are you sure you want to submit the quiz?",
			);

			if (!confirmSubmit) {
				return;
			}
		}

		this.emit("quizCompleted", this.userAnswers);
	}

	showReview(userAnswers, correctAnswers) {
		this.isReviewMode = true;
		this.userAnswers = userAnswers;
		this.currentQuestionIndex = 0;

		this.displayReviewQuestion(correctAnswers);
		this.updateReviewNavigation();
	}

	displayReviewQuestion(correctAnswers) {
		if (!this.questions.length) return;

		const question = this.questions[this.currentQuestionIndex];
		const correctAnswer = correctAnswers[this.currentQuestionIndex];
		const userAnswer = this.userAnswers[this.currentQuestionIndex];

		this.questionText.textContent = question.question;
		this.currentQuestionSpan.textContent = this.currentQuestionIndex + 1;

		this.renderReviewOptions(question, userAnswer, correctAnswer.correctAnswer);
	}

	renderReviewOptions(question, userAnswer, correctAnswer) {
		this.optionsContainer.innerHTML = "";

		question.options.forEach((option, index) => {
			const optionElement = this.createReviewOptionElement(
				option,
				index,
				userAnswer,
				correctAnswer,
			);
			this.optionsContainer.appendChild(optionElement);
		});
	}

	createReviewOptionElement(optionText, index, userAnswer, correctAnswer) {
		const optionDiv = document.createElement("div");
		optionDiv.className = "option";

		// Add appropriate classes for review mode
		if (index === correctAnswer) {
			optionDiv.classList.add("correct");
		}

		if (index === userAnswer) {
			optionDiv.classList.add("selected");
			if (index !== correctAnswer) {
				optionDiv.classList.add("incorrect");
			}
		}

		optionDiv.innerHTML = `
            <div class="option-radio"></div>
            <div class="option-text">${optionText}</div>
        `;

		return optionDiv;
	}

	updateReviewNavigation() {
		this.prevBtn.disabled = this.currentQuestionIndex === 0;
		this.nextBtn.disabled =
			this.currentQuestionIndex === this.questions.length - 1;
		this.nextBtn.style.display = "inline-flex";
		this.submitBtn.style.display = "none";

		// Update button text for review mode
		if (this.currentQuestionIndex === this.questions.length - 1) {
			this.nextBtn.textContent = "Finish Review";
			this.nextBtn.disabled = false;
			this.nextBtn.onclick = () => {
				// Return to results
				window.app.showSection("results-section");
			};
		} else {
			this.nextBtn.textContent = "Next";
			this.nextBtn.onclick = () => this.nextQuestion();
		}
	}

	reset() {
		this.questions = [];
		this.userAnswers = [];
		this.currentQuestionIndex = 0;
		this.isReviewMode = false;

		// Reset to exam mode
		this.mode = "exam";
		if (this.modeToggle) {
			this.modeToggle.checked = false; // Unchecked = exam mode
		}

		// Reset UI elements
		this.questionText.textContent = "Question will appear here...";
		this.optionsContainer.innerHTML = "";
		this.currentQuestionSpan.textContent = "1";
		this.totalQuestionsSpan.textContent = "10";
		this.progressFill.style.width = "0%";

		// Reset explanation
		if (this.explanationContainer) {
			this.explanationContainer.style.display = "none";
		}
		if (this.explanationText) {
			this.explanationText.textContent = "";
		}

		// Reset buttons
		this.prevBtn.disabled = true;
		this.nextBtn.disabled = true;
		this.nextBtn.style.display = "inline-flex";
		this.nextBtn.textContent = "Next";
		this.submitBtn.style.display = "none";
	}

	// Add questions dynamically (for batch processing)
	addQuestions(newQuestions) {
		if (!Array.isArray(newQuestions) || newQuestions.length === 0) {
			return;
		}

		// Add new questions to the existing array
		this.questions.push(...newQuestions);

		// Extend user answers array to accommodate new questions
		// Only extend if the current array isn't already large enough
		// This preserves existing answers when extending
		if (this.userAnswers.length < this.questions.length) {
			const additionalCount = this.questions.length - this.userAnswers.length;
			const additionalAnswers = new Array(additionalCount).fill(null);
			this.userAnswers.push(...additionalAnswers);
		}

		// Update total questions display
		this.totalQuestionsSpan.textContent = this.questions.length;

		// Update navigation if we're on the last question and now have more
		const wasLastQuestion =
			this.currentQuestionIndex ===
			this.questions.length - newQuestions.length - 1;
		if (wasLastQuestion) {
			this.updateNavigation();
		}

		// Update progress bar calculation
		this.updateProgress();

		// Emit event for any listeners
		this.emit("questionsAdded", {
			newQuestions: newQuestions,
			totalQuestions: this.questions.length,
		});
	}

	// Get current question context for batch processing
	getCurrentContext() {
		return {
			currentQuestionIndex: this.currentQuestionIndex,
			totalQuestions: this.questions.length,
			answeredCount: this.userAnswers.filter((answer) => answer !== null)
				.length,
			isOnLastQuestion: this.currentQuestionIndex === this.questions.length - 1,
			hasAnsweredCurrent: this.userAnswers[this.currentQuestionIndex] !== null,
		};
	}

	// Method to handle seamless question expansion
	handleQuestionExpansion(newQuestions) {
		const context = this.getCurrentContext();

		// Add the new questions
		this.addQuestions(newQuestions);

		// If user was on last question and hadn't submitted, update UI to show they can continue
		if (context.isOnLastQuestion && context.hasAnsweredCurrent) {
			// Hide submit button, show next button
			this.nextBtn.style.display = "inline-flex";
			this.nextBtn.disabled = false;
			this.submitBtn.style.display = "none";

			// Show a subtle indicator that more questions are available
			this.emit("moreQuestionsAvailable", {
				newCount: newQuestions.length,
				totalCount: this.questions.length,
			});
		}
	}

	// Get quiz statistics
	getStats() {
		const answeredCount = this.userAnswers.filter(
			(answer) => answer !== null,
		).length;
		const totalQuestions = this.questions.length;

		return {
			totalQuestions,
			answeredCount,
			unansweredCount: totalQuestions - answeredCount,
			progress: totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0,
		};
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

	// Add a method to refresh feedback for the current question
	refreshFeedbackIfNeeded() {
		// Only refresh if we're in normal mode and have an answer for the current question
		if (
			this.mode === "normal" &&
			this.userAnswers[this.currentQuestionIndex] !== null &&
			this.correctAnswers &&
			this.correctAnswers[this.currentQuestionIndex]
		) {
			// Get the selected answer for the current question
			const selectedIndex = this.userAnswers[this.currentQuestionIndex];

			// Show feedback with a small delay to ensure UI is ready
			setTimeout(() => {
				this.showImmediateFeedback(selectedIndex);
			}, 50);

			console.log(
				`Refreshed feedback for question ${this.currentQuestionIndex + 1}`,
			);
		}
	}
}

export { QuizManager };
