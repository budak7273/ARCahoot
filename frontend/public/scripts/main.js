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
	roomKey: "UNSET",
	colorHex: "#af2222",
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
		const urlParams = new URLSearchParams(window.location.search);
		document.querySelector("#startGameButton").onclick = (event) => {
			console.log("Starting Game");

			if (urlParams.get('perm') == "button") {
				document.querySelector("#toScoresScreenButton").style.display = 'block';
				document.querySelector("#toNextQuestionButton").style.display = 'block';
			}
			rhit.PageManagerSingleton.startGame();
		};

		document.querySelector("#toScoresScreenButton").onclick = (event) => {
			rhit.PageManagerSingleton.toScoresScreen();
		};
		document.querySelector("#toNextQuestionButton").onclick = (event) => {
			rhit.PageManagerSingleton.advanceGame();
		};

		if (urlParams.get('perm') == "button") {
			document.querySelector("#startGameButton").style.display = 'block';
		} else {
			document.querySelector("#startGameWaitingOnHost").style.display = 'block';
		}

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
		console.log(playerData);
		playerList.innerHTML = "";
		playerData.forEach((data) => {
			const playerCard = this._createPlayerItem(toTitleCase(`${data.name}`));
			playerCard.style.color = data.color;
			playerList.appendChild(playerCard);
		});
	}

	updateConnectionInfo(uuid, name, colorHex) {
		connectionInfo.uuid = uuid;
		connectionInfo.name = name;
		connectionInfo.colorHex = colorHex;
		this.updatePlayerName(connectionInfo.name);
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
				alert("Could not connect to the server. It might be down.\n\n" +
					"Try coming back to the page in a few seconds - it takes a bit for the server to return from sleep.");
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
				connectionInfo.roomKey = message.Data;
				this.updateRoomKey(message.Data);
				break;
			case "question_info":
				this.updateQuestionDisplay(message.Data);
				break;
			case "your_id":
				this.respondToYourID(message.Data);
				break;
			case "reconnect_me_confirm":
				console.log("Accepted reconnect");
				this.updateConnectionInfo(message.Data.uuid, message.Data.name, message.Data.color);
				break;
			case "reconnect_me_deny":
				console.log("Denied reconnect. Using new UUID %s instead.", message.Data);
				this.updateConnectionInfo(message.Data.uuid, message.Data.name, message.Data.color);
				break;
			case "start_game":
				console.log("🎉 Game has been started!");
				this.startGame();
				break;
			case "players_list":
				console.log("Updating player list");
				this.loadConnectedPlayers(message.Data.players);
				break;
			case "scores_screen_data":
				console.log("Updating scores on the client's side");
				this.updatePlayerScores(message.Data);
				break;
			default:
				console.warn("🔌 Received message of unknown purpose:", message);
				break;
			}
		});
	}

	startGame() {
		this.sendMessage("server_start_game", connectionInfo.roomKey);
	}

	advanceGame() {
		this.sendMessage("request_question_for_all", connectionInfo.roomKey);
	}

	toScoresScreen() {
		this.sendMessage("go_to_scores_screen_for_all", {});
	}

	respondToYourID(data) {
		if (connectionInfo.wasEverConnected) {
			const oldUUID = connectionInfo.uuid;
			connectionInfo.uuid = data.uuid;
			console.log("Attempting to re-establish old UUID ", oldUUID);
			this.sendMessage("reconnect_me", oldUUID);
		} else {
			this.updateConnectionInfo(data.uuid, data.name, data.color);
			connectionInfo.wasEverConnected = true;
			connectionInfo.isRetrying = false;
			connectionInfo.retryCounter = 0;

			this.sendMessage("roomkey_new", "");
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
			return "wss://arcahoot.herokuapp.com/";
		}
	}

	updateRoomKey(key) {
		document.querySelector("#roomKey").innerHTML = `Room Key: ${key}`;
	}

	updatePlayerName(name) {
		document.querySelector("#playerName").innerHTML = toTitleCase(name);
		document.querySelector("#playerName").style.color = connectionInfo.colorHex;
		document.querySelector("#entireNavbar").style.backgroundColor = connectionInfo.colorHex;
	}

	updateQuestionDisplay(data) {
		document.querySelector("#entryPage").style.display = 'none';
		rhit.PageManagerSingleton.showQuestionSection();
		document.querySelector("#questionText").innerHTML = data.question;
		const array = data.answers;
		for (let index = 0; index < array.length; index++) {
			const answer = array[index];
			document.querySelector(`#answerButton${index}`).innerHTML = answer;
		}
	}

	answerButtonPressed(index) {
		document.querySelector("#answerButtonsContainer").style.display = "none";
		document.querySelector("#answerAwaitContainer").style.display = "block";
		rhit.PageManagerSingleton.sendMessage("question_response", index);
	}

	showQuestionSection() {
		document.querySelector("#scorePage").style.display = "none";
		document.querySelector("#entryPage").style.display = "none";

		document.querySelector("#questionsPage").style.display = "block";

		document.querySelector("#answerButtonsContainer").style.display = "block";
		document.querySelector("#answerAwaitContainer").style.display = "none";
	}

	showScoresSection() {
		document.querySelector("#questionsPage").style.display = "none";
		document.querySelector("#entryPage").style.display = "none";
		document.querySelector("#finalRoundHeader").style.display = 'none';

		document.querySelector("#scorePage").style.display = "block";
	}

	showEntrySection() {
		document.querySelector("#questionsPage").style.display = "none";
		document.querySelector("#scorePage").style.display = "none";

		document.querySelector("#entryPage").style.display = "block";
	}

	updatePlayerScores(data) {
		this.showScoresSection();
		console.log("Scores info:", data);
		const rankings = document.querySelector("#scoreList");
		const wereYouCorrect = document.querySelector("#wereYouCorrectHeader");
		const correctAnswerElement = document.querySelector("#correctAnswer");
		rankings.innerHTML = "";
		correctAnswerElement.innerHTML = data.correctAnswer;
		let myRanking = {};
		data.scoreData.sort((a, b) => b.score-a.score);
		data.scoreData.forEach((e) => {
			let isMe = false;
			if (e.name === connectionInfo.name) {
				myRanking = e;
				isMe = true;
			}
			const element = this._createPlayerScoreItem(toTitleCase(e.name), e.score, isMe);
			element.style.color = e.color;
			rankings.appendChild(element);
		});
		console.log("My ranking is", myRanking);
		wereYouCorrect.innerHTML =
			(myRanking.didYouAnswer) ?
				((myRanking.wereYouCorrect) ? "You were correct!" : "You were not correct.") :
				"You didn't answer...";

		if (data.isFinalScores) {
			console.log("Is final round");
			// document.querySelector("#toNextQuestionButton").style.display = 'none';
			document.querySelector("#finalRoundHeader").style.display = 'block';
		}
	}

	_createPlayerItem(playerName) {
		return htmlToElement(
			`<div class="player-item"><p>${playerName}</p></div>`);
	}

	_createPlayerScoreItem(playerName, score, isMe) {
		return htmlToElement(
			`<li class="${isMe ? 'my-score' : 'other-player-score'}"><span>${playerName}</span>          <span>${score}</span></li>`);
		// return htmlToElement(
		// 	`<div class="player-item"><p>${playerName}</p><p>${score}</p></div>`);
	}
};

/* Main */
rhit.main = function () {
	new rhit.PageController();
	rhit.PageManagerSingleton = new rhit.PageManager();

	console.log("Ready");
};

rhit.main();
