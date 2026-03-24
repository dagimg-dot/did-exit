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
			if (errorElement?.parentNode) {
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

	addResultsSummary(_results) {
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
					background-color: rgba(0, 0, 0, 0.65);
					display: flex;
					align-items: center;
					justify-content: center;
					z-index: 1000;
				}
				.modal-dialog {
					background-color: var(--card-background);
					color: var(--text-primary);
					border-radius: var(--border-radius);
					border: 1px solid var(--border-color);
					box-shadow: var(--shadow-lg);
					overflow: hidden;
					width: 90%;
					max-width: 600px;
					display: flex;
					flex-direction: column;
					max-height: 80vh;
				}
				.modal-header {
					display: flex;
					align-items: center;
					justify-content: space-between;
					padding: 1rem 1.25rem;
					border-bottom: 1px solid var(--border-color);
					background: var(--card-background);
					flex-shrink: 0;
				}
				.modal-title {
					margin: 0;
					font-size: 1.15rem;
					font-weight: 600;
				}
				.modal-close-btn {
					background: none;
					border: none;
					font-size: 1.5rem;
					cursor: pointer;
					padding: 0.25rem;
					line-height: 1;
					color: var(--text-secondary);
				}
				.modal-close-btn:hover {
					color: var(--text-primary);
				}
				.modal-content {
					padding: 1.25rem;
					overflow-y: auto;
					max-height: calc(80vh - 120px);
				}
				.modal-footer {
					display: flex;
					justify-content: flex-end;
					gap: 0.5rem;
					padding: 1rem 1.25rem;
					border-top: 1px solid var(--border-color);
					background: var(--color-surface-2);
					flex-shrink: 0;
				}
				.version-block {
					margin-bottom: 1rem;
					padding-bottom: 1rem;
					border-bottom: 1px solid var(--border-color);
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
			const placeholder = document.getElementById(
				"api-key-modal-placeholder",
			);
			const apiSection = document.getElementById("api-key-section");
			if (
				placeholder &&
				apiSection &&
				this.modalElement.contains(apiSection)
			) {
				placeholder.appendChild(apiSection);
			}
			this.modalElement.remove();
			this.modalElement = null;
			document.body.style.overflow = "auto";
		}
	}

	/** Mounts the shared #api-key-section into the modal (reparented on hideModal). */
	showApiKeyModal() {
		this.showModal("Google AI setup", "", [
			{
				text: "Close",
				className: "btn-secondary",
				onClick: () => {},
			},
		]);
		const content = this.modalElement?.querySelector(".modal-content");
		const section = document.getElementById("api-key-section");
		if (content && section) {
			content.appendChild(section);
		}
		if (typeof lucide !== "undefined") {
			lucide.createIcons();
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
				<p class="notification-text"></p>
				<button type="button" class="notification-close" aria-label="Dismiss">&times;</button>
			</div>
		`;
		const textEl = notification.querySelector(".notification-text");
		if (textEl) {
			textEl.textContent = message;
		}

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
		const modalContent = `
			<div class="sync-tabs">
				<button type="button" class="sync-tab-btn" data-tab="share">Share</button>
				<button type="button" class="sync-tab-btn" data-tab="receive">Receive</button>
			</div>

			<div class="sync-pane" id="share-tab">
				<p class="sync-pane__lead">Share this exam by having another device scan the QR code below.</p>
				<div id="qrcode-container" class="sync-qr-wrap"></div>
				<p class="sync-hint">Or copy the code:</p>
				<div class="sync-row connection-code">
					<input type="text" id="connection-code" readonly class="sync-modal-input" >
					<button type="button" id="copy-code-btn" class="btn btn-secondary btn-sm">Copy</button>
				</div>
			</div>

			<div class="sync-pane" id="receive-tab" style="display:none">
				<div id="qr-reader" class="sync-qr-reader"></div>
				<p class="sync-pane__lead">Paste the connection code from the other device below, or scan the QR code.</p>
				<div class="sync-stack connection-input">
					<div class="sync-row sync-row--input">
						<input type="text" id="peer-connection-input" placeholder="Paste connection code" class="sync-modal-input" >
						<button type="button" id="connect-btn" class="btn btn-primary sync-modal-primary">Connect</button>
					</div>
					<button type="button" id="scan-qr-btn" class="btn btn-secondary sync-scan-wide">Scan QR Code</button>
				</div>
			</div>

			<div id="sync-status" class="sync-status" aria-live="polite"></div>
		`;
		return modalContent;
	}

	showSyncModal(pdfId, p2pSyncManager) {
		const isReceiveOnly = pdfId === null;
		const modalContent = this.createSyncModal();
		this.showModal(
			isReceiveOnly ? "Receive Exam" : "Sync Exam",
			modalContent,
			[
				{
					text: "Close",
					className: "btn-secondary",
					onClick: () => this.hideModal(),
				},
			],
		);

		// The generic showModal call creates this.modalElement
		const modal = this.modalElement;

		// Tab switching logic
		const shareTabBtn = modal.querySelector(
			'.sync-tab-btn[data-tab="share"]',
		);
		const receiveTabBtn = modal.querySelector(
			'.sync-tab-btn[data-tab="receive"]',
		);
		const syncTabsEl = modal.querySelector(".sync-tabs");
		const shareTab = modal.querySelector("#share-tab");
		const receiveTab = modal.querySelector("#receive-tab");

		if (isReceiveOnly) {
			shareTab.style.display = "none";
			shareTabBtn.style.display = "none";
			receiveTab.style.display = "block";
			receiveTabBtn.classList.add("active");
			if (syncTabsEl) {
				syncTabsEl.style.display = "none";
			}
		} else {
			// Default to Share tab
			shareTabBtn.classList.add("active");
		}

		shareTabBtn.addEventListener("click", () => {
			shareTabBtn.classList.add("active");
			receiveTabBtn.classList.remove("active");
			shareTab.style.display = "block";
			receiveTab.style.display = "none";
		});
		receiveTabBtn.addEventListener("click", () => {
			receiveTabBtn.classList.add("active");
			shareTabBtn.classList.remove("active");
			shareTab.style.display = "none";
			receiveTab.style.display = "block";
		});

		const statusEl = modal.querySelector("#sync-status");

		// --- Share logic (only if a pdfId is provided) ---
		if (!isReceiveOnly) {
			const qrContainer = modal.querySelector("#qrcode-container");
			const connectionCodeInput = modal.querySelector("#connection-code");

			// Set initial loading state
			qrContainer.innerHTML = `<div class="sync-spinner"></div>`;
			connectionCodeInput.value = "Generating...";
			statusEl.textContent = "Creating secure session...";

			(async () => {
				try {
					const { roomId } =
						await p2pSyncManager.createShareSession(pdfId);

					// Clear loading state and show the data
					qrContainer.innerHTML = "";
					const canvas = document.createElement("canvas");
					qrContainer.appendChild(canvas);

					const connectionInfo = { roomId };
					const connectionString = JSON.stringify(connectionInfo);
					// eslint-disable-next-line no-undef
					QRCode.toCanvas(canvas, connectionString, {
						width: 220,
						margin: 1,
					});

					connectionCodeInput.value = roomId;
					statusEl.textContent = "Ready to connect.";
				} catch (err) {
					console.error("Failed to create share session", err);
					qrContainer.innerHTML = `<p class="sync-error">Failed to create session.</p>`;
					statusEl.textContent = `Error: ${err.message}`;
					this.showError(
						`Failed to create share session: ${err.message}`,
					);
				}
			})();

			// Copy code
			modal
				.querySelector("#copy-code-btn")
				.addEventListener("click", () => {
					const input = modal.querySelector("#connection-code");
					input.select();
					document.execCommand("copy");
					statusEl.textContent = "Copied to clipboard!";
				});
		}

		// --- QR Code Scanner Logic ---
		const qrReaderElement = modal.querySelector("#qr-reader");
		const scanButton = modal.querySelector("#scan-qr-btn");
		const peerInput = modal.querySelector("#peer-connection-input");
		const connectButton = modal.querySelector("#connect-btn");

		let html5QrCode = null;

		scanButton.addEventListener("click", () => {
			if (!html5QrCode || !html5QrCode.isScanning) {
				html5QrCode = new Html5Qrcode("qr-reader");
				scanButton.textContent = "Stop Scanning";
				statusEl.textContent = "Starting camera...";
				qrReaderElement.style.display = "block";

				const qrCodeSuccessCallback = (decodedText, _decodedResult) => {
					try {
						const info = JSON.parse(decodedText);
						if (info.roomId) {
							peerInput.value = info.roomId;
							statusEl.textContent = `Scanned successfully! Connecting...`;
							html5QrCode.stop().then(() => {
								scanButton.textContent = "Scan QR Code";
								qrReaderElement.style.display = "none";
								connectButton.click();
							});
						} else {
							throw new Error("Invalid QR code.");
						}
					} catch (e) {
						statusEl.textContent = "Error: Invalid QR code format.";
						console.error(e);
					}
				};

				const config = { fps: 10, qrbox: { width: 250, height: 250 } };
				html5QrCode
					.start(
						{ facingMode: "environment" },
						config,
						qrCodeSuccessCallback,
					)
					.then(() => {
						statusEl.textContent = "Point camera at the QR code.";
					})
					.catch((err) => {
						statusEl.textContent = `Camera Error: ${err}`;
						scanButton.textContent = "Scan QR Code";
					});
			} else {
				html5QrCode
					.stop()
					.then(() => {
						scanButton.textContent = "Scan QR Code";
						statusEl.textContent = "Scanner stopped.";
						qrReaderElement.style.display = "none";
					})
					.catch((err) =>
						console.error("Failed to stop scanner:", err),
					);
			}
		});

		// --- Receive logic ---
		connectButton.addEventListener("click", async () => {
			let _decoded;
			try {
				const roomId = modal
					.querySelector("#peer-connection-input")
					.value.trim();
				if (!roomId) {
					statusEl.textContent = "Please paste a connection code.";
					return;
				}
				statusEl.textContent = "Connecting…";
				await p2pSyncManager.joinShareSession(roomId);
				statusEl.textContent = "Connected! Receiving data...";
				// The dataReceived event in main.js will handle the rest.
				// We can close the modal after a short delay.
				setTimeout(() => this.hideModal(), 2000);
			} catch (err) {
				console.error("Failed to join session", err);
				statusEl.textContent = `Connection error: ${err.message}`;
				this.showError(`Could not connect: ${err.message}`);
			}
		});
	}
}

export { UIComponents };
