// Quiz management and navigation
class QuizManager {
	constructor() {
		this.events = {};
		this.questions = [];
		this.userAnswers = [];
		this.currentQuestionIndex = 0;
		this.isReviewMode = false;
		this.setupElements();
		this.setupEventListeners();
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
	}

	setupEventListeners() {
		this.prevBtn.addEventListener("click", () => this.previousQuestion());
		this.nextBtn.addEventListener("click", () => this.nextQuestion());
		this.submitBtn.addEventListener("click", () => this.submitQuiz());
	}

	initialize(questions) {
		this.questions = questions;
		this.userAnswers = new Array(questions.length).fill(null);
		this.currentQuestionIndex = 0;
		this.isReviewMode = false;

		this.totalQuestionsSpan.textContent = questions.length;
		this.displayCurrentQuestion();
		this.updateNavigation();
		this.updateProgress();

		console.log("Quiz initialized with", questions.length, "questions");
	}

	displayCurrentQuestion() {
		if (!this.questions.length) return;

		const question = this.questions[this.currentQuestionIndex];
		this.questionText.textContent = question.question;
		this.currentQuestionSpan.textContent = this.currentQuestionIndex + 1;

		this.renderOptions(question);
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
			if (!this.isReviewMode) {
				this.selectOption(index);
			}
		});

		return optionDiv;
	}

	selectOption(selectedIndex) {
		// Remove previous selection
		this.optionsContainer.querySelectorAll(".option").forEach((opt) => {
			opt.classList.remove("selected");
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

		// Update navigation
		this.updateNavigation();

		// Emit event
		this.emit("answerSelected", this.currentQuestionIndex, selectedIndex);

		console.log(
			`Question ${this.currentQuestionIndex + 1}: Selected option ${selectedIndex}`,
		);
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
			this.nextBtn.disabled = !hasAnswer;
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

		console.log("Quiz submitted:", this.userAnswers);
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

		// Reset UI elements
		this.questionText.textContent = "Question will appear here...";
		this.optionsContainer.innerHTML = "";
		this.currentQuestionSpan.textContent = "1";
		this.totalQuestionsSpan.textContent = "10";
		this.progressFill.style.width = "0%";

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
			console.warn("No valid questions to add");
			return;
		}

		console.log(`📚 Adding ${newQuestions.length} new questions to quiz`);

		// Add new questions to the existing array
		this.questions.push(...newQuestions);

		// Extend user answers array to accommodate new questions
		const additionalAnswers = new Array(newQuestions.length).fill(null);
		this.userAnswers.push(...additionalAnswers);

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

		console.log(`✅ Quiz now has ${this.questions.length} total questions`);

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
}

export { QuizManager };
