module.exports = (args) => {
    var app = require('express')();
    var server = require('http').Server(app);
    var io = require('socket.io')(server);
    
    server.listen(4001);

    const userConnections = [];

    io.on('connection', function (socket) {
        userConnections.push(socket);
    });

    return {
        emit: (key, data) => {
            io.emit(key, data);
        },
    };
}
