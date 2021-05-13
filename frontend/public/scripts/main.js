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
var connectionInfo = connectionInfo || {};
/* eslint-enable no-var */

/** globals */
rhit.PageManagerSingleton = "";

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

	loadConnectedPlayers() {
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

		// Connection opened
		socket.addEventListener('open', (event) => {
			connectionInfo.wasEverConnected = true;
			console.log("🔌 Connection formed!", event);
			this.sendMessage("greetings", "Hello server!");
		});

		// Connection closed
		socket.addEventListener('close', (event) => {
			console.log("🔌 WS connection closed", event);
			if (connectionInfo.wasEverConnected) {
				alert("You have lost connection to the game server!");
			} else {
				alert("Could not connect to the server. It might be down.");
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
				console.log("🔌 Received a message containing the Roomkey ", message.Data);
				this.updateRoomKey(message.Data);

				this.loadConnectedPlayers();
				break;
			case "question_info":
				break;
			case "your_id":
				connectionInfo.uuid = message.Data;
				break;
			default:
				console.warn("🔌 Received message of unknown purpose:", message);
				break;
			}
		});
	}

	sendMessage(purpose, data) {
		if (socket) {
			const messageStr = JSON.stringify({"Purpose": purpose, "Data": data});
			socket.send(messageStr);
		} else {
			console.error("Tried to send when the socket was not yet set up");
		}
	}

	determineServerAddress() {
		// TODO make sure heroku server address is correct
		return window.location.href.includes("localhost") ? "ws://localhost:8080" : "ws://arcahoot.herokuapp.com:";
	}

	updateRoomKey(key) {
		document.querySelector("#roomKey").innerHTML = `Room Key: ${key}`;
	}

	addPlayerToList(name) {
		document.querySelector("#roomKey").innerHTML = `Room Key: ${key}`;
	}

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
