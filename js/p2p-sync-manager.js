/*
 P2P Sync Manager – WebRTC, Simple-Peer, Netlify Function signalling
 -------------------------------------------------------------------
 This class is responsible for transferring *only* PDF metadata and questions
 between two browsers (desktop-to-mobile or vice-versa).
 The heavy `textContent` payload from the original PDF is *never* sent.

 Dependencies (loaded globally via CDN):
   • simple-peer@9 – makes WebRTC easier
   • qrcode – UI helper (not referenced here directly)

 Signalling is handled through a tiny Netlify Function at
   /.netlify/functions/webrtc-room/:id
 which stores a single offer/answer JSON object in memory.
*/

export class P2PSyncManager {
	constructor(databaseManager) {
		this.databaseManager = databaseManager;
		this.peers = new Map();
		this.connectionId = this.#generateId();
		this.events = {};
		this.logPrefix = "[P2P]";
	}

	/* ───────────────────── Event Emitter helpers ───────────────────── */
	on(event, callback) {
		if (!this.events[event]) this.events[event] = [];
		this.events[event].push(callback);
	}

	emit(event, data) {
		(this.events[event] || []).forEach((cb) => {
			try {
				cb(data);
			} catch (err) {
				console.error(`Error in P2PSyncManager listener for ${event}:`, err);
			}
		});
	}

	/* ───────────────────── Public API ───────────────────── */

	// Called by the device that wants to *share* questions
	async createShareSession(pdfId) {
		console.log(`${this.logPrefix} Creating share session for PDF:`, pdfId);
		const roomId = crypto.randomUUID();
		const roomUrl = `${window.location.origin}/.netlify/functions/webrtc-room/${roomId}`;

		const peer = this.#createPeer(true);
		this.peers.set(roomId, peer);

		// Publish offer to signalling room once emitted
		peer.on("signal", async (offer) => {
			if (!peer.__offerPublished) {
				console.log(
					`${this.logPrefix} Got initiator signal (offer). Publishing to room...`,
				);
				await this.#publishOffer(roomUrl, offer);
				peer.__offerPublished = true;
			}
		});

		// Poll for answer in background
		console.log(`${this.logPrefix} Polling for answer from peer...`);
		this.#pollAnswer(roomUrl)
			.then((answer) => {
				console.log(`${this.logPrefix} Received answer. Connecting to peer...`);
				peer.signal(answer);
			})
			.catch((err) => {
				console.error(`${this.logPrefix} Polling failed:`, err);
				this.emit("error", err);
			});

		// Once WebRTC channel is open, send the data
		peer.on("connect", async () => {
			console.log(
				`${this.logPrefix} Peer connection established. Preparing data for sync...`,
			);
			try {
				const prepared = await this.#prepareDataForSync(pdfId);
				console.log(
					`${this.logPrefix} Sending metadata for ${prepared.totalQuestions} questions...`,
				);
				// Send metadata first
				peer.send(
					JSON.stringify({
						type: "metadata",
						data: prepared.metadata,
						totalQuestions: prepared.totalQuestions,
					}),
				);

				// Then send each chunk sequentially to keep memory low
				console.log(
					`${this.logPrefix} Sending ${prepared.questionChunks.length} question chunks...`,
				);
				for (let i = 0; i < prepared.questionChunks.length; i++) {
					const chunk = prepared.questionChunks[i];
					peer.send(
						JSON.stringify({
							type: "questions",
							chunkIndex: i,
							totalChunks: prepared.questionChunks.length,
							data: chunk,
						}),
					);
				}

				// Indicate completion
				console.log(`${this.logPrefix} Sending completion signal.`);
				peer.send(JSON.stringify({ type: "complete" }));
			} catch (err) {
				console.error(`${this.logPrefix} Error during data sync:`, err);
				this.emit("error", err);
			}
		});

		peer.on("error", (err) => {
			console.error(`${this.logPrefix} Peer error:`, err);
			this.emit("error", err);
		});
		peer.on("close", () => {
			console.log(`${this.logPrefix} Peer connection closed for room:`, roomId);
			this.peers.delete(roomId);
		});

		return { pdfId, roomUrl };
	}

	// Called by the device that wants to *receive* questions
	async joinShareSession(connectionInfo) {
		console.log(`${this.logPrefix} Joining share session:`, connectionInfo);
		const { roomUrl, pdfId } = connectionInfo;
		const peer = this.#createPeer(false);

		// Fetch offer and feed into peer
		console.log(`${this.logPrefix} Fetching offer from room:`, roomUrl);
		const res = await fetch(roomUrl);
		const { offer } = await res.json();
		if (!offer) throw new Error("No offer present in room");
		peer.signal(offer);

		// When we produce our answer, PUT it back
		peer.on("signal", async (answer) => {
			console.log(
				`${this.logPrefix} Got receiver signal (answer). Publishing to room...`,
			);
			await this.#publishAnswer(roomUrl, answer);
		});

		// Incoming data buffering
		let incomingMetadata = null;
		let questionAccumulator = [];

		peer.on("data", async (raw) => {
			try {
				const msg = JSON.parse(raw.toString());
				console.log(`${this.logPrefix} Received data chunk:`, msg.type);
				if (msg.type === "metadata") {
					incomingMetadata = msg.data;
				} else if (msg.type === "questions") {
					questionAccumulator.push(...msg.data);
				} else if (msg.type === "complete") {
					console.log(`${this.logPrefix} Sync complete. Importing data...`);
					if (!incomingMetadata)
						throw new Error("Sync completed without metadata – aborting");

					await this.databaseManager.importSyncedData(
						incomingMetadata,
						questionAccumulator,
					);
					this.emit("dataReceived", {
						metadata: incomingMetadata,
						questions: questionAccumulator,
					});
					peer.destroy();
				}
			} catch (err) {
				console.error(
					`${this.logPrefix} Failed to process incoming sync data`,
					err,
				);
			}
		});

		peer.on("error", (err) => {
			console.error(`${this.logPrefix} Peer error on receiver:`, err);
			this.emit("error", err);
		});

		return { pdfId, roomUrl };
	}

	/* ───────────────────── Helper utilities ───────────────────── */

	#createPeer(isInitiator) {
		console.log(
			`${this.logPrefix} Creating new SimplePeer instance (initiator: ${isInitiator})`,
		);
		// eslint-disable-next-line no-undef
		return new SimplePeer({
			initiator: isInitiator,
			trickle: false,
			config: {
				iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
			},
		});
	}

	async #prepareDataForSync(pdfId) {
		const metadata = await this.databaseManager.getPDFMetadata(pdfId);
		const questions = await this.databaseManager.getQuestions(pdfId);

		console.log(
			`${this.logPrefix} Preparing data: ${questions.length} questions found.`,
		);

		const CHUNK_SIZE = 20;
		const chunks = [];
		for (let i = 0; i < questions.length; i += CHUNK_SIZE) {
			chunks.push(questions.slice(i, i + CHUNK_SIZE));
		}
		return {
			metadata,
			questionChunks: chunks,
			totalQuestions: questions.length,
		};
	}

	#generateId() {
		return crypto.randomUUID();
	}

	async #publishOffer(roomUrl, offer) {
		await fetch(roomUrl, {
			method: "PUT",
			body: JSON.stringify({ offer }),
		});
	}

	async #publishAnswer(roomUrl, answer) {
		await fetch(roomUrl, {
			method: "PUT",
			body: JSON.stringify({ answer }),
		});
	}

	async #pollAnswer(roomUrl) {
		const poll = async (retry = 0) => {
			const res = await fetch(roomUrl);
			const json = await res.json();
			if (json.answer) return json.answer;
			if (retry > 30) throw new Error("Timed out waiting for answer");
			await new Promise((r) => setTimeout(r, 1000));
			return poll(retry + 1);
		};
		return poll();
	}
}
