const express = require('express');
const {v4: uuidv4} = require('uuid');

// This server exists to manage the actual game. It does not (currently) provide any of the website files.
// We will need to do stuff with websockets (probably?) to maintain a connection with each client.
// Possibly helpful: https://medium.com/hackernoon/implementing-a-websocket-server-with-node-js-d9b78ec5ffa8

// Special info about WebSockets on Heroku:
// https://devcenter.heroku.com/articles/websockets


// Consider heartbeat connection maintain https://www.npmjs.com/package/ws#how-to-detect-and-close-broken-connections

// Must stay 8000 for Heroku.
// `process.env.PORT` seems to read from 5000 from the frontend folder's running firebase serve
// Eventually fix that and figure out why
let ws_port = process.env.PORT;
if (ws_port == null || ws_port == "") {
	ws_port = 8000;
}
console.log("Port detected", ws_port);

const questions = [
	"What port do you connect to on the localhost?",
	"Which of the following is an actual method of connecting a client to a server?",
	"What is x: 2x+1=5"];

const answers = [
	["5000", "8000", "1000", "0"],
	["TCP", "Messager Pigeon", "Mail Service", "Webpage"],
	["0", "1", "2", "5"]];

const uuid_to_ws = {};
const ws_to_uuids = {};

const rooms = {};

const WebSocket = require('ws');

// Start of http server
const app = express();
// app.use(express.static("public"));

app.get("/", (req, res) => {
	res.send(`Visit <a href="https://arcahoot.web.app/">the site</a> to play`);
});

app.get("/port", (req, res) => {
	res.json({port: ws_port});
});

// Debugging endpoints to view server info

app.get("/info/uuid_to_ws", (req, res) => {
	console.log("Received HTTP request");
	res.json({uuid_to_ws: uuid_to_ws});
});

app.get("/info/ws_to_uuids", (req, res) => {
	console.log("Received HTTP request");
	res.json({ws_to_uuids: ws_to_uuids});
});

const server = app.listen(ws_port, () => {
	console.log("Express server started on", ws_port);
});
// End of http server

// Start of websocket upgrade server, reu-using the above http server
const wss = new WebSocket.Server({server: server});

wss.on('connection', function connection(ws, req) {
	console.log("Connection established with", ws._socket.remoteAddress);

	const newClientUUID = uuidv4();
	addNewClient(newClientUUID, ws);
	sendJson(ws, "your_id", newClientUUID);

	ws.on('message', function incoming(messageRaw) {
		let message;
		try {
			try {
				message = JSON.parse(messageRaw);
				console.log("🔌 Got message:", message.Purpose, message.Data);
			} catch (error) {
				console.warn("Message was not in JSON form: ", messageRaw);
				return;
			}

			switch (message.Purpose) {
			case "roomkey_new":
				const roomkey = makeRoomKey();
				sendJson(ws, "roomkey", roomkey);
				break;
			case "question_details":
				const index = Math.floor(Math.random() * questions.length);
				sendJson(ws, "question_info", {
					question: questions[index],
					answers: answers[index],
				});
				break;
			case "reconnect_me":
				const clientUUIDToInvalidate = message.UUID;
				const clientUUIDToRestore = message.Data;
				console.log("Client %s is trying to restore to old UUID %s", clientUUIDToInvalidate, clientUUIDToRestore);
				if (uuid_to_ws[clientUUIDToRestore]) {
					releaseClient(clientUUIDToInvalidate);
					console.log("Allowed client to reconnect");
					uuid_to_ws[clientUUIDToRestore].socket = ws;
					sendJson(ws, "reconnect_me_confirm", clientUUIDToRestore);
				} else {
					console.log("Refused client reconnect (uuid not on record)");
					sendJson(ws, "reconnect_me_deny", clientUUIDToInvalidate);
				}
				break;
			default:
				console.warn("🔌 Received message of unknown purpose:", message);
				break;
			}
		} catch (error) {
			// Silently ignore message
			return;
		}
	});

	ws.on('close', (params) => {
		console.log("Connection closed", params);
	});
});

const addNewClient = (uuid, ws) => {
	ws_to_uuids[ws] = uuid;
	uuid_to_ws[uuid] = {socket: ws};
};

const releaseClient = (uuid, ws) => {
	// Further closing logic?
	delete ws_to_uuids[ws];
	delete uuid_to_ws[uuid];
};

const sendJson = (ws, purpose, data) => {
	const messageStr = JSON.stringify({"Purpose": purpose, "Data": data, "UUID": "SERVER"});
	ws.send(messageStr);
};

const makeRoomKey = () => {
	const roomKeyAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	const randomLetter = () => {
		return roomKeyAlphabet[Math.floor(Math.random() * roomKeyAlphabet.length)];
	};
	return randomLetter() + randomLetter() + randomLetter() + randomLetter() + randomLetter();
};
