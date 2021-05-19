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
	name: "UNNAMED",
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

// From https://stackoverflow.com/a/196991
function toTitleCase(str) {
	return str.replace(
		/\w\S*/g,
		function(txt) {
			return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
		});
}

rhit.PageController = class {
	constructor() {
		document.querySelector("#startGameButton").onclick = (event) => {
			console.log("Starting Game");
			document.querySelector("#entryPage").style.display = "none";
			rhit.PageManagerSingleton.showQuestionSection();
		};

		document.querySelectorAll(".answer-button").forEach((element) => {
			element.onclick = (event) => {
				console.log("Answer button clicked:", element.dataset.item);
				rhit.PageManagerSingleton.answerButtonPressed(parseInt(element.dataset.item));
			};
		});
	}
};

rhit.PageManager = class {
	constructor() {
		console.log("Page Manager Built. Getting server address...");
		this.getAddressThen(() => {
			this.connectToWsServer();
		});
	}

	async getAddressThen(callbackWhenDone) {
		this.serverAddress = await this.determineServerAddress();
		console.log("Server address is ", this.serverAddress);
		await callbackWhenDone();
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
				this.updateQuestionDisplay(message.Data);
				break;
			case "your_id":
				this.respondToYourID(message.Data);
				break;
			case "reconnect_me_confirm":
				console.log("Accepted reconnect");
				connectionInfo.uuid = message.Data.uuid;
				connectionInfo.name = message.Data.name;
				break;
			case "reconnect_me_deny":
				console.log("Denied reconnect. Using new UUID %s instead.", message.Data);
				connectionInfo.uuid = message.Data.uuid;
				connectionInfo.name = message.Data.name;
				break;
			default:
				console.warn("🔌 Received message of unknown purpose:", message);
				break;
			}
		});
	}

	respondToYourID(data) {
		if (connectionInfo.wasEverConnected) {
			const oldUUID = connectionInfo.uuid;
			connectionInfo.uuid = data.uuid;
			console.log("Attempting to re-establish old UUID ", oldUUID);
			this.sendMessage("reconnect_me", oldUUID);
		} else {
			connectionInfo.uuid = data.uuid;
			connectionInfo.name = data.name;
			this.updatePlayerName(connectionInfo.name);
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
			connectionInfo.isRetrying = true;
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

	// Made this async because I thought we would have to contact the server
	// to find the right port, but looks like that sorts itself out. -Rob
	async determineServerAddress() {
		const isLocalhost = window.location.href.includes("localhost");
		if (isLocalhost) {
			return "ws://localhost:8000";
		} else {
			// return location.origin.replace(/^http/, 'ws'); // Would only work if on the same hostname (it's not)
			return "ws://arcahoot.herokuapp.com/";
		}
	}

	updateRoomKey(key) {
		document.querySelector("#roomKey").innerHTML = `Room Key: ${key}`;
	}

	updatePlayerName(name) {
		document.querySelector("#playerName").innerHTML = toTitleCase(name);
	}

	updateQuestionDisplay(data) {
		document.querySelector("#questionText").innerHTML = data.question;
		const array = data.answers;
		for (let index = 0; index < array.length; index++) {
			const answer = array[index];
			document.querySelector(`#answerButton${index}`).innerHTML = answer;
		}
	}

	showQuestionSection() {
		document.querySelector("#questionsPage").style.display = "block";
		document.querySelector("#answerButtonsContainer").style.display = "block";
		document.querySelector("#answerAwaitContainer").style.display = "none";
	}

	answerButtonPressed(index) {
		document.querySelector("#answerButtonsContainer").style.display = "none";
		document.querySelector("#answerAwaitContainer").style.display = "block";
		rhit.PageManagerSingleton.sendMessage("question_response", index);
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
rhit.main = function () {
	new rhit.PageController();
	rhit.PageManagerSingleton = new rhit.PageManager();

	console.log("Ready");
};

rhit.main();
