const express = require('express');

const app = express();
app.use(express.static("public"));

// TODO - this is just a copy of the CSSE280 Tic Tac Toe server right now.
// This server exists to manage the actual game. It does not (currently) provide any of the website files.
// We will need to do stuff with websockets (probably?) to maintain a connection with each client.
// Possibly helpful: https://medium.com/hackernoon/implementing-a-websocket-server-with-node-js-d9b78ec5ffa8

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


app.listen(3000);
