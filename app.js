const express = require('express');
const {v4: uuidv4} = require('uuid');
const generateName = require('project-name-generator');
const randomColor = require('randomcolor');
const WebSocket = require('ws');

// This server exists to manage the actual game. It does not (currently) provide any of the website files.
// We will need to do stuff with websockets (probably?) to maintain a connection with each client.
// Possibly helpful: https://medium.com/hackernoon/implementing-a-websocket-server-with-node-js-d9b78ec5ffa8

// Special info about WebSockets on Heroku:
// https://devcenter.heroku.com/articles/websockets

// Consider heartbeat connection maintain https://www.npmjs.com/package/ws#how-to-detect-and-close-broken-connections

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

Room = class {
	constructor (roomKeyString) {
		this.room_key = roomKeyString;
		this.question_index = 0;
		this.players = [];
		this.whoAnswered = [];
	}

	getQuestion() {
		return questionData[this.question_index];// || questionData[0]; // TODO make better default
	}

	getCorrectAnswer() {
		const question = this.getQuestion();
		const answer = question.answers[question.correctAnswerIndex];
		return answer;
	}

	checkAnswer(answerIndex) {
		return this.getQuestion().correctAnswerIndex == answerIndex;
	}

	getAllPlayerNames() {
		const playerNames = [];
		this.players.forEach((userObj) => {
			playerNames.push(userObj.name);
		});
		return playerNames;
	}

	getPlayerScores() {
		console.log("GetScores");
		const playerScores = [];
		this.players.forEach((userObj) => {
			playerScores.push({
				name: userObj.name,
				score: userObj.score,
				wereYouCorrect: userObj.lastWasCorrect,
				didYouAnswer: this.whoAnswered.indexOf(userObj) != -1,
			});
		});
		return playerScores;
	}

	markUserAsAnswered(user) {
		this.whoAnswered.push(user);
	}

	nextRound() {
		wipeRoundData();
		this.question_index++;
		console.log("Is now index", this.question_index);
	}

	wipeRoundData() {
		this.whoAnswered = [];
	}

	restart() {
		this.question_index = 0;
		this.wipeRoundData();
	}
};

User = class {
	constructor(uuid, socket, name) {
		this.uuid = uuid;
		this.socket = socket;
		this.name = name;
		this.score = 0;
		this.color = randomColor({
			luminosity: 'dark',
		});
		this.lastWasCorrect = false;
	}
};

const uuid_to_user = {};
const ws_to_uuids = {};
const user_to_room = {};

const rooms = {
	DEFAULT_ROOM: new Room("UNSET"),
};

// Start of http server
const app = express();
// app.use(express.static("public")); // We don't serve any site files from here (yet?)

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
			// copyOfRecords[key].room = "[Room]";
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

// Start of websocket upgrade server, re-using the above http server
const wss = new WebSocket.Server({server: server});

// wss.on('connection', function connection(ws, req) {
wss.on('connection', (ws, req) => {
	console.log("Connection established with", ws._socket.remoteAddress);

	const newClientUUID = uuidv4();
	const newClientName = generateName({words: 2, alliterative: true}).spaced;
	const newClient = addNewClient(newClientUUID, newClientName, ws);
	sendJson(ws, "your_id", {
		uuid: newClientUUID,
		name: newClientName,
	});

	// Send updated players list to all players
	sendJsonToAllUsers("players_list", {
		players: rooms.DEFAULT_ROOM.getAllPlayerNames(),
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
			const senderUser = uuid_to_user[message.UUID];
			const senderRoom = user_to_room[senderUser];

			switch (message.Purpose) {
			case "roomkey_new":
				// const roomkey = makeRoomKey(); // eventually make more than one room
				const roomkey = rooms.DEFAULT_ROOM.room_key;
				sendJson(ws, "roomkey", roomkey);
				break;
			case "request_question_for_all":
				const question = senderRoom.getQuestion();
				console.log("Question is", question);
				sendJsonToAllUsers("question_info", {
					question: question.question,
					answers: question.answers,
				});
				break;
			case "server_start_game":
				console.log("🎉 Starting game");
				senderRoom.restart();
				const initialQuestion = senderRoom.getQuestion();

				sendJsonToAllUsers("question_info", {
					question: initialQuestion.question,
					answers: initialQuestion.answers,
				});
				break;
			case "go_to_scores_screen_for_all":
				console.log("Sending users to scores screen");
				const totalQuestions = questionData.length;
				const highestIndex = totalQuestions - 1;
				let isFinalScores = false;
				if (senderRoom.question_index < highestIndex) {
					console.log("Scores for question index %s of %s", senderRoom.question_index, highestIndex);
				} else {
					console.log("Final scores");
					isFinalScores = true;
				}

				const scoreData = senderRoom.getPlayerScores();
				sendJsonToAllUsers("scores_screen_data", {
					isFinalScores: isFinalScores,
					correctAnswer: senderRoom.getCorrectAnswer(),
					scoreData: scoreData,
				});
				senderRoom.nextRound();
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
			case "question_response":
				console.log(message);
				const answer_index = message.Data;
				console.log("Question response received. AnsIndex", answer_index);
				console.log("from user ", senderUser.name);
				senderRoom.markUserAsAnswered(senderUser);

				if (senderRoom.checkAnswer(answer_index)) {
					senderUser.score += 1000;
					senderUser.lastWasCorrect = true;
					console.log("Correct");
				} else {
					senderUser.lastWasCorrect = false;
					console.log("Incorrect");
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

	// Needs to be a function, not a lambda, so that `this` is properly bound?
	ws.on('close', function close(params) {
		// TODO detect which websocket/user it was so we can remove user from the players list
		// `ws` is just the last created socket ... won't work long term
		// so is `this` :(
		// https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
		// console.log("===================THIS is ", this);
		const uuid = ws_to_uuids[this];
		const associatedPlayer = uuid_to_user[uuid];
		console.log("Player ", associatedPlayer.name);
		// const uuid = "<TODO better close message>";
		console.log("❌ Connection to TODO FIX'%s' closed with status %s", associatedPlayer.name, params);
		// releaseClient(uuid, this);
	});
});

const addNewClient = (uuid, name, ws) => {
	const freshUser = new User(uuid, ws, name);
	ws_to_uuids[ws] = uuid;
	uuid_to_user[uuid] = freshUser;
	user_to_room[freshUser] = rooms.DEFAULT_ROOM;
	rooms.DEFAULT_ROOM.players.push(freshUser);
	return freshUser;
};

const releaseClient = (uuid, ws) => {
	// Further closing logic?
	const clientIndex = rooms.DEFAULT_ROOM.players.indexOf(uuid_to_user[uuid]);
	console.log("clientIndex", clientIndex);
	delete ws_to_uuids[ws];
	delete uuid_to_user[uuid];
	// console.log("Players before", rooms.DEFAULT_ROOM.players);
	rooms.DEFAULT_ROOM.players.splice(clientIndex, 1);
	// console.log("Players after", rooms.DEFAULT_ROOM.players);
};

const sendJson = (ws, purpose, data) => {
	const messageStr = JSON.stringify({"Purpose": purpose, "Data": data, "UUID": "SERVER"});
	ws.send(messageStr);
};

const sendJsonToAllUsers= (purpose, data) => {
	for (const key in uuid_to_user) {
		if (Object.hasOwnProperty.call(uuid_to_user, key)) {
			const item = uuid_to_user[key];
			sendJson(item.socket, purpose, data);
		}
	}

	// Shouldn't need this?
	// wss.clients.forEach(function each(client) {
	// 	if (client.readyState === WebSocket.OPEN) {
	// 		sendJson(ws, "question_info", {
	// 			question: questionData[indexToAll].question,
	// 			answers: questionData[indexToAll].answers,
	// 		});
	// 	}
	// });
};

const makeRoomKey = () => {
	const roomKeyAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	const randomLetter = () => {
		return roomKeyAlphabet[Math.floor(Math.random() * roomKeyAlphabet.length)];
	};
	return randomLetter() + randomLetter() + randomLetter() + randomLetter() + randomLetter();
};


rooms.DEFAULT_ROOM.room_key = makeRoomKey();
