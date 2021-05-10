/**
 * @fileoverview
 * Provides the JavaScript interactions for all pages.
 *
 * @author
 * Rob Budak, Alex Harris, Caleb Schlundt
 */

/* eslint-disable no-var */
var rhit = rhit || {};
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

	methodName() {

	}
};

rhit.PageManager = class {
	constructor() {
		console.log("Page Manager Built");
		this.roomKey = "HHTPZ";
		this.serverAddress = this.determineServerAddress();
		console.log("Server address is ", this.serverAddress);

		// TODO switch to actual loading instead of fake data
		this.updateRoomKey();
		const playerList = document.querySelector("#connectedPlayers");
		for (let index = 0; index < 10; index++) {
			const playerCard = this._createPlayerItem(`Player ${index}`);
			playerList.appendChild(playerCard);
		}
	}

	determineServerAddress() {
		return window.location.href.includes("localhost") ? "http://localhost:8000/" : "https://arcahoot.herokuapp.com/";
	}

	updateRoomKey(key) {
		document.querySelector("#roomKey").innerHTML = `Room Key: ${this.roomKey}`;
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
