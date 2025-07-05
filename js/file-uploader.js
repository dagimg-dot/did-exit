// File upload and drag-drop functionality
class FileUploader {
	constructor() {
		this.events = {};
		this.setupElements();
		this.setupEventListeners();
	}

	setupElements() {
		this.uploadArea = document.getElementById("upload-area");
		this.pdfInput = document.getElementById("pdf-input");
		this.browseBtn = document.getElementById("browse-btn");
		this.fileInfo = document.getElementById("file-info");
		this.fileName = document.getElementById("file-name");
		this.processBtn = document.getElementById("process-btn");
		this.changeFileBtn = document.getElementById("change-file-btn");
		this.selectedFile = null;
	}

	setupEventListeners() {
		// Browse button click
		this.browseBtn.addEventListener("click", () => {
			this.pdfInput.click();
		});

		// File input change
		this.pdfInput.addEventListener("change", (e) => {
			if (e.target.files.length > 0) {
				this.handleFileSelection(e.target.files[0]);
			}
		});

		// Drag and drop events
		this.uploadArea.addEventListener("click", () => {
			this.pdfInput.click();
		});

		this.uploadArea.addEventListener("dragover", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.uploadArea.classList.add("dragover");
		});

		this.uploadArea.addEventListener("dragleave", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.uploadArea.classList.remove("dragover");
		});

		this.uploadArea.addEventListener("drop", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.uploadArea.classList.remove("dragover");

			const files = e.dataTransfer.files;
			if (files.length > 0) {
				const file = files[0];
				if (file.type === "application/pdf") {
					this.handleFileSelection(file);
				} else {
					this.showError("Please select a PDF file.");
				}
			}
		});

		// Process button click
		this.processBtn.addEventListener("click", () => {
			if (this.selectedFile) {
				this.emit("fileSelected", this.selectedFile);
			}
		});

		// Change file button click
		this.changeFileBtn.addEventListener("click", () => {
			this.showUploadArea();
		});
	}

	handleFileSelection(file) {
		if (!this.validateFile(file)) {
			return;
		}

		this.selectedFile = file;
		this.fileName.textContent = file.name;
		this.hideUploadArea();
		this.fileInfo.style.display = "block";

		console.log("File selected:", {
			name: file.name,
			size: this.formatFileSize(file.size),
			type: file.type,
		});
	}

	hideUploadArea() {
		if (this.uploadArea) {
			this.uploadArea.style.display = "none";
		}
	}

	showUploadArea() {
		if (this.uploadArea) {
			this.uploadArea.style.display = "block";
		}
		this.fileInfo.style.display = "none";
		this.selectedFile = null;
		this.pdfInput.value = "";
		// Clear any error messages
		const errorElement = document.getElementById("upload-error");
		if (errorElement) {
			errorElement.style.display = "none";
		}
	}

	validateFile(file) {
		// Check file type
		if (file.type !== "application/pdf") {
			this.showError("Please select a PDF file.");
			return false;
		}

		// Check file size (max 10MB)
		const maxSize = 10 * 1024 * 1024; // 10MB
		if (file.size > maxSize) {
			this.showError("File size must be less than 10MB.");
			return false;
		}

		return true;
	}

	formatFileSize(bytes) {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
	}

	showError(message) {
		// Create or update error message element
		let errorElement = document.getElementById("upload-error");
		if (!errorElement) {
			errorElement = document.createElement("div");
			errorElement.id = "upload-error";
			errorElement.className = "error-message";
			errorElement.style.cssText = `
                background: #fef2f2;
                color: #dc2626;
                padding: 1rem;
                border-radius: 8px;
                margin-top: 1rem;
                border: 1px solid #fecaca;
            `;
			this.uploadArea.parentNode.appendChild(errorElement);
		}

		errorElement.textContent = message;
		errorElement.style.display = "block";

		// Hide error after 5 seconds
		setTimeout(() => {
			errorElement.style.display = "none";
		}, 5000);
	}

	reset() {
		this.selectedFile = null;
		this.pdfInput.value = "";
		this.fileInfo.style.display = "none";
		this.fileName.textContent = "";
		this.showUploadArea();

		// Hide any error messages
		const errorElement = document.getElementById("upload-error");
		if (errorElement) {
			errorElement.style.display = "none";
		}
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

export { FileUploader };
