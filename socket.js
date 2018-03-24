module.exports = (args) => {
    var app = require('express')();
    var server = require('http').Server(app);
    var io = require('socket.io')(server);
    
    server.listen(4001);

    io.on('connection', function (socket) {
        console.log('connected');
    });

    return {
        emit: (key, data) => {
            io.emit(key, data);
        },
    };
}
