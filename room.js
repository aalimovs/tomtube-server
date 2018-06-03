const _ = require('lodash');
const DayJs = require('dayjs');

class Room {
    /**
     * Create a new Room
     * @param {string} ip the IP address of the host of the room
     */
    constructor(ip) {
        /** @param {Socket[]} sockets all the connected sockets in the room */
        this.sockets = [];

        /** @param {string} code the room code for this room */
        this.code = [];

        /** @param {Object[]} playlist array of video objects */
        this.playlist = [];

        /** @param {string} ip the ip address of the host of this room */
        this.ip = null;

        /** @param {string} created_at when the room was created */
        this.created_at = DayJs().format('YYYY-MM-DD HH:mm:ss');

        if (ip) {
            this.ip = ip;
        }

        this.code = generateCode();
    }

    /**
     * adds a socket to a room and emits a "welcome" message to the socket
     * @param {Socket} socket the socket to be added to the room
     */
    addSocket(socket) {
        this.sockets.push(socket);
        socket.emit('welcome', {
            roomCode: this.code,
        });
    }

    addVideoToEndOfPlaylist(video) {
        this.playlist.push(video);
    }

    addVideoToStartOfPlaylist(video) {
        this.playlist.unshift(video);
    }

    removeVideoFromStartOfPlaylist() {
        this.playlist.shift();
    }

    emit (key, data) {
        this.sockets.forEach(socket => {
            console.log('sending to socket.id', socket.id);
            socket.emit(key, data)
        });
    }

    selfDestruct (rooms) {
        this.sockets.forEach(socket => socket.disconnect());
        _.remove(rooms, r => r.code === this.code);
    }

    removeSocket (socketUuid) {
        const removedSockets = _.remove(this.sockets, s => s.uuid === socketUuid);
        removedSockets.forEach(s => s.disconnect());
    }

    /**
     * trying to JSON a room causes a circular json loop for some mad reason, so we have a dedicated
     * output function that returns an object representation of a room
     */
    output() {
        return {
            code: this.code,
            ip: this.ip,
            created_at: this.created_at,
            playlist: this.playlist,
            sockets: this.sockets.map(s => ({
                uuid: s.uuid,
                ip: s.handshake.address
            })),
        };
    }
}

const generateCode = () => {
    const possibleChars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789';

    const chars = [];

    for (let i = 0; i < 4; i++) {
        chars.push(possibleChars[_.random(possibleChars.length - 1)]);
    }

    return chars.join('').toUpperCase();
};

module.exports = Room;