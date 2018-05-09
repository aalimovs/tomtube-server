require("dotenv").config();
const Log = require('winston');
const _ = require('lodash');

const express = require("express");
const YoutubeSearch = require("youtube-api-v3-search");
var bodyParser = require("body-parser");

const app = express();

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

const serverPort = 4000;

app.listen(serverPort, () =>
    console.log(`Example app listening on serverPort ${serverPort}`)
);

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,PATCH");
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
});

/**
 * spin up our Socket server
 */
const Socket = require("./socket")();

// const playlist = [];

// dedicated youtube search endpoint
app.post("/search", function(req, res) {
    Log.info('SEARCH', `search term: '${req.body.search}'`);
    YoutubeSearch(process.env.YOUTUBE_API_KEY, {
        maxResults: 10,
        q: req.body.search,
        type: "video"
    })
        .then(results => {
            return results.items.map(result => {
                return {
                    id: result.id.videoId,
                    title: result.snippet.title,
                    author: result.snippet.channelTitle
                };
            });
        })
        .then(videos => {
            res.send(videos);
        });
});

/**
 * adds a video to the playlist
 */
app.post('/playlist/:roomCode', (req, res) => {
    console.log('adding video to playlist');

    const video = { ...req.body };

    const room = Socket.getRoom(req.params.roomCode);
    room.playlist.push(video);
    room.emit("playlist-updated", room.playlist);
    room.emit("new-video", {
        playlist: room.playlist,
        video,
        type: 'add',
    });
    return res.send(room.playlist);
});

/**
 * add a video to the start of the playlist
 */
app.post("/playlist/next/:roomCode", function(req, res) {
    Log.info('Pushing a video to front of playlist', req.body);
    const video = { ...req.body };
    
    const room = Socket.getRoom(req.params.roomCode);

    console.log('room', room);

    room.playlist.unshift(video);
    room.emit("playlist-updated", room.playlist);
    room.emit("new-video", {
        playlist: room.playlist,
        video,
        type: 'add',
    });
    return res.send(room.playlist);
});

/**
 * return the whole playlist
 */
app.get("/playlist/:roomCode", function(req, res) {
    const room = Socket.getRoom(req.params.roomCode);
    return res.send(room.playlist);
});

app.get("/rooms", function(req, res) {
    return Socket.getRooms();
});

app.get("/rooms/:id", function(req, res) {
    return Socket.getRoom(req.params.id);
});

/**
 * delete the "next" video
 */
app.delete("/playlist/:roomCode", function(req, res) {
    const room = Socket.getRoom(req.params.roomCode);
    room.playlist.shift();
    room.emit("playlist-updated", room.playlist);
    return res.send(room.playlist);
});

/**
 * delete a specific video from the playlist via id
 */
app.delete("/playlist/:roomCode/:id", function(req, res) {
    const room = Socket.getRoom(req.params.roomCode);
    const removedVideo = _.remove(room.playlist, v => v.id === req.params.id);
    room.emit("playlist-updated", room.playlist);
    return res.send(room.playlist);
});

app.all("/playlist/actions/skip-video", function(req, res) {
    Socket.emit("skip-video");
    return res.send();
});

app.get('health', function(req, res) {
    res.send('tyketube-health-all-ok');
});
