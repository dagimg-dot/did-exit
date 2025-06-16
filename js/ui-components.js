// UI Components and State Management
class UIComponents {
	constructor() {
		this.setupElements();
		this.modalElement = null;
	}

	setupElements() {
		this.fileActions = document.getElementById("file-actions");
		this.processingStatus = document.getElementById("processing-status");
		this.loadingMessage = document.getElementById("loading-message");
		this.resultsContainer = document.getElementById("results-breakdown");
		this.finalScore = document.getElementById("final-score");
		this.scorePercentage = document.getElementById("score-percentage");
	}

	showLoading(message = "Processing PDF...") {
		if (this.fileActions) this.fileActions.style.display = "none";
		if (this.processingStatus) {
			this.processingStatus.style.display = "block";
		}
		this.updateLoadingMessage(message);
	}

	hideLoading() {
		if (this.fileActions) this.fileActions.style.display = "block";
		if (this.processingStatus) {
			this.processingStatus.style.display = "none";
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

	// Helper method to escape HTML content
	escapeHTML(str) {
		if (!str) return "";
		return String(str)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
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
                        <p>${this.escapeHTML(detail.question)}</p>
                    </div>
                    <div class="result-answers">
                        <div class="result-answer your-answer">
                            <div class="result-answer-label">Your Answer</div>
                            <div>${this.escapeHTML(detail.userAnswerText)}</div>
                        </div>
                        ${
													!detail.isCorrect
														? `
                            <div class="result-answer correct-answer">
                                <div class="result-answer-label">Correct Answer</div>
                                <div>${this.escapeHTML(detail.correctAnswerText)}</div>
                            </div>
                        `
														: ""
												}
                        ${
													detail.explanation
														? `
                            <div class="result-explanation">
                                <div class="result-answer-label">Explanation</div>
                                <div>${this.escapeHTML(detail.explanation)}</div>
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
                    background: var(--card-background);
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

	showSuccess(message) {
		this.showNotification(message, "success");
	}

	showProgress(current, total) {
		this.showProgressIndicator(current, total, `Processing questions...`);
	}

	hideProgress() {
		this.hideProgressIndicator();
	}

	// Method to create custom modal
	showModal(title, content, buttons = []) {
		// Remove existing modal if any
		this.hideModal();

		// Add CSS for modal if it doesn't exist yet
		if (!document.getElementById("modal-custom-styles")) {
			const style = document.createElement("style");
			style.id = "modal-custom-styles";
			style.textContent = `
				.modal-backdrop {
					position: fixed;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					background-color: rgba(0, 0, 0, 0.5);
					display: flex;
					align-items: center;
					justify-content: center;
					z-index: 1000;
				}
				.modal-dialog {
					background-color: white;
					border-radius: 8px;
					box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
					width: 90%;
					max-width: 600px;
					display: flex;
					flex-direction: column;
					max-height: 80vh; /* Limit modal height */
				}
				.modal-header {
					display: flex;
					align-items: center;
					justify-content: space-between;
					padding: 1rem;
					border-bottom: 1px solid #e5e7eb;
				}
				.modal-title {
					margin: 0;
					font-size: 1.25rem;
					font-weight: 600;
				}
				.modal-close-btn {
					background: none;
					border: none;
					font-size: 1.5rem;
					cursor: pointer;
					padding: 0.25rem;
					line-height: 1;
				}
				.modal-content {
					padding: 1rem;
					overflow-y: auto; /* Make content scrollable */
					max-height: calc(80vh - 120px); /* Adjust for header and footer */
				}
				.modal-footer {
					display: flex;
					justify-content: flex-end;
					gap: 0.5rem;
					padding: 1rem;
					border-top: 1px solid #e5e7eb;
				}
				.version-block {
					margin-bottom: 1rem;
					padding-bottom: 1rem;
					border-bottom: 1px solid #e5e7eb;
				}
				.version-block:last-child {
					border-bottom: none;
					margin-bottom: 0;
				}
			`;
			document.head.appendChild(style);
		}

		const modalHTML = `
            <div class="modal-backdrop">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3 class="modal-title">${title}</h3>
                        <button class="modal-close-btn">&times;</button>
                    </div>
                    <div class="modal-content">
                        ${content}
                    </div>
                    <div class="modal-footer">
                        <!-- Buttons will be added here -->
                    </div>
                </div>
            </div>
        `;

		this.modalElement = document.createElement("div");
		this.modalElement.innerHTML = modalHTML;
		document.body.appendChild(this.modalElement);
		document.body.style.overflow = "hidden"; // Prevent background scrolling

		const footer = this.modalElement.querySelector(".modal-footer");
		buttons.forEach((btn) => {
			const button = document.createElement("button");
			button.className = `btn ${btn.className || "btn-secondary"}`;
			button.textContent = btn.text;
			// Attach click handler: run provided onClick, then hide modal
			button.addEventListener("click", (event) => {
				if (typeof btn.onClick === "function") {
					btn.onClick(event);
				}
				this.hideModal();
			});
			footer.appendChild(button);
		});

		// Close button event
		this.modalElement
			.querySelector(".modal-close-btn")
			.addEventListener("click", () => this.hideModal());
		this.modalElement
			.querySelector(".modal-backdrop")
			.addEventListener("click", (e) => {
				if (e.target === e.currentTarget) {
					this.hideModal();
				}
			});
	}

	hideModal() {
		if (this.modalElement) {
			this.modalElement.remove();
			this.modalElement = null;
			document.body.style.overflow = "auto";
		}
	}

	showNotification(message, type = "info", duration = 5000) {
		const container =
			document.getElementById("notification-container") ||
			document.createElement("div");
		container.id = "notification-container";
		container.className = "notification-container";
		document.body.appendChild(container);

		const notificationId = `notification-${Date.now()}`;
		const notification = document.createElement("div");
		notification.id = notificationId;
		notification.className = `notification ${type}`;

		notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon"></div>
                <div class="notification-text">${message}</div>
                <button class="notification-close">&times;</button>
            </div>
        `;

		container.appendChild(notification);

		const closeButton = notification.querySelector(".notification-close");
		closeButton.addEventListener("click", () =>
			this.removeNotification(notificationId),
		);

		setTimeout(() => this.removeNotification(notificationId), duration);
	}

	removeNotification(notificationId) {
		const notification = document.getElementById(notificationId);
		if (notification) {
			notification.classList.add("hiding");
			setTimeout(() => notification.remove(), 300);
		}
	}

	clearNotifications() {
		const container = document.getElementById("notification-container");
		if (container) {
			container.innerHTML = "";
		}
	}

	showProgressIndicator(
		completed,
		total,
		message = "Processing questions in background...",
	) {
		const indicator = document.getElementById("processing-indicator");
		if (!indicator) return;

		indicator.style.display = "flex";
		document.getElementById("processing-message").textContent = message;
		this.updateProgressIndicator(completed, total);
	}

	updateProgressIndicator(completed, total, message = null) {
		const fill = document.getElementById("processing-progress-fill");
		const text = document.getElementById("processing-progress-text");
		const msg = document.getElementById("processing-message");

		if (message) {
			msg.textContent = message;
		}

		if (fill && text) {
			const percentage = total > 0 ? (completed / total) * 100 : 0;
			fill.style.width = `${percentage}%`;
			text.textContent = `Batch ${completed} of ${total}`;
		}
	}

	hideProgressIndicator() {
		const indicator = document.getElementById("processing-indicator");
		if (indicator) {
			indicator.style.display = "none";
		}
	}

	showEnhancedError(message, details = null) {
		let detailHTML = "";
		if (details) {
			detailHTML = `<pre style="background: #eee; padding: 10px; border-radius: 4px; margin-top: 10px; white-space: pre-wrap; word-break: break-all;">${JSON.stringify(
				details,
				null,
				2,
			)}</pre>`;
		}

		this.showModal("An Error Occurred", `<p>${message}</p>${detailHTML}`, [
			{ text: "Close", onClick: () => this.hideModal() },
		]);
	}

	showBatchStatus(currentBatch, totalBatches, questionsReady) {
		this.showProgressIndicator(
			currentBatch,
			totalBatches,
			`${questionsReady} questions ready...`,
		);
	}

	// ───────────────────────────────── Sync Modal ─────────────────────────────────
	createSyncModal() {
		// Use the same structure as the generic modal for consistent styling
		const modalContent = `
			<div class="sync-tabs" style="display:flex; gap:0.5rem; margin-bottom:1rem; border-bottom: 1px solid #e5e7eb;">
				<button class="tab-btn active" data-tab="share" style="padding: 0.5rem 1rem; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent;">Share</button>
				<button class="tab-btn" data-tab="receive" style="padding: 0.5rem 1rem; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent;">Receive</button>
			</div>

			<!-- Share Tab -->
			<div class="tab-content" id="share-tab">
				<p>Share this exam by having another device scan the QR code below.</p>
				<div id="qrcode-container" style="display:flex; justify-content:center; margin: 1.5rem 0;"></div>
				<p style="text-align:center; font-size:0.9rem; color:#6b7280;">Or copy the code:</p>
				<div class="connection-code" style="display:flex; gap:0.5rem; align-items:center;">
					<input type="text" id="connection-code" readonly style="flex:1; min-width:0; background-color: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px; padding: 0.5rem;">
					<button id="copy-code-btn" class="btn btn-secondary btn-sm">Copy</button>
				</div>
			</div>

			<!-- Receive Tab -->
			<div class="tab-content" id="receive-tab" style="display:none">
				<p>Paste the connection code from the other device below to connect.</p>
				<div class="connection-input" style="display:flex; flex-direction:column; gap:0.5rem; margin-top: 1.5rem;">
					<input type="text" id="peer-connection-input" placeholder="Paste connection code here" style="flex:1; min-width:0; border: 1px solid #d1d5db; border-radius: 4px; padding: 0.5rem;">
					<button id="connect-btn" class="btn btn-primary" style="align-self: flex-end;">Connect</button>
				</div>
			</div>

			<div id="sync-status" style="margin-top: 1rem; font-size: 0.9rem; color: #6b7280; text-align: center; min-height: 20px;"></div>
		`;
		return modalContent;
	}

	showSyncModal(pdfId, p2pSyncManager) {
		const isReceiveOnly = pdfId === null;
		const modalContent = this.createSyncModal();
		this.showModal(isReceiveOnly ? "Receive Exam" : "Sync Exam", modalContent, [
			{
				text: "Close",
				className: "btn-secondary",
				onClick: () => this.hideModal(),
			},
		]);

		// The generic showModal call creates this.modalElement
		const modal = this.modalElement;

		// Tab switching logic
		const shareTabBtn = modal.querySelector('.tab-btn[data-tab="share"]');
		const receiveTabBtn = modal.querySelector('.tab-btn[data-tab="receive"]');
		const shareTab = modal.querySelector("#share-tab");
		const receiveTab = modal.querySelector("#receive-tab");
		const activeStyle = "border-bottom: 2px solid #4f46e5; font-weight: 600;";

		if (isReceiveOnly) {
			// Default to Receive tab and hide the Share tab
			shareTab.style.display = "none";
			shareTabBtn.style.display = "none";
			receiveTab.style.display = "block";
			receiveTabBtn.style.cssText += activeStyle;
		} else {
			// Default to Share tab
			shareTabBtn.style.cssText += activeStyle;
		}

		shareTabBtn.addEventListener("click", () => {
			shareTabBtn.style.cssText += activeStyle;
			receiveTabBtn.style.cssText = receiveTabBtn.style.cssText.replace(
				activeStyle,
				"",
			);
			shareTab.style.display = "none";
			receiveTab.style.display = "block";
		});
		receiveTabBtn.addEventListener("click", () => {
			receiveTabBtn.style.cssText += activeStyle;
			shareTabBtn.style.cssText = shareTabBtn.style.cssText.replace(
				activeStyle,
				"",
			);
			shareTab.style.display = "block";
			receiveTab.style.display = "none";
		});

		const statusEl = modal.querySelector("#sync-status");

		// --- Share logic (only if a pdfId is provided) ---
		if (!isReceiveOnly) {
			(async () => {
				try {
					statusEl.textContent = "Creating share session…";
					const { roomUrl } = await p2pSyncManager.createShareSession(pdfId);
					const connectionInfo = { pdfId, roomUrl };
					const connectionString = JSON.stringify(connectionInfo);

					const qrContainer = modal.querySelector("#qrcode-container");
					const canvas = document.createElement("canvas");
					qrContainer.appendChild(canvas);
					// eslint-disable-next-line no-undef
					QRCode.toCanvas(canvas, connectionString, { width: 220, margin: 1 });

					modal.querySelector("#connection-code").value =
						btoa(connectionString);
					statusEl.textContent = "Ready to connect.";
				} catch (err) {
					console.error("Failed to create share session", err);
					statusEl.textContent = "Error: " + err.message;
					this.showError("Failed to create share session: " + err.message);
				}
			})();

			// Copy code
			modal.querySelector("#copy-code-btn").addEventListener("click", () => {
				const input = modal.querySelector("#connection-code");
				input.select();
				document.execCommand("copy");
				statusEl.textContent = "Copied to clipboard!";
			});
		}

		// --- Receive logic ---
		modal.querySelector("#connect-btn").addEventListener("click", async () => {
			try {
				const raw = modal.querySelector("#peer-connection-input").value.trim();
				if (!raw) {
					statusEl.textContent = "Please paste a connection code.";
					return;
				}
				let decoded;
				try {
					decoded = atob(raw);
				} catch (_) {
					decoded = raw; // maybe plain JSON
				}
				const info = JSON.parse(decoded);
				statusEl.textContent = "Connecting…";
				await p2pSyncManager.joinShareSession(info);
				statusEl.textContent = "Connected! Receiving data...";
				// The dataReceived event in main.js will handle the rest.
				// We can close the modal after a short delay.
				setTimeout(() => this.hideModal(), 2000);
			} catch (err) {
				console.error("Failed to join session", err);
				statusEl.textContent = "Connection error: " + err.message;
				this.showError("Could not connect: " + err.message);
			}
		});
	}
}

export { UIComponents };
