/**
 * @fileoverview
 * Provides the JavaScript interactions for all pages.
 *
 * @author 
 * PUT_YOUR_NAME_HERE
 */

/** namespace. */
var rhit = rhit || {};

/** globals */
rhit.PageManagerSingleton = "";

rhit.PageController = class {
	constructor() {
		document.querySelector("#startGameButton").onclick = (event) => {
			console.log("Starting Game");
			document.querySelector("#entryPage").style.display = "none";
			document.querySelector("#questionsPage").style.display = "block";
		}

		document.querySelectorAll(".answer-button").forEach((element) => {
			console.log("Answer button clicked:", element.dataset.item);
		});
	}

	methodName() {

	}
}

rhit.PageManager = class {
	constructor() {
		console.log("Page Manager Built");
	}

	methodName() {

	}
}

/* Main */
/** function and class syntax examples */
rhit.main = function () {
	new rhit.PageController();
	rhit.PageManagerSingleton = new rhit.PageManager();

	console.log("Ready");

};

rhit.main();
