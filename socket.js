const _ = require('lodash');
const Uuid = require('uuid/v4');

module.exports = (args) => {
    var app = require('express')();
    var server = require('http').Server(app);
    var io = require('socket.io')(server);

    const rooms = [];

    server.listen(4001);

    console.log('SOCKET - Listening on port 4001');

    io.on('connection', function (socket) {
        socket._data = {
            type: socket.handshake.query.type,
            uuid: Uuid(),
        };

        if (socket.handshake.headers.referer.includes('player')) {
            const room = createNewRoom();
            socket._data.room_code = room.code;
            room.sockets.push(socket);
            rooms.push(room);
            emitWelcome(socket, room);
        } else if (socket.handshake.headers.referer.includes('user')) {
            const room = findRoomForCode(socket._data.room_code, rooms);
            if (room) {
                room.sockets.push(socket);
            }
        }

        socket.on('disconnect', () => {
            const room = findRoomForCode(socket._data.room_code, rooms);
            if (socket._data.type === 'player') {
                room.selfDestruct(rooms);
            } else if (socket._data.type === 'user') {
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