const _ = require('lodash');
const Uuid = require('uuid/v4');
const Room = require('./room');

module.exports = (args) => {
    var app = require('express')();
    var server = require('http').Server(app);
    var io = require('socket.io')(server);

    const rooms = [];

    server.listen(4001);

    console.log('SOCKET - Listening on port 4001');

    io.on('connection', function (socket) {
        socket.uuid = Uuid();
        if (socket.handshake.query.type === 'player') {
            const room = new Room(socket.handshake.address);
            socket.roomCode = room.code;
            room.addSocket(socket);
            rooms.push(room);
        } else if (socket.handshake.query.type === 'user') {
            const room = findRoomForCode(socket.handshake.query.roomCode, rooms);
            if (room) {
                room.addSocket(socket);
            }
        }

        console.log('rooms', rooms);

        socket.on('disconnect', () => {
            const room = findRoomForCode(socket.roomCode, rooms);
            if (socket.handshake.query.type === 'player') {
                room.emit('host-leave');
                room.selfDestruct(rooms);
            } else if (socket.handshake.query.type === 'user') {
                if (room) {
                    room.removeSocket(socket._data.uuid);
                }
            }
        });
    });

    return {
        getRoom: (code) => {
            const room = rooms.find(r => r.code === code);
            return room;
        },

        getRooms: () => {
            return rooms;
        },
    };
}

const findRoomForCode = (code, rooms) => rooms.find(r => r.code === code);