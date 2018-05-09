const _ = require('lodash');
const Uuid = require('uuid/v4');

module.exports = (args) => {
    var app = require('express')();
    var server = require('http').Server(app);
    var io = require('socket.io')(server);

    const rooms = [];

    server.listen(4001);

    io.on('connection', function (socket) {
        console.log('SOCKET - new connection');
        socket._data = {
            type: socket.handshake.query.type,
            room_code: socket.handshake.query.room_code,
            uuid: Uuid(), 
        };

        console.log('socket._data', socket._data);
        if (socket.handshake.headers.referer.includes('player')) {
            console.log('SOCKET - new connection is a player');
            if (socket._data.room_code && rooms.length >= 1) { // only add them to a room if they have a room code AND there are rooms
                console.log('SOCKET - player WITH room code - adding to room');
                const room = findRoomForCode(socket._data.room_code, rooms);
                room.sockets.push(socket);
            } else {
                console.log('SOCKET - player, no room code - creating room');
                const room = createNewRoom();
                socket._data.room_code = room.code;
                console.log(`SOCKET - generated room with code ${room.code}`);
                room.sockets.push(socket);
                rooms.push(room);
                emitWelcome(socket, room);
            }

        } else if (socket.handshake.headers.referer.includes('user')) {
            console.log('SOCKET - new user - wants to join room:', socket._data.room_code);

            const room = findRoomForCode(socket._data.room_code, rooms);
            if (room) {
                console.log('SOCKET - user found room for code:', socket._data.room_code, '- joining room');
                room.sockets.push(socket);
            } else {
                console.log('SOCKET - user - no room found for code:', socket._data.room_code);
            }
        }

        socket.on('disconnect', () => {
            const room = findRoomForCode(socket._data.room_code, rooms);
            if (socket._data.type === 'player') {
                console.log('SOCKET - disconnected user was a player, self destructing room');
                room.selfDestruct(rooms);
                console.log('SOCKET - room self descructed, rooms left:', rooms);
            } else if (socket._data.type === 'user') {
                // user disconnected - remove it from its room
                if (room) {
                    room.removeSocket(socket._data.uuid);
                }
            }
        });
    });

    return {
        emit: (code, key, data) => {
            const room = findRoomForCode(code, rooms);
            room.emit(key, data);
        },
        getRooms: () => {
            return rooms;
        },
        getRoom: (code) => {
            return findRoomForCode(code, rooms);
        },
    };
}

const findRoomForCode = (code, rooms) => rooms.find(r => r.code === code);

const createNewRoom = () => {
    const code = generateRoomCode();
    const sockets = [];
    const playlist = [];

    return {
        code,
        sockets,
        playlist,
        emit: (key, data) => {
            sockets.forEach(socket => socket.emit(key, data));
        },
        selfDestruct: function (rooms) {
            sockets.forEach(socket => socket.disconnect());
            _.remove(rooms, r => r.code === code);
        },
        removeSocket: function (socketUuid) {
            const removedSockets = _.remove(sockets, s => s.uuid === socketUuid);
            removedSockets.forEach(s => s.disconnect());
        },
    };
};

const generateRoomCode = () => {
    const possibleChars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789';

    const chars = [];

    for (let i = 0; i < 4; i++) {
        chars.push(possibleChars[_.random(possibleChars.length)]);
    }

    return chars.join('').toUpperCase();
};

const emitWelcome = (socket, room) => {
    socket.emit('welcome', {
        room_code: room.code,
    });
};