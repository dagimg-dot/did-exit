// File: netlify/functions/webrtc-room.js
// A simple, in-memory signalling server for WebRTC offer/answer exchange.

// Using an in-memory Map is sufficient for short-lived, transient room data.
// In a production scenario with high traffic, a more robust solution like Redis
// or a managed database would be preferable.
const rooms = new Map();

export async function handler(event) {
	const { httpMethod: method, path } = event;
	// Extract the room ID from the URL path, e.g., /.netlify/functions/webrtc-room/some-id
	const roomId = path.split("webrtc-room/")[1];

	if (!roomId) {
		return { statusCode: 400, body: "Bad Request: Missing room ID." };
	}

	// GET request: A peer is fetching the connection offer.
	if (method === "GET") {
		const room = rooms.get(roomId) || {};
		return {
			statusCode: 200,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(room),
		};
	}

	// PUT request: A peer is posting its offer or answer.
	if (method === "PUT") {
		try {
			const body = JSON.parse(event.body || "{}");
			const room = rooms.get(roomId) || {};
			// Merge the new data (offer or answer) into the existing room state.
			rooms.set(roomId, { ...room, ...body });
			// 204 No Content is appropriate for a successful PUT with no response body.
			return { statusCode: 204 };
		} catch (error) {
			return {
				statusCode: 400,
				body: `Bad Request: Invalid JSON payload. ${error.message}`,
			};
		}
	}

	// For any other HTTP method, return 405 Method Not Allowed.
	return { statusCode: 405, body: "Method Not Allowed" };
}
