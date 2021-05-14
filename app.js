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
const port = 8000;
/*
let port = process.env.PORT;
if (port == null || port == "") {
	port = 8000;
}
*/
const ws_port = 3000;

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

const wss = new WebSocket.Server({port: ws_port});

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

console.log(`WebSocket server listening on port ${ws_port}...`);


// Web server setup

const app = express();
app.use(express.static("public"));

app.get("/", (req, res) => {
	res.send(`Visit <a href="https://arcahoot.web.app/">the site</a> to play`);
});


app.get("/info/uuid_to_ws", (req, res) => {
	console.log("Received HTTP request");
	res.json({uuid_to_ws: uuid_to_ws});
});

app.get("/info/ws_to_uuids", (req, res) => {
	console.log("Received HTTP request");
	res.json({ws_to_uuids: ws_to_uuids});
});


console.log(`Listening on port ${port}...`);
app.listen(port, '0.0.0.0');
