/**
 * @fileoverview
 * Provides the JavaScript interactions for all pages.
 *
 * @author
 * Rob Budak, Alex Harris, Caleb Schlundt
 */

/* eslint-disable no-var */
var rhit = rhit || {};
var socket = socket || {};
var connectionInfo = {
	uuid: "UNSET",
	isRetrying: false,
	wasEverConnected: false,
	retryCounter: 0,
};
/* eslint-enable no-var */

/** globals */
rhit.PageManagerSingleton = "";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// From https://stackoverflow.com/a/35385518/12693560
/**
 * @param {String} html representing a single element
 * @return {Element}
 */
function htmlToElement(html) {
	const template = document.createElement('template');
	html = html.trim(); // Never return a text node of whitespace as the result
	template.innerHTML = html;
	return template.content.firstChild;
}

rhit.PageController = class {
	constructor() {
		document.querySelector("#startGameButton").onclick = (event) => {
			console.log("Starting Game");
			document.querySelector("#entryPage").style.display = "none";
			document.querySelector("#questionsPage").style.display = "block";
		};

		document.querySelectorAll(".answer-button").forEach((element) => {
			element.onclick = (event) => {
				console.log("Answer button clicked:", element.dataset.item);
			};
		});
	}
};

rhit.PageManager = class {
	constructor() {
		console.log("Page Manager Built");
		this.serverAddress = this.determineServerAddress();
		console.log("Server address is ", this.serverAddress);

		this.connectToWsServer();
	}

	loadConnectedPlayers(playerData) {
		const playerList = document.querySelector("#connectedPlayers");
		for (let index = 0; index < 10; index++) {
			const playerCard = this._createPlayerItem(`Player ${index}`);
			playerList.appendChild(playerCard);
		}
	}

	connectToWsServer() {
		// Create WebSocket connection.
		console.log("🔌 Attempting to connect to %s...", this.serverAddress);

		socket = new WebSocket(this.serverAddress);

		// Connection error (or never connected)
		socket.addEventListener('error', (event) => {
			// console.error("🔌 Error:", event);
			if (connectionInfo.wasEverConnected) {
				connectionInfo.isRetrying = true;
				this.attemptReconnect();
			} else {
				// Never established first connection, so don't retry
				alert("Could not connect to the server. It might be down.");
			}
		});

		// Connection opened
		socket.addEventListener('open', (event) => {
			if (connectionInfo.isRetrying) {
				connectionInfo.isRetrying = false;
				console.log(`🔌✔ Connection re-formed after ${connectionInfo.retryCounter} tries!`);
				connectionInfo.retryCounter = 0;
			} else {
				console.log("🔌 New connection formed!", event);
			}
		});

		// Connection closed
		socket.addEventListener('close', (event) => {
			if (connectionInfo.isRetrying) {
				// Retrying again is handled by `error` event
				console.log("🔌 Retry attempt failed!", event);
			} else if (connectionInfo.wasEverConnected) {
				if (event.wasClean) {
					console.log("🔌🛑 WS connection cleanly closed", event);
				} else {
					console.warn("🔌⚠ WS connection lost!", event);
					this.attemptReconnect();
				}
			}
		});

		// Listen for messages
		socket.addEventListener('message', (event) => {
			const messageRaw = event.data;
			let message;
			try {
				message = JSON.parse(messageRaw);
				console.log("🔌 Got message:", message.Purpose, message.Data);
			} catch (error) {
				console.warn("Message was not in JSON form: ", messageRaw);
				return;
			}

			switch (message.Purpose) {
			case "roomkey":
				console.log("Received a message containing the Roomkey ", message.Data);
				this.updateRoomKey(message.Data);

				this.loadConnectedPlayers();
				break;
			case "question_info":
				console.log("TODO question info setting");
				break;
			case "your_id":
				this.respondToYourID(message.Data);
				break;
			case "reconnect_me_confirm":
				console.log("Accepted reconnect");
				connectionInfo.uuid = message.Data;
				break;
			case "reconnect_me_deny":
				console.log("Denied reconnect. Using new UUID %s instead.", message.Data);
				connectionInfo.uuid = message.Data;
				break;
			default:
				console.warn("🔌 Received message of unknown purpose:", message);
				break;
			}
		});
	}

	respondToYourID(data) {
		console.log(data);
		if (connectionInfo.wasEverConnected) {
			const oldUUID = connectionInfo.uuid;
			connectionInfo.uuid = data;
			console.log("Attempting to re-establish old UUID ", oldUUID);
			this.sendMessage("reconnect_me", oldUUID);
		} else {
			connectionInfo.uuid = data;
			connectionInfo.wasEverConnected = true;
			connectionInfo.isRetrying = false;
			connectionInfo.retryCounter = 0;

			// TODO actual request room keys and players list
			this.sendMessage("roomkey_new", "");
			this.sendMessage("question_details", "");
		}
	}

	attemptReconnect() {
		if (connectionInfo.retryCounter + 1 > MAX_RETRIES) {
			alert(`Failed to re-establish connection to game server after ${MAX_RETRIES} tries`);
		} else {
			connectionInfo.retryCounter++;
			setTimeout(() => {
				console.log(`🏓 Attempting to re-connect (try ${connectionInfo.retryCounter} of ${MAX_RETRIES})...`);
				this.connectToWsServer();
			}, RETRY_DELAY_MS);
		}
	}

	sendMessage(purpose, data) {
		if (socket) {
			const messageStr = JSON.stringify({"Purpose": purpose, "Data": data, "UUID": connectionInfo.uuid});
			socket.send(messageStr);
		} else {
			console.error("Tried to send when the socket was not yet set up");
		}
	}

	determineServerAddress() {
		// TODO make sure heroku server address is correct
		const HOST = location.origin.replace(/^http/, 'ws');
		console.log("HOST", HOST);

		return window.location.href.includes("localhost") ? "ws://localhost:8000" : "wss://arcahoot.herokuapp.com";
	}

	updateRoomKey(key) {
		document.querySelector("#roomKey").innerHTML = `Room Key: ${key}`;
	}

	// addPlayerToList(name) {
	// 	document.querySelector("#roomKey").innerHTML = `Room Key: ${key}`;
	// }

	_createPlayerItem(playerName) {
		// TODO use cards for players maybe?
		// return htmlToElement(
		// 	`<div class="card">
		// 		<div class="card-body">
		// 			<h5 class="card-title">${player}</h5>
		// 		</div>
		// 	</div>`);
		return htmlToElement(
			`<div class="player-item"><p>${playerName}</p></div>`);
	}
};

/* Main */
/** function and class syntax examples */
rhit.main = function () {
	new rhit.PageController();
	rhit.PageManagerSingleton = new rhit.PageManager();

	console.log("Ready");
};

rhit.main();
