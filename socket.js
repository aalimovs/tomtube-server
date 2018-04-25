const _ = require('lodash');

module.exports = (args) => {
    var app = require('express')();
    var server = require('http').Server(app);
    var io = require('socket.io')(server);
    
    const rooms = [];

    server.listen(4001);

    io.use(function(socket, next){
        console.log("Query: ", socket.handshake.query);
        // return the result of next() to accept the connection.
        return next();
        // call next() with an Error if you need to reject the connection.
        // next(new Error('Authentication error'));
    });

    io.on('connection', function (socket) {
        console.log('SOCKET - new connection');
        
        console.log('***************', socket.handshake.headers);

        const socketData = prepareSocket(socket);

        console.log('SOCKET - socketData', socketData);
        console.log('socketData.type', socketData.type);
        if (socketData.type === 'player') {
            console.log('SOCKET - new player - creating room');
            const room = createNewRoom();
            console.log(`SOCKET - generated room with code ${room.code}`);
            room.sockets.push(socket);
            rooms.push(room);
            console.log('SOCKET - total rooms', rooms);
            emitWelcome(socket, room);
        } else if (socketData.type === 'user') {
            console.log('SOCKET - new user - wants to join room:', socketData.room_code);
            
            const room = findRoomForCode(socketData.room_code);
            if (room) {
                console.log('SOCKET - user found room for code:', socketData.room_code, '- joining room');
                room.sockets.push(socket);
            } else {
                console.log('SOCKET - user - no room found for code:', socketData.room_code);
            }
        }
    });

    return {
        emit: (code, key, data) => {
            const room = findRoomForCode(code);
            room.emit(key, data);
        },
    };
}

const findRoomForCode = code => rooms.find(r => r.code === code);

const createNewRoom = () => {
    const sockets = [];
    return {
        code: generateRoomCode(),
        sockets,
        emit: (key, data) => {
            sockets.forEach(socket => socket.emit(key, data));
        },
    };
};

const prepareSocket = socket => {
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });

    return socket.handshake.query;
};

const generateRoomCode = () => {
    const possibleChars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789';

    const chars = [];

    for(let i = 0; i < 4; i++) {
        chars.push(possibleChars[_.random(possibleChars.length)]);
    }

    return chars.join('').toUpperCase();
};

const emitWelcome = (socket, room) => {
    socket.emit('welcome', {
        room_code: room.code,
    });
};