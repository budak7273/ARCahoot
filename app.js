const express = require('express');
const {v4: uuidv4} = require('uuid');
const generateName = require('project-name-generator');
const randomColorGoldenRatio = require('random-color');
const WebSocket = require('ws');

// This server exists to manage the actual game. It does not (currently) provide any of the website files.

// Special info about WebSockets on Heroku:
// https://devcenter.heroku.com/articles/websockets

// Consider heartbeat connection maintain https://www.npmjs.com/package/ws#how-to-detect-and-close-broken-connections

let ws_port = process.env.PORT;
if (ws_port == null || ws_port == "") {
	ws_port = 8000;
}
console.log("Set to port:", ws_port);

const KILL_INACTIVE_USERS_INTERVAL_MS = 10000;
const INACTIVE_USER_MAX_LAST_PING_DIFFERENCE_MS = 40000;

const questionData = [
	{
		question: "Which of the following is an actual networking protocol we covered in class?",
		answers: ["ZDP", "UTP", "TTP", "UDP"],
		correctAnswerIndex: 3,
	},
	{
		question: "Does this class have a final?",
		answers: ["Nope!", "What? There's a final?!?", "Of course there is.", "Every class should have a final project and exam."],
		correctAnswerIndex: 0,
	},
	{
		question: "What port is your client's websocket currently connected to this server with?",
		answers: ["5000", "8000", "1000", "Who knows?"],
		correctAnswerIndex: 3,
	},
	{
		question: "Solve for x:  2x + 1 = 5",
		answers: ["0", "1", "2", "5"],
		correctAnswerIndex: 2,
	},
	{
		question: "What does a client use to connect to a server?",
		answers: ["🦄Unicorns and 🌈Rainbows", "The SGA Budget", "Final Exams", "Sockets"],
		correctAnswerIndex: 3,
	},
	{
		question: "What service did we create in Lab 3?",
		answers: ["Server", "Proxy", "Dice Game", "Metaltooth"],
		correctAnswerIndex: 1,
	},
	{
		question: "What toy were you told to describe your code to in order to help debug?",
		answers: ["Fox", "Aaron Wilkin", "Duck", "Cat"],
		correctAnswerIndex: 2,
	},
	{
		question: "Which of the following is true about AVL Trees?",
		answers: ["It has Red and Black Nodes", "It has a worst search time of O(n)", "It is self balancing", "Its root node can never change"],
		correctAnswerIndex: 2,
	},
	{
		question: "What did we create in Lab 1?",
		answers: ["Client and Echo Server", "Client and Server sending/requesting files to/from each other", "A Website", "Java Game"],
		correctAnswerIndex: 0,
	},
	{
		question: "What programming language did Aaron Wilkin encourage us to use for incentive points on labs?",
		answers: ["Pyhton", "Java", "C#", "C"],
		correctAnswerIndex: 3,
	},
	{
		question: "What is the name of the Rose-Hulman Library?",
		answers: ["Luis", "Larry", "Logan", "Lame"],
		correctAnswerIndex: 2,
	},
	{
		question: "In the song 'Fireflies' by Owl City, it says 'You would not believe your eyes, if ____ fireflies, lit up the world as I fell asleep... How many fireflies were there?",
		answers: ["1 million", "10 million", "100 million", "10 thousand"],
		correctAnswerIndex: 1,
	},
	{
		question: "What is the United States national bird?",
		answers: ["Eagle", "Crow", "Apple", "Cardinal"],
		correctAnswerIndex: 0,
	},
	{
		question: "What does the back of Aaron Wilkin's \"I get to teach\" shirt say?",
		answers: ["I get to grade", "I'm paid to grade", "I'm paid to teach", "I love to grade"],
		correctAnswerIndex: 1,
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
		return questionData[this.question_index];
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
			playerNames.push({
				name: userObj.name,
				color: userObj.color,
			});
		});
		return playerNames;
	}

	getPlayerScores() {
		const playerScores = [];
		this.players.forEach((userObj) => {
			playerScores.push({
				name: userObj.name,
				color: userObj.color,
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
		this.wipeRoundData();
		this.question_index++;
		console.log("Is now index", this.question_index);
	}

	wipeRoundData() {
		this.whoAnswered = [];
	}

	restart() {
		this.question_index = 0;
		this.wipeRoundData();
		this.players.forEach((userObj) => {
			userObj.score = 0;
			userObj.lastWasCorrect = false;
		});
	}

	killInactiveUsers() {
		const now = Date.now();
		const killed = [];
		this.players.forEach((userObj) => {
			const userLastHeartbeat = userObj.lastHeartbeat;
			if (now - userLastHeartbeat > INACTIVE_USER_MAX_LAST_PING_DIFFERENCE_MS) {
				killed.push(userObj);
			}
		});
		// needs to happen in new loop so this.players isn't modified during run
		killed.forEach((userObj) => {
			releaseClient(userObj.uuid, userObj.socket);
		});
		if (killed.length > 0) {
			console.log("Killed %s users in room %s", killed.length, this.room_key);
			sendPlayersListToAll();
		}
	}
};

User = class {
	constructor(socket) {
		this.uuid = uuidv4();
		this.socket = socket;
		this.name = generateName({words: 2, alliterative: true}).spaced;
		this.score = 0;
		this.color = randomColorGoldenRatio(0.8, 0.75).hexString();
		this.lastWasCorrect = false;
		this.lastHeartbeat = Date.now();
	}

	updateLastHeartbeat() {
		this.lastHeartbeat = Date.now();
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
	res.json({webSocketServerPort: ws_port});
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

app.get("/info/cheater", (req, res) => {
	res.json({questions: questionData});
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

	const newClient = addNewClient(ws);
	sendJson(ws, "your_id", {
		uuid: newClient.uuid,
		name: newClient.name,
		color: newClient.color,
	});

	sendPlayersListToAll();

	ws.on('message', function incoming(messageRaw) {
		let message;
		try {
			try {
				message = JSON.parse(messageRaw);
				if (message.Purpose !== "heartbeat") {
					console.log("🔌 Got message:", message.Purpose, message.Data);
				}
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
				console.log("Got scores");
				sendJsonToAllUsers("scores_screen_data", {
					isFinalScores: isFinalScores,
					correctAnswer: senderRoom.getCorrectAnswer(),
					scoreData: scoreData,
				});
				console.log("Next round fired");
				senderRoom.nextRound();
				break;
			case "heartbeat":
				// TODO kill clients that haven't had heartbeat
				if (senderUser) {
					// console.log("Heartbeat from", senderUser.name);
					senderUser.updateLastHeartbeat();
				} else {
					console.warn("Heartbeat from unknown user!", message.Data);
				}
				break;
			case "reconnect_me":
				const uuidOfReplacement = message.UUID;
				const uuidOfOldUser = message.Data;
				console.log("Client %s is trying to restore to old UUID %s", uuidOfReplacement, uuidOfOldUser);
				const correspondingUser = uuid_to_user[uuidOfOldUser];
				if (correspondingUser) {
					releaseClient(correspondingUser.uuid, correspondingUser.socket);
					console.log("Allowed client to reconnect");

					correspondingUser.socket = ws;
					ws_to_uuids[ws] = correspondingUser.uuid;
					correspondingUser.updateLastHeartbeat();
					sendJson(ws, "reconnect_me_confirm", {
						uuid: uuidOfOldUser,
						name: correspondingUser.name,
						color: correspondingUser.color,
					});
					sendPlayersListToAll();
				} else {
					const replacementUser = uuid_to_user[uuidOfReplacement];
					console.log("Refused client reconnect (uuid not on record)");
					sendJson(ws, "reconnect_me_deny", {
						uuid: uuidOfReplacement,
						name: replacementUser.name,
						color: replacementUser.color,
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
		const associatedPlayerName = (associatedPlayer) ? associatedPlayer.name : "NULL_PLAYER";
		console.log("Player %s lost connection?", associatedPlayerName);
		// const uuid = "<TODO better close message>";
		console.log("❌ Connection to TODO FIX'%s' closed with status %s", associatedPlayerName, params);
		// releaseClient(uuid, this);
	});
});

const addNewClient = (ws) => {
	const freshUser = new User(ws);
	const uuid = freshUser.uuid;

	ws_to_uuids[ws] = uuid;
	uuid_to_user[uuid] = freshUser;
	user_to_room[freshUser] = rooms.DEFAULT_ROOM;
	rooms.DEFAULT_ROOM.players.push(freshUser);

	return freshUser;
};

const releaseClient = (uuid, ws) => {
	// Further closing logic?
	const clientIndex = rooms.DEFAULT_ROOM.players.indexOf(uuid_to_user[uuid]);
	delete ws_to_uuids[ws];
	delete uuid_to_user[uuid];
	rooms.DEFAULT_ROOM.players.splice(clientIndex, 1);
};

const sendJson = (ws, purpose, data) => {
	const messageStr = JSON.stringify({"Purpose": purpose, "Data": data, "UUID": "SERVER"});
	ws.send(messageStr);
};

const sendPlayersListToAll = () => {
	sendJsonToAllUsers("players_list", {
		players: rooms.DEFAULT_ROOM.getAllPlayerNames(),
	});
};

const sendJsonToAllUsers = (purpose, data) => {
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
setInterval(rooms.DEFAULT_ROOM.killInactiveUsers.bind(rooms.DEFAULT_ROOM), KILL_INACTIVE_USERS_INTERVAL_MS);
