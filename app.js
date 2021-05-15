const express = require('express');
const {v4: uuidv4} = require('uuid');
const generateName = require('project-name-generator');

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

const questionData = [
	{
		question: "What port is your client's websocket on?",
		answers: ["5000", "8000", "1000", "Who knows?"],
		correctAnswerIndex: 3,
	},
	{
		question: "Which of the following is an actual method of connecting a client to a server?",
		answers: ["TCP", "Messager Pigeon", "Mail Service", "Webpage"],
		correctAnswerIndex: 3,
	},
	{
		question: "What is x: 2x+1=5",
		answers: ["0", "1", "2", "5"],
		correctAnswerIndex: 3,
	},
	{
		question: "What does a client use to connect to a server?",
		answers: ["Unicorns and Rainbows", "The SGA Budget", "Final Exams", "Sockets"],
		correctAnswerIndex: 3,
	},
];

const uuid_to_user = {};
const ws_to_uuids = {};

const rooms = {
	DEFAULT_ROOM: {},
};

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

app.get("/info/uuid_to_user", (req, res) => {
	const copyOfRecords = Object.assign({}, uuid_to_user);
	for (const key in copyOfRecords) {
		if (Object.hasOwnProperty.call(copyOfRecords, key)) {
			copyOfRecords[key].socket = "[Socket]";
		}
	}
	res.json({uuid_to_user: uuid_to_user});
});

app.get("/info/ws_to_uuids", (req, res) => {
	res.json({ws_to_uuids: ws_to_uuids});
});

app.get("/info/rooms", (req, res) => {
	res.json({rooms: rooms});
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
	const newClientName = generateName({words: 2, alliterative: true}).spaced;
	addNewClient(newClientUUID, newClientName, ws);
	sendJson(ws, "your_id", {
		uuid: newClientUUID,
		name: newClientName,
	});

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
			const fromUser = uuid_to_user[message.uuid];

			switch (message.Purpose) {
			case "roomkey_new":
				const roomkey = makeRoomKey();
				sendJson(ws, "roomkey", roomkey);
				break;
			case "question_details":
				const index = Math.floor(Math.random() * questionData.length);
				sendJson(ws, "question_info", {
					question: questionData[index].question,
					answers: questionData[index].answers,
				});
				break;
			case "reconnect_me":
				const clientUUIDToInvalidate = message.UUID;
				const clientUUIDToRestore = message.Data;
				console.log("Client %s is trying to restore to old UUID %s", clientUUIDToInvalidate, clientUUIDToRestore);
				if (uuid_to_user[clientUUIDToRestore]) {
					releaseClient(clientUUIDToInvalidate);
					console.log("Allowed client to reconnect");
					uuid_to_user[clientUUIDToRestore].socket = ws;
					sendJson(ws, "reconnect_me_confirm", {
						uuid: clientUUIDToRestore,
						name: uuid_to_user[clientUUIDToRestore].name,
					});
				} else {
					console.log("Refused client reconnect (uuid not on record)");
					sendJson(ws, "reconnect_me_deny", {
						uuid: clientUUIDToInvalidate,
						name: uuid_to_user[clientUUIDToInvalidate].name,
					});
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
		// TODO detect which websocket/user it was so we can remove user from the players list
		// `ws` is just the last created socket ... won't work long term
		// https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
		console.log(params);
		const uuid = ws_to_uuids[ws];
		console.log("❌ Connection to %s closed with status %s", uuid, params);
		releaseClient(uuid, ws);
	});
});

const addNewClient = (uuid, name, ws) => {
	ws_to_uuids[ws] = uuid;
	uuid_to_user[uuid] = {
		uuid: uuid,
		socket: ws,
		name: name,
	};
};

const releaseClient = (uuid, ws) => {
	// Further closing logic?
	delete ws_to_uuids[ws];
	delete uuid_to_user[uuid];
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

const getPlayersInRoom =(roomKey) => {
	const room = rooms.DEFAULT_ROOM; // TODO use room key here
	const players = room.players || [];
	const playerNames = [];
	players.forEach((playerObj) => {
		playerNames.push(playerObj.name);
	});
	return playerNames;
};
