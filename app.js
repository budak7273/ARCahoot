const express = require('express');
const {v4: uuidv4} = require('uuid');

const app = express();
app.use(express.static("public"));


// This server exists to manage the actual game. It does not (currently) provide any of the website files.
// We will need to do stuff with websockets (probably?) to maintain a connection with each client.
// Possibly helpful: https://medium.com/hackernoon/implementing-a-websocket-server-with-node-js-d9b78ec5ffa8

// Special info about WebSockets on Heroku:
// https://devcenter.heroku.com/articles/websockets


// Consider heartbeat connection maintain https://www.npmjs.com/package/ws#how-to-detect-and-close-broken-connections

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
const ws_port = 8080;

const questions = [
	"What port do you connect to on the localhost?",
	"Which of the following is an actual method of connecting a client to a server?",
	"What is x: 2x+1=5"];

const answers = [
	["5000", "8000", "1000", "0"],
	["TCP", "Messager Pigeon", "Mail Service", "Webpage"],
	["0", "1", "2", "5"]];

app.get("/", (req, res) => {
	res.send(`Visit <a href="https://arcahoot.web.app/">the site</a> to play`);
});

const WebSocket = require('ws');

const wss = new WebSocket.Server({port: ws_port});

wss.on('connection', function connection(ws, req) {
	console.log("Connection established with", ws._socket.remoteAddress);

	ws.on('message', function incoming(message) {
		try {
			message = JSON.parse(message);
			console.log('received: %s', message);
		} catch (error) {
			// Silently ignore message
			return;
		}
	});

	ws.on('close', (params) => {
		console.log("Connection closed");
	});

	// TODO respond to specific messages instead of bursting everything

	const roomkey = makeRoomKey();

	sendJson(ws, "roomkey", roomkey);
	// sendJson(ws, "hello", "Hi there");
	sendJson(ws, "your_id", uuidv4());

	const index = Math.floor(Math.random() * questions.length);
	sendJson(ws, "question_info", {
		question: questions[index],
		answers: answers[index],
	});
});

const sendJson = (ws, purpose, data) => {
	const messageStr = JSON.stringify({"Purpose": purpose, "Data": data});
	ws.send(messageStr);
};

const makeRoomKey = () => {
	const roomKeyAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	const randomLetter = () => {
		return roomKeyAlphabet[Math.floor(Math.random() * roomKeyAlphabet.length)];
	};
	return randomLetter() + randomLetter() + randomLetter() + randomLetter() + randomLetter();
};

console.log(`Listening on port ${port}...`);
console.log(`WebSocket server listening on port ${ws_port}...`);
app.listen(port);
