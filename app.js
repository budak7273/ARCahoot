const express = require('express');

const app = express();
app.use(express.static("public"));


// This server exists to manage the actual game. It does not (currently) provide any of the website files.
// We will need to do stuff with websockets (probably?) to maintain a connection with each client.
// Possibly helpful: https://medium.com/hackernoon/implementing-a-websocket-server-with-node-js-d9b78ec5ffa8

// Special info about WebSockets on Heroku:
// https://devcenter.heroku.com/articles/websockets


// Must stay 8000 for Heroku.
// `process.env.PORT` seems to read from 5000 from the frontend folder's running firebase serve
// Eventually fix that and figure out why
const port = 8000;
/*
let port = process.env.PORT;
if (port == null || port == "") {
	port = 8000;
}
*/

app.get("/", (req, res) => {
	res.json({message: "Hello, world!"});
});

app.get("/api/getmove/:board", (req, res) => {
	const boardString = req.params.board;
	const openLocs = getOpenLocations(boardString);

	const moveSelected = openLocs[Math.floor(Math.random() * openLocs.length)];

	console.log(boardString);
	// res.json({boardString: boardString});
	res.json({"move": moveSelected});
});

function getOpenLocations(boardString) {
	const openLocations = [];
	for (let index = 0; index < boardString.length; index++) {
		if (boardString.charAt(index) == '-') {
			openLocations.push(index);
		}
	}
	return openLocations;
}

console.log(`Listening on port ${port}...`);
app.listen(port);
