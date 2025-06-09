// IndexedDB Database Manager for PDF Quiz Application
class DatabaseManager {
	constructor() {
		this.dbName = "QuizDB";
		this.dbVersion = 1;
		this.db = null;
		this.events = {};
	}

	async initialize() {
		try {
			this.db = await this.openDatabase();
			console.log("✅ Database initialized successfully");
			return true;
		} catch (error) {
			console.error("❌ Database initialization failed:", error);
			throw error;
		}
	}

	async openDatabase() {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, this.dbVersion);

			request.onerror = () => {
				reject(new Error(`Failed to open database: ${request.error}`));
			};

			request.onsuccess = () => {
				resolve(request.result);
			};

			request.onupgradeneeded = (event) => {
				const db = event.target.result;
				this.createStores(db);
			};
		});
	}

	createStores(db) {
		// Store PDF metadata and processing status
		if (!db.objectStoreNames.contains("pdfs")) {
			const pdfStore = db.createObjectStore("pdfs", { keyPath: "id" });
			pdfStore.createIndex("filename", "filename", { unique: false });
			pdfStore.createIndex("uploadDate", "uploadDate", { unique: false });
			pdfStore.createIndex("lastAccessed", "lastAccessed", { unique: false });
			console.log("📄 Created PDFs object store");
		}

		// Store individual questions
		if (!db.objectStoreNames.contains("questions")) {
			const questionStore = db.createObjectStore("questions", {
				keyPath: ["pdfId", "questionId"],
			});
			questionStore.createIndex("pdfId", "pdfId", { unique: false });
			questionStore.createIndex("batchNumber", "batchNumber", {
				unique: false,
			});
			questionStore.createIndex("createdDate", "createdDate", {
				unique: false,
			});
			console.log("❓ Created Questions object store");
		}

		// Store user quiz sessions and progress
		if (!db.objectStoreNames.contains("sessions")) {
			const sessionStore = db.createObjectStore("sessions", { keyPath: "id" });
			sessionStore.createIndex("pdfId", "pdfId", { unique: false });
			sessionStore.createIndex("startDate", "startDate", { unique: false });
			console.log("📊 Created Sessions object store");
		}
	}

	// PDF Management Methods
	async storePDF(pdfData) {
		const transaction = this.db.transaction(["pdfs"], "readwrite");
		const store = transaction.objectStore("pdfs");

		const pdfRecord = {
			id: pdfData.id,
			filename: pdfData.filename,
			fileSize: pdfData.fileSize,
			uploadDate: new Date(),
			lastAccessed: new Date(),
			textContent: pdfData.textContent,
			totalQuestions: pdfData.totalQuestions || 0,
			isComplete: pdfData.isComplete || false,
			processingStatus: pdfData.processingStatus || "pending",
			batchCount: pdfData.batchCount || 1,
			completedBatches: pdfData.completedBatches || 0,
		};

		return new Promise((resolve, reject) => {
			const request = store.put(pdfRecord);
			request.onsuccess = () => {
				console.log(`📄 PDF stored: ${pdfRecord.filename}`);
				resolve(pdfRecord);
			};
			request.onerror = () => reject(request.error);
		});
	}

	async getPDF(pdfId) {
		const transaction = this.db.transaction(["pdfs"], "readonly");
		const store = transaction.objectStore("pdfs");

		return new Promise((resolve, reject) => {
			const request = store.get(pdfId);
			request.onsuccess = () => {
				if (request.result) {
					// Update last accessed time
					this.updatePDFLastAccessed(pdfId);
				}
				resolve(request.result);
			};
			request.onerror = () => reject(request.error);
		});
	}

	async updatePDFLastAccessed(pdfId) {
		const transaction = this.db.transaction(["pdfs"], "readwrite");
		const store = transaction.objectStore("pdfs");

		return new Promise((resolve, reject) => {
			const getRequest = store.get(pdfId);
			getRequest.onsuccess = () => {
				if (getRequest.result) {
					const pdf = getRequest.result;
					pdf.lastAccessed = new Date();

					const updateRequest = store.put(pdf);
					updateRequest.onsuccess = () => resolve(pdf);
					updateRequest.onerror = () => reject(updateRequest.error);
				} else {
					resolve(null);
				}
			};
			getRequest.onerror = () => reject(getRequest.error);
		});
	}

	async updatePDFProgress(pdfId, completedBatch) {
		const transaction = this.db.transaction(["pdfs"], "readwrite");
		const store = transaction.objectStore("pdfs");

		return new Promise((resolve, reject) => {
			const getRequest = store.get(pdfId);
			getRequest.onsuccess = () => {
				if (getRequest.result) {
					const pdf = getRequest.result;
					pdf.completedBatches = Math.max(pdf.completedBatches, completedBatch);
					pdf.lastAccessed = new Date();

					const updateRequest = store.put(pdf);
					updateRequest.onsuccess = () => {
						console.log(
							`📊 PDF progress updated: ${pdf.filename} (${pdf.completedBatches}/${pdf.batchCount})`,
						);
						resolve(pdf);
					};
					updateRequest.onerror = () => reject(updateRequest.error);
				} else {
					reject(new Error("PDF not found"));
				}
			};
			getRequest.onerror = () => reject(getRequest.error);
		});
	}

	async completePDFProcessing(pdfId) {
		const transaction = this.db.transaction(["pdfs"], "readwrite");
		const store = transaction.objectStore("pdfs");

		return new Promise((resolve, reject) => {
			const getRequest = store.get(pdfId);
			getRequest.onsuccess = () => {
				if (getRequest.result) {
					const pdf = getRequest.result;
					pdf.isComplete = true;
					pdf.processingStatus = "complete";
					pdf.lastAccessed = new Date();

					const updateRequest = store.put(pdf);
					updateRequest.onsuccess = () => {
						console.log(`✅ PDF processing completed: ${pdf.filename}`);
						resolve(pdf);
					};
					updateRequest.onerror = () => reject(updateRequest.error);
				} else {
					reject(new Error("PDF not found"));
				}
			};
			getRequest.onerror = () => reject(getRequest.error);
		});
	}

	// Question Management Methods
	async storeQuestions(pdfId, questions, batchNumber) {
		const transaction = this.db.transaction(["questions"], "readwrite");
		const store = transaction.objectStore("questions");

		const promises = questions.map((question, index) => {
			const questionRecord = {
				pdfId: pdfId,
				questionId: question.id || (batchNumber - 1) * 20 + index + 1,
				batchNumber: batchNumber,
				question: question.question,
				options: question.options,
				correctAnswer: question.correctAnswer,
				explanation: question.explanation,
				createdDate: new Date(),
				source: question.source || "ai",
			};

			return new Promise((resolve, reject) => {
				const request = store.put(questionRecord);
				request.onsuccess = () => resolve(questionRecord);
				request.onerror = () => reject(request.error);
			});
		});

		const results = await Promise.all(promises);
		console.log(
			`❓ Stored ${results.length} questions for batch ${batchNumber}`,
		);
		return results;
	}

	async getQuestions(pdfId, batchNumber = null) {
		const transaction = this.db.transaction(["questions"], "readonly");
		const store = transaction.objectStore("questions");
		const index = store.index("pdfId");

		return new Promise((resolve, reject) => {
			const request = index.getAll(pdfId);
			request.onsuccess = () => {
				let questions = request.result;

				// Filter by batch number if specified
				if (batchNumber !== null) {
					questions = questions.filter((q) => q.batchNumber === batchNumber);
				}

				// Sort by question ID
				questions.sort((a, b) => a.questionId - b.questionId);
				resolve(questions);
			};
			request.onerror = () => reject(request.error);
		});
	}

	async getQuestionCount(pdfId) {
		const transaction = this.db.transaction(["questions"], "readonly");
		const store = transaction.objectStore("questions");
		const index = store.index("pdfId");

		return new Promise((resolve, reject) => {
			const request = index.count(pdfId);
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	// Session Management Methods
	async storeSession(sessionData) {
		const transaction = this.db.transaction(["sessions"], "readwrite");
		const store = transaction.objectStore("sessions");

		const sessionRecord = {
			id: sessionData.id || this.generateUUID(),
			pdfId: sessionData.pdfId,
			startDate: sessionData.startDate || new Date(),
			endDate: sessionData.endDate || null,
			currentQuestion: sessionData.currentQuestion || 0,
			answers: sessionData.answers || [],
			isComplete: sessionData.isComplete || false,
			score: sessionData.score || null,
			timeSpent: sessionData.timeSpent || 0,
		};

		return new Promise((resolve, reject) => {
			const request = store.put(sessionRecord);
			request.onsuccess = () => {
				console.log(`📊 Session stored: ${sessionRecord.id}`);
				resolve(sessionRecord);
			};
			request.onerror = () => reject(request.error);
		});
	}

	async getSession(sessionId) {
		const transaction = this.db.transaction(["sessions"], "readonly");
		const store = transaction.objectStore("sessions");

		return new Promise((resolve, reject) => {
			const request = store.get(sessionId);
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	async getSessionsForPDF(pdfId) {
		const transaction = this.db.transaction(["sessions"], "readonly");
		const store = transaction.objectStore("sessions");
		const index = store.index("pdfId");

		return new Promise((resolve, reject) => {
			const request = index.getAll(pdfId);
			request.onsuccess = () => {
				const sessions = request.result.sort(
					(a, b) => b.startDate - a.startDate,
				);
				resolve(sessions);
			};
			request.onerror = () => reject(request.error);
		});
	}

	// Utility Methods
	async generatePDFHash(fileContent) {
		const encoder = new TextEncoder();
		const data = encoder.encode(fileContent);
		const hashBuffer = await crypto.subtle.digest("SHA-256", data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	}

	generateUUID() {
		return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
			/[xy]/g,
			function (c) {
				const r = (Math.random() * 16) | 0;
				const v = c == "x" ? r : (r & 0x3) | 0x8;
				return v.toString(16);
			},
		);
	}

	// Cache Management
	async cleanupOldPDFs() {
		const maxPDFs = 50;
		const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
		const cutoffDate = new Date(Date.now() - maxAge);

		const transaction = this.db.transaction(["pdfs"], "readwrite");
		const store = transaction.objectStore("pdfs");
		const index = store.index("lastAccessed");

		return new Promise((resolve, reject) => {
			const request = index.openCursor(IDBKeyRange.upperBound(cutoffDate));
			const toDelete = [];

			request.onsuccess = (event) => {
				const cursor = event.target.result;
				if (cursor) {
					toDelete.push(cursor.value.id);
					cursor.continue();
				} else {
					// Delete old PDFs and their questions
					Promise.all(toDelete.map((id) => this.deletePDFAndQuestions(id)))
						.then(() => {
							console.log(`🧹 Cleaned up ${toDelete.length} old PDFs`);
							resolve(toDelete.length);
						})
						.catch(reject);
				}
			};
			request.onerror = () => reject(request.error);
		});
	}

	async deletePDFAndQuestions(pdfId) {
		const transaction = this.db.transaction(
			["pdfs", "questions", "sessions"],
			"readwrite",
		);

		// Delete PDF
		const pdfStore = transaction.objectStore("pdfs");
		pdfStore.delete(pdfId);

		// Delete questions
		const questionStore = transaction.objectStore("questions");
		const questionIndex = questionStore.index("pdfId");
		const questionRequest = questionIndex.openCursor(IDBKeyRange.only(pdfId));

		questionRequest.onsuccess = (event) => {
			const cursor = event.target.result;
			if (cursor) {
				cursor.delete();
				cursor.continue();
			}
		};

		// Delete sessions
		const sessionStore = transaction.objectStore("sessions");
		const sessionIndex = sessionStore.index("pdfId");
		const sessionRequest = sessionIndex.openCursor(IDBKeyRange.only(pdfId));

		sessionRequest.onsuccess = (event) => {
			const cursor = event.target.result;
			if (cursor) {
				cursor.delete();
				cursor.continue();
			}
		};

		return new Promise((resolve, reject) => {
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
		});
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

export { DatabaseManager };
