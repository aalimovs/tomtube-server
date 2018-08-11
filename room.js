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
        /*
        each video consists of
        id: video.id,
        title: video.title,
        author: this.identity,
        */
        this.playlist = [];

        /**
         * @param {string} playState the current state of whether the video is playing or not
         * stopped - the default state, or playback has ended
         * playing - the video is currently playing
         * paused - the video is currently paused
         */
        this.playState = 'stopped';
        /** @param {string} ip the ip address of the host of this room */
        this.ip = null;

        /** @param {string} createdAt when the room was created */
        this.createdAt = DayJs().format('YYYY-MM-DD HH:mm:ss');

        /** @param {string} currentVideoTitle the title of the video that is currently playing in this room */
        this.currentVideoTitle = '';

        /** @param {string} volume the volume of the room */
        this.volume = 0;

        this.ip = ip || null;
        
        this.code = generateCode();

        this.volume = 100;
    }

    /**
     * adds a socket to a room and emits a "welcome" message to the socket
     * @param {Socket} socket the socket to be added to the room
     */
    addSocket(socket) {
        this.sockets.push(socket);
        socket.emit('welcome', {
            roomCode: this.code,
            volume: this.volume,

        });
    }

    setCurrentVideoTitle(title) {
        this.currentVideoTitle = title;
        return this;
    }

    addVideoToEndOfPlaylist(video) {
        this.playlist.push(video);
        return this;
    }

    addVideoToStartOfPlaylist(video) {
        this.playlist.unshift(video);
        return this;
    }

    removeVideoFromStartOfPlaylist() {
        this.playlist.shift();
        return this;
    }

    emit(key, data) {
        this.sockets.forEach(socket => {
            console.log('sending to socket.id', socket.id);
            socket.emit(key, data);
        });
    }

    selfDestruct(rooms) {
        this.sockets.forEach(socket => socket.disconnect());
        _.remove(rooms, r => r.code === this.code);
    }

    removeSocket(socketUuid) {
        const removedSockets = _.remove(this.sockets, s => s.uuid === socketUuid);
        removedSockets.forEach(s => s.disconnect());
    }

    setVolume(volume) {
        this.volume = volume;
        return this;
    }

    /**
     * trying to JSON a room causes a circular json loop for some mad reason, so we have a dedicated
     * output function that returns an object representation of a room
     */
    output() {
        return {
            code: this.code,
            ip: this.ip,
            createdAt: this.createdAt,
            currentVideoTitle: this.currentVideoTitle,
            playlist: this.playlist,
            sockets: this.sockets.map(s => ({
                uuid: s.uuid,
                ip: s.handshake.address,
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
