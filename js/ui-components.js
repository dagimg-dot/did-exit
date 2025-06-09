// UI Components and State Management
class UIComponents {
	constructor() {
		this.setupElements();
	}

	setupElements() {
		this.loadingElement = document.getElementById("loading");
		this.loadingMessage = this.loadingElement?.querySelector("p");
		this.resultsContainer = document.getElementById("results-breakdown");
		this.finalScore = document.getElementById("final-score");
		this.scorePercentage = document.getElementById("score-percentage");
	}

	showLoading(message = "Loading...") {
		if (this.loadingElement) {
			this.loadingElement.style.display = "block";
			if (this.loadingMessage) {
				this.loadingMessage.textContent = message;
			}
		}
	}

	hideLoading() {
		if (this.loadingElement) {
			this.loadingElement.style.display = "none";
		}
	}

	updateLoadingMessage(message) {
		if (this.loadingMessage) {
			this.loadingMessage.textContent = message;
		}
	}

	showError(message) {
		// Create or update error message element
		let errorElement = document.getElementById("global-error");
		if (!errorElement) {
			errorElement = document.createElement("div");
			errorElement.id = "global-error";
			errorElement.className = "error-message";
			errorElement.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #fef2f2;
                color: #dc2626;
                padding: 1rem 1.5rem;
                border-radius: 8px;
                border: 1px solid #fecaca;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                z-index: 1000;
                max-width: 400px;
                animation: slideIn 0.3s ease-out;
            `;

			// Add animation styles
			const style = document.createElement("style");
			style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `;
			document.head.appendChild(style);

			document.body.appendChild(errorElement);
		}

		errorElement.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 1.2rem;">⚠️</span>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" 
                        style="margin-left: auto; background: none; border: none; font-size: 1.2rem; cursor: pointer;">×</button>
            </div>
        `;

		// Auto-hide after 7 seconds
		setTimeout(() => {
			if (errorElement && errorElement.parentNode) {
				errorElement.remove();
			}
		}, 7000);
	}

	displayResults(results) {
		// Update score display
		if (this.finalScore) {
			this.finalScore.textContent = results.score;
		}

		if (this.scorePercentage) {
			this.scorePercentage.textContent = `${results.percentage}%`;

			// Add color coding based on percentage
			if (results.percentage >= 80) {
				this.scorePercentage.style.color = "#10b981"; // Green
			} else if (results.percentage >= 60) {
				this.scorePercentage.style.color = "#f59e0b"; // Yellow
			} else {
				this.scorePercentage.style.color = "#ef4444"; // Red
			}
		}

		// Display detailed results
		if (this.resultsContainer) {
			this.resultsContainer.innerHTML = this.generateResultsHTML(results);
		}

		// Add summary statistics
		this.addResultsSummary(results);
	}

	generateResultsHTML(results) {
		let html = `
            <div class="results-summary">
                <div class="summary-stats">
                    <div class="stat-item">
                        <span class="stat-value">${results.correctCount}</span>
                        <span class="stat-label">Correct</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${results.incorrectCount}</span>
                        <span class="stat-label">Incorrect</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${results.totalQuestions}</span>
                        <span class="stat-label">Total</span>
                    </div>
                </div>
            </div>
        `;

		// Add detailed breakdown
		results.details.forEach((detail, index) => {
			const statusIcon = detail.isCorrect ? "✅" : "❌";
			const statusClass = detail.isCorrect
				? "status-correct"
				: "status-incorrect";

			html += `
                <div class="result-item">
                    <div class="result-question">
                        <span class="${statusClass}">
                            <span class="status-icon">${statusIcon}</span>
                            Question ${index + 1}
                        </span>
                        <p>${detail.question}</p>
                    </div>
                    <div class="result-answers">
                        <div class="result-answer your-answer">
                            <div class="result-answer-label">Your Answer</div>
                            <div>${detail.userAnswerText}</div>
                        </div>
                        ${
													!detail.isCorrect
														? `
                            <div class="result-answer correct-answer">
                                <div class="result-answer-label">Correct Answer</div>
                                <div>${detail.correctAnswerText}</div>
                            </div>
                        `
														: ""
												}
                        ${
													detail.explanation
														? `
                            <div class="result-explanation">
                                <div class="result-answer-label">Explanation</div>
                                <div>${detail.explanation}</div>
                            </div>
                        `
														: ""
												}
                    </div>
                </div>
            `;
		});

		return html;
	}

	addResultsSummary(results) {
		// Add CSS for summary stats if not already present
		if (!document.getElementById("results-summary-styles")) {
			const style = document.createElement("style");
			style.id = "results-summary-styles";
			style.textContent = `
                .results-summary {
                    margin-bottom: 2rem;
                    padding: 1.5rem;
                    background: var(--background-color);
                    border-radius: var(--border-radius);
                }
                
                .summary-stats {
                    display: flex;
                    justify-content: space-around;
                    text-align: center;
                }
                
                .stat-item {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                
                .stat-value {
                    font-size: 2rem;
                    font-weight: 700;
                    color: var(--primary-color);
                }
                
                .stat-label {
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .result-explanation {
                    background: #f8fafc;
                    border-left: 4px solid var(--primary-color);
                    padding: 0.75rem;
                    border-radius: 4px;
                    margin-top: 0.5rem;
                }
                
                @media (max-width: 480px) {
                    .summary-stats {
                        flex-direction: column;
                        gap: 1rem;
                    }
                    
                    .stat-value {
                        font-size: 1.5rem;
                    }
                }
            `;
			document.head.appendChild(style);
		}
	}

	// Utility method to show success message
	showSuccess(message) {
		let successElement = document.getElementById("global-success");
		if (!successElement) {
			successElement = document.createElement("div");
			successElement.id = "global-success";
			successElement.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #f0fdf4;
                color: #166534;
                padding: 1rem 1.5rem;
                border-radius: 8px;
                border: 1px solid #bbf7d0;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                z-index: 1000;
                max-width: 400px;
                animation: slideIn 0.3s ease-out;
            `;
			document.body.appendChild(successElement);
		}

		successElement.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 1.2rem;">✅</span>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" 
                        style="margin-left: auto; background: none; border: none; font-size: 1.2rem; cursor: pointer;">×</button>
            </div>
        `;

		// Auto-hide after 5 seconds
		setTimeout(() => {
			if (successElement && successElement.parentNode) {
				successElement.remove();
			}
		}, 5000);
	}

	// Method to show quiz progress
	showProgress(current, total) {
		let progressElement = document.getElementById("quiz-progress");
		if (!progressElement) {
			progressElement = document.createElement("div");
			progressElement.id = "quiz-progress";
			progressElement.style.cssText = `
                position: fixed;
                top: 20px;
                left: 20px;
                background: var(--card-background);
                padding: 0.75rem 1rem;
                border-radius: 8px;
                box-shadow: var(--shadow);
                z-index: 1000;
                font-size: 0.9rem;
                color: var(--text-secondary);
            `;
			document.body.appendChild(progressElement);
		}

		progressElement.textContent = `Question ${current} of ${total}`;
	}

	hideProgress() {
		const progressElement = document.getElementById("quiz-progress");
		if (progressElement) {
			progressElement.remove();
		}
	}

	// Method to create custom modal
	showModal(title, content, buttons = []) {
		const modal = document.createElement("div");
		modal.id = "custom-modal";
		modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
        `;

		const modalContent = document.createElement("div");
		modalContent.style.cssText = `
            background: var(--card-background);
            padding: 2rem;
            border-radius: var(--border-radius);
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        `;

		let buttonsHTML = "";
		if (buttons.length > 0) {
			buttonsHTML =
				'<div style="margin-top: 1.5rem; display: flex; gap: 1rem; justify-content: flex-end;">';
			buttons.forEach((button) => {
				buttonsHTML += `<button class="btn ${button.class || "btn-primary"}" onclick="${button.onclick || ""}">${button.text}</button>`;
			});
			buttonsHTML += "</div>";
		}

		modalContent.innerHTML = `
            <h2 style="margin-bottom: 1rem;">${title}</h2>
            <div>${content}</div>
            ${buttonsHTML}
        `;

		modal.appendChild(modalContent);
		document.body.appendChild(modal);

		// Close modal when clicking outside
		modal.addEventListener("click", (e) => {
			if (e.target === modal) {
				modal.remove();
			}
		});

		return modal;
	}

	hideModal() {
		const modal = document.getElementById("custom-modal");
		if (modal) {
			modal.remove();
		}
	}
}

export { UIComponents };
