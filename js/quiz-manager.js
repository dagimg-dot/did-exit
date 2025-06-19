// Quiz management and navigation
class QuizManager {
  constructor() {
    this.events = {};
    this.questions = [];
    this.userAnswers = [];
    this.currentQuestionIndex = 0;
    this.isReviewMode = false;
    this.flaggedQuestions = [];
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
    this.pdfFileSpan = document.getElementById("pdf-file-name");
    this.totalQuestionsSpan = document.getElementById("total-questions");
    this.progressFill = document.getElementById("progress-fill");
    this.prevBtn = document.getElementById("prev-btn");
    this.nextBtn = document.getElementById("next-btn");
    this.submitBtn = document.getElementById("submit-quiz-btn");
    this.resumeBtn = document.getElementById("resume-btn");
    this.explanationContainer = document.getElementById(
      "explanation-container"
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
    if (this.resumeBtn) {
      this.resumeBtn.addEventListener("click", () =>
        this.navigateToLastAnswered()
      );
    }
    this.setupKeydownListener();
  }

	setupKeydownListener() {
		document.addEventListener("keydown", (event) => {
			const quizSection = document.getElementById("quiz-section");
			if (quizSection.classList.contains("active")) {
				if (event.key === "ArrowLeft" && !this.prevBtn.disabled) {
					this.previousQuestion();
				} else if (
					event.key === "ArrowRight" &&
					!this.nextBtn.disabled
				) {
					this.nextQuestion();
				}
			}
		});
	}

  initialize(questions, existingAnswers = null, pdfName) {
    this.questions = questions;
    this.userAnswers =
      existingAnswers || new Array(questions.length).fill(null);
    this.currentQuestionIndex = 0;
    this.isReviewMode = false;
    this.flaggedQuestions = new Array(questions.length).fill(false);

    // Extract correct answers for normal mode
    this.correctAnswers = questions.map((q, index) => {
      return {
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || "No explanation provided.",
      };
    });

    this.totalQuestionsSpan.textContent = questions.length;
    this.pdfFileSpan.textContent = pdfName ? `- ${pdfName}` : "";
    this.displayCurrentQuestion();
    this.updateNavigation();
    this.updateProgress();
    this.updateResumeButton();
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
    this.displayQuestionNavigation();

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
		const isSelected =
			this.userAnswers[this.currentQuestionIndex] === index;
		if (isSelected) {
			optionDiv.classList.add("selected");
		}

    // Create option radio element
    const optionRadio = document.createElement("div");
    optionRadio.className = "option-radio";

    // Create option text element
    const optionTextDiv = document.createElement("div");
    optionTextDiv.className = "option-text";
    optionTextDiv.textContent = optionText;

    // Append children
    optionDiv.appendChild(optionRadio);
    optionDiv.appendChild(optionTextDiv);

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
      `[data-option-index="${selectedIndex}"]`
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
    this.displayQuestionNavigation();
    this.updateNavigation();
    this.updateResumeButton();

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
      this.updateResumeButton();
    }
  }

  nextQuestion() {
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
      this.displayCurrentQuestion();
      this.updateNavigation();
      this.updateProgress();
      this.updateResumeButton();
    }
  }

  displayQuestionNavigation() {
    const navList = document.getElementById("nav-list");
    if (!navList) return;
    navList.innerHTML = "";
    this.questions.forEach((question, index) => {
      const navItem = document.createElement("li");
      const btn = document.createElement("button");
      btn.className = "question-nav-btn";
      btn.textContent = index + 1;
      if (this.userAnswers[index] !== null) {
        btn.classList.add("answered");
        btn.title = "Answered";
      } else {
        btn.classList.add("unanswered");
        btn.title = "Unanswered";
      }
      if (index === this.currentQuestionIndex) {
        btn.classList.add("active");
      }

      if (this.flaggedQuestions[index]) {
        navItem.style.position = "relative";
        const flagImg = document.createElement("img");
        flagImg.src = "./assets/red-flag.png";
        flagImg.alt = "Flagged";
        flagImg.width = "16";
        flagImg.height = "16";
        flagImg.style.position = "absolute";
        flagImg.style.top = "-10px";
        navItem.appendChild(flagImg);
      }

      btn.addEventListener("click", () => {
        this.currentQuestionIndex = index;
        this.displayCurrentQuestion();
        this.updateNavigation();
        this.updateProgress();
        this.updateResumeButton();
      });

      let pressTimer = null;

      btn.addEventListener("mousedown", (e) => {
        pressTimer = setTimeout(() => {
          this.flaggedQuestions[index] = !this.flaggedQuestions[index];
          this.displayQuestionNavigation();
        }, 600);
      });

      btn.addEventListener("mouseleave", () => clearTimeout(pressTimer));
      btn.addEventListener("mouseup", () => clearTimeout(pressTimer));

      btn.addEventListener("touchstart", (e) => {
        pressTimer = setTimeout(() => {
          this.flaggedQuestions[index] = !this.flaggedQuestions[index];
          this.displayQuestionNavigation();
        }, 600);
      });

      btn.addEventListener("touchend", () => clearTimeout(pressTimer));
      btn.addEventListener("touchcancel", () => clearTimeout(pressTimer));

      navItem.appendChild(btn);
      navList.appendChild(navItem);
    });
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
      (answer) => answer === null
    ).length;

    if (unansweredCount > 0) {
      const confirmSubmit = confirm(
        `You have ${unansweredCount} unanswered question(s). ` +
          "Are you sure you want to submit the quiz?"
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

		this.renderReviewOptions(
			question,
			userAnswer,
			correctAnswer.correctAnswer,
		);
	}

  renderReviewOptions(question, userAnswer, correctAnswer) {
    this.optionsContainer.innerHTML = "";

    question.options.forEach((option, index) => {
      const optionElement = this.createReviewOptionElement(
        option,
        index,
        userAnswer,
        correctAnswer
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

    // Create option radio element
    const optionRadio = document.createElement("div");
    optionRadio.className = "option-radio";

    // Create option text element
    const optionTextDiv = document.createElement("div");
    optionTextDiv.className = "option-text";
    optionTextDiv.textContent = optionText;

    // Append children
    optionDiv.appendChild(optionRadio);
    optionDiv.appendChild(optionTextDiv);

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
    this.pdfFileSpan.textContent = "";

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
			const additionalCount =
				this.questions.length - this.userAnswers.length;
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
			isOnLastQuestion:
				this.currentQuestionIndex === this.questions.length - 1,
			hasAnsweredCurrent:
				this.userAnswers[this.currentQuestionIndex] !== null,
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
      (answer) => answer !== null
    ).length;
    const totalQuestions = this.questions.length;

		return {
			totalQuestions,
			answeredCount,
			unansweredCount: totalQuestions - answeredCount,
			progress:
				totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0,
		};
	}

  // Event system
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach((callback) => callback(...args));
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
        `Refreshed feedback for question ${this.currentQuestionIndex + 1}`
      );
    }
  }

  // Find the index of the last answered question
  findLastAnsweredQuestionIndex() {
    for (let i = this.userAnswers.length - 1; i >= 0; i--) {
      if (this.userAnswers[i] !== null) {
        return i;
      }
    }
    return -1; // No answered questions found
  }

  // Navigate to the last answered question
  navigateToLastAnswered() {
    const lastAnsweredIndex = this.findLastAnsweredQuestionIndex();
    if (
      lastAnsweredIndex !== -1 &&
      lastAnsweredIndex !== this.currentQuestionIndex
    ) {
      this.currentQuestionIndex = lastAnsweredIndex;
      this.displayCurrentQuestion();
      this.updateNavigation();
      this.updateProgress();
      this.updateResumeButton();
    }
  }

  // Update the resume button visibility based on answered questions
  updateResumeButton() {
    if (!this.resumeBtn) return;

    // Only show the resume button if we're not already on the last answered question
    // and there's at least one answered question
    const lastAnsweredIndex = this.findLastAnsweredQuestionIndex();
    const shouldShow =
      !this.isReviewMode &&
      lastAnsweredIndex !== -1 &&
      this.currentQuestionIndex !== lastAnsweredIndex;

    this.resumeBtn.style.display = shouldShow ? "inline-flex" : "none";
  }
}

export { QuizManager };
