# Protocol

Format for explanation here is `message.Protocol`: Data purpose : Protocol purpose
All messages should have the following fields:

- Purpose string
- Data any type
- UUID of client, or SERVER for server, or UNSET for fresh clients

## Server -> Client

On connect: send client their UUID via `your_uuid`

Possible messages from server:

- `your_uuid`: UUID string : Gen a new UUID and send it to user
- `question_info`: answers string array, question text string : Get current quiz question
- `roomkey`: current room key string : tell the client what roomkeys there are
- `reconnect_me_confirm` : UUID string to use : reconnection was accepted, keep using your old UUID (in this message)
- `reconnect_me_deny` : UUID string to use : reconnection was denied, use your new UUID (in this message)

## Client -> Server

On connect: Await server's `your_uuid` message and set that as it's UUID.
If this was a reconnect attempt, send a `reconnect_me`.

Possible messages from client:

- `roomkey_new`: Roomkey string : Server should generate a new room key
- `question_details`: answers string array, question text string : Send current question details
- `reconnect_me`: Client's previous UUID : Server should delete UUID of message that came along and treat client as previous UUID instead
- TODO `start_game` : Roomkey string : Signal that the server should begin the game
