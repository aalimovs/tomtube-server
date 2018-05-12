require("dotenv").config();
const Log = require('winston');
const _ = require('lodash');

// @see https://developers.google.com/youtube/v3/docs/search/list

const express = require("express");
var bodyParser = require("body-parser");
const Axios = require('axios');
const QueryString = require('querystring');

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

// dedicated youtube search endpoint
app.post("/search/:pageToken?", async function(req, res) {
    Log.info('SEARCH', `search term: '${req.body.search}'`);
    const pageToken = req.params.pageToken;

    const queryObject = {
        part: 'snippet',
        q: req.body.search,
        maxResults: 3,
        key: process.env.YOUTUBE_API_KEY,
        type: 'video',
    };

    if (pageToken) {
        queryObject.pageToken = pageToken;
    }

    const query = QueryString.stringify(queryObject);

    try {
        const response = await Axios.get(`https://www.googleapis.com/youtube/v3/search?${query}`);
        const { items, nextPageToken } = response.data;

        const results = items.map(item => {
            return {
                title: item.snippet.title,
                id: item.id.videoId,
                author: item.snippet.channelTitle,
            };
        });

        return res.send({
            data: results,
            meta: {
                nextPageToken,
            },
        });

    } catch (err) {
        console.log('err', err);
        return res.send({
            
        });
    }
});

/**
 * adds a video to the playlist
 */
app.post('/playlist/:roomCode', (req, res) => {
    console.log('adding video to playlist');
    const video = { ...req.body };
    const room = Socket.getRoom(req.params.roomCode);

    console.log('room', room);
    try {
        room.playlist.push(video);
        room.emit("playlist-updated", room.playlist);
        room.emit("new-video", {
            playlist: room.playlist,
            video,
            type: 'add',
        });
        return res.send(room.playlist);
    } catch (err) {
        res.status(400);
        return res.send('Failed to queue song');
    }
});

/**
 * add a video to the start of the playlist
 */
app.post("/playlist/next/:roomCode", function(req, res) {
    Log.info('Pushing a video to front of playlist', req.body);
    const video = { ...req.body };
    
    const room = Socket.getRoom(req.params.roomCode);

    try {
        room.playlist.unshift(video);
        room.emit("playlist-updated", room.playlist);
        room.emit("new-video", {
            playlist: room.playlist,
            video,
            type: 'add',
        });
        return res.send(room.playlist);
    } catch (err) {
        res.status(400);
        return res.send('Failed to queue song next');
    }
});

/**
 * return the whole playlist
 */
app.get("/playlist/:roomCode", function(req, res) {
    const room = Socket.getRoom(req.params.roomCode);
    if (room) {
        return res.send(room.playlist);
    }
    console.log('tried to return a playlist for an empty room');
    return res.send(null);
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
    try {
        room.playlist.shift();
        room.emit("playlist-updated", room.playlist);
        return res.send(room.playlist);
    } catch (err) {
        return res.send(null);
    }
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

app.all("/playlist/actions/skip-video/:roomCode", function(req, res) {
    console.log(`skipping video in room ${req.params.roomCode}`);

    const room = Socket.getRoom(req.params.roomCode);
    room.emit("skip-video");
    return res.send(room.playlist);
});

app.get('health', function(req, res) {
    return res.send('tyketube-health-all-ok');
});
