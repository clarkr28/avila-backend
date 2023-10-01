import WebSocket from 'ws';
import { IAssignIdResponse, ICreateRoomResponse, IJoinRoomHostResponse, IJoinRoomPlayerResponse, IStartGameResponse, MessagesFromClient, MessagesFromServer } from './messages';

const wss = new WebSocket.Server({ port: 8080 });

let nextClientId = 1;
let nextRoomId = 1;

const idToRoom: Map<string, string> = new Map<string, string>();
// the below line isn't enough because I'll also need
// a reference to the web socket for that client ID...make the 
// map an array of objects that have both?
interface IPlayer {
    playerId: string,
    socket: WebSocket,
}
const roomToPlayers: Map<string, IPlayer[]> = new Map<string, IPlayer[]>();

wss.on('connection', (ws: WebSocket) => {

    const playerId = `${nextClientId++}`;
    console.log(`New client connected. You are ID: ${playerId}`);
    const assignIdMsg: IAssignIdResponse = {
        type: "AssignIdMessage",
        playerId: playerId,
    }
    ws.send(JSON.stringify(assignIdMsg));

    ws.on('message', (message: string) => {
        console.log(`Received message: ${message}`);
        try {
            // will throw an error if message isn't valid json 
            const receivedMsg = JSON.parse(message) as MessagesFromClient;

            switch (receivedMsg.type) {
                case "CreateRoomRequest":
                    const roomId = `${nextRoomId++}`;
                    idToRoom.set(receivedMsg.playerId, roomId);
                    roomToPlayers.set(roomId, [{
                        playerId: receivedMsg.playerId, 
                        socket: ws
                    }]);
                    const response: ICreateRoomResponse = {
                        type: "CreateRoomResponse",
                        room: roomId,
                    };
                    ws.send(JSON.stringify(response));
                    break;
                case "JoinRoomRequest":
                    const roomToJoin = receivedMsg.roomId
                    const playersInRoom = roomToPlayers.get(roomToJoin);
                    if (playersInRoom?.length) {
                        // send the new player to the room creator
                        const newPlayerMsgToHost: IJoinRoomHostResponse = {
                            type: "JoinRoomHostResponse",
                            name: receivedMsg.name,
                        };
                        playersInRoom[0].socket.send(JSON.stringify(newPlayerMsgToHost));
                        playersInRoom.push({
                            playerId: receivedMsg.playerId,
                            socket: ws
                        });
                        idToRoom.set(receivedMsg.playerId, receivedMsg.roomId);
                        // send a message to the player that joined the room
                        const newPlayerMsgToPlayer: IJoinRoomPlayerResponse = {
                            type: "JoinRoomPlayerResponse",
                            index: playersInRoom.length - 1,
                        };
                        ws.send(JSON.stringify(newPlayerMsgToPlayer));
                    }
                    break;
                case "StartGameRequest":
                    // forward the message to all other players if the request was valid
                    const players = getPlayersFromId(receivedMsg.playerId);
                    if (!players || players.length === 0 || players[0].playerId !== receivedMsg.playerId) {
                        // the last check makes sure the player requesting to start the
                        // game is the room's host
                        return;
                    }
                    const msg: IStartGameResponse = {
                        type: "StartGameResponse",
                        data: receivedMsg.data,
                    };
                    const msgStr: string = JSON.stringify(msg);
                    players.forEach((player: IPlayer, index: number) => {
                        if (index === 0) { return; }
                        player.socket.send(msgStr);
                    })
                    break;
                case "PlacedTileRequest":
                    handleTurnMessage(
                        getPlayersFromId(receivedMsg.playerId), 
                        receivedMsg.playerId,
                        { type: "PlacedTileResponse", data: receivedMsg.data}
                    );
                    break;
                case "EndTurnRequest":
                    handleTurnMessage(
                        getPlayersFromId(receivedMsg.playerId), 
                        receivedMsg.playerId,
                        { type: "EndTurnResponse", data: receivedMsg.data}
                    );
                    break;
            }

        }
        catch (e) {
            console.log(e);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

/**
 * find all players in a room for a player ID
 * @param playerId the player to search for
 * @returns all players in the room or undefined if invalid
 */
function getPlayersFromId(playerId: string): IPlayer[] | undefined {
    const room = idToRoom.get(playerId);
    return room ? roomToPlayers.get(room) : undefined;
}

function handleTurnMessage(players: IPlayer[] | undefined, playerId: string, messageToSend: MessagesFromServer) {
    players?.forEach(player => {
        if (player.playerId !== playerId) {
            player.socket.send(JSON.stringify(messageToSend));
        }
    })
}

/**
 * Creating a WebSocket Client
 */

// import WebSocket from 'ws';
// const ws = new WebSocket('ws://localhost:8080');
// ws.on('open', () => {
//   console.log('Connected to server');
//   ws.send('Hello, server!');
// });
// ws.on('message', (message: string) => {
//   console.log(`Received message from server: ${message}`);
// });
// ws.on('close', () => {
//   console.log('Disconnected from server');
// });

/**
 * Broadcasting Messages to all clients
 */

// import WebSocket from 'ws';
// const wss = new WebSocket.Server({ port: 8080 });
// wss.on('connection', (ws: WebSocket) => {
//   console.log('New client connected');
//   ws.on('message', (message: string) => {
//     console.log(`Received message: ${message}`);
//     wss.clients.forEach((client) => {
//       client.send(`Server received your message: ${message}`);
//     });
//   });
//   ws.on('close', () => {
//     console.log('Client disconnected');
//   });
// });

