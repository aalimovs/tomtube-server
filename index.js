require("dotenv").config();
const Log = require('winston');
const _ = require('lodash');
const Moment = require('moment');
const MomentDurationFormatSetup = require("moment-duration-format");

// @see https://developers.google.com/youtube/v3/docs/search/list

const express = require("express");
var bodyParser = require("body-parser");
const Axios = require('axios');
const QueryString = require('querystring');

const app = express();
app.disable('etag');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

const serverPort = 4000;

app.listen(serverPort, () =>
    console.log(`Example app listening on serverPort ${serverPort}`)
);

app.use(function (req, res, next) {
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

/**
 * adds a video to the playlist
 * @param {Object} req the Express request
 * @param {Object} res the Express response
 * @param {[string]} req.params.pageToken if given, the youtube page token to paginate results by
 */
app.post("/search/:pageToken?", async function (req, res) {
    if (!req.body.search) {
        return res.status(400).send({
            message: "You must provide a search term",
            error: "Missing payload: 'search'",
        });
    }

    Log.info('SEARCH', `search term: '${req.body.search}'`);
    const pageToken = req.params.pageToken;

    const searchQueryObject = {
        part: 'snippet',
        q: req.body.search,
        maxResults: 10,
        key: process.env.YOUTUBE_API_KEY,
        type: 'video',
    };

    if (pageToken) { // if we have a `pageToken`, paginate the results using it
        searchQueryObject.pageToken = pageToken;
    }

    const query = QueryString.stringify(searchQueryObject);

    try {
        const searchResponse = await Axios.get(`https://www.googleapis.com/youtube/v3/search?${query}`);
        const { items, nextPageToken } = searchResponse.data;
        const videoIds = items.map(item => item.id.videoId);

        const videosQueryObject = QueryString.stringify({
            part: 'contentDetails',
            id: items.map(item => item.id.videoId).join(','),
            key: process.env.YOUTUBE_API_KEY,
        });

        const videosResponse = await Axios.get(`https://www.googleapis.com/youtube/v3/videos?${videosQueryObject}`);

        const results = items.map(item => {
            const duration = videosResponse.data.items.find(i => {
                return i.id.trim() === item.id.videoId.trim();
            }).contentDetails.duration;
            return {
                title: item.snippet.title,
                id: item.id.videoId,
                author: item.snippet.channelTitle,
                duration: Moment.duration(duration).format('mm:ss'),
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
 * @param {Object} req the Express request
 * @param {Object} res the Express response
 * @param {string} req.params.roomCode the room code of the room to add the video to the playlist of
 * @param {string} req.body.id the youtube id of the video
 * @param {string} req.body.title the youtube title of the video
 * @param {string} req.body.author the tyketube author of the video
 */
app.post('/playlist/:roomCode', (req, res) => {
    console.log('adding video to playlist');
    const video = { ...req.body };
    const room = Socket.getRoom(req.params.roomCode);

    try {
        console.log('room', room);
        room.addVideoToEndOfPlaylist(video);
        room.emit("playlist-updated", room.playlist);
        room.emit("new-video", {
            playlist: room.playlist,
            video,
            type: 'add',
        });
        return res.send(room.playlist);
    } catch (err) {
        console.log('err', err);
        res.status(400);
        return res.send('Failed to queue song');
    }
});

/**
 * add a video to the start of the playlist
 * @param {Object} req the Express request
 * @param {Object} res the Express response
 * @param {string} req.params.roomCode the room code of the room to add the video to the playlist of
 * @param {string} req.body.id the youtube id of the video
 * @param {string} req.body.title the youtube title of the video
 * @param {string} req.body.author the tyketube author of the video
 */
app.post("/playlist/next/:roomCode", function (req, res) {
    Log.info('Pushing a video to front of playlist', req.body);
    const video = { ...req.body };

    const room = Socket.getRoom(req.params.roomCode);

    try {
        room.addVideoToStartOfPlaylist(video);
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
 * @param {Object} req the Express request
 * @param {Object} res the Express response
 * @param {string} req.params.roomCode the room code of the room to return the playlist of
 */
app.get("/playlist/:roomCode", function (req, res) {
    const room = Socket.getRoom(req.params.roomCode);
    if (room) {
        return res.send(room.playlist);
    }
    console.log('tried to return a playlist for an empty room');
    return res.send(null);
});

app.get('/rooms-on-my-ip', function (req, res) {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const matchingRooms = Socket.getRooms().filter(r => r.ip === ip);

    console.log('matchingRooms', matchingRooms);

    return res.send(matchingRooms.map(r => r.output()));
});

/**
 * return all the rooms from the socket instance
 * @param {Object} req the Express request
 * @param {Object} res the Express response
 */
app.get("/rooms", function (req, res) {
    const rooms = Socket.getRooms();

    return res.send(rooms.map(r => r.output()));
});

app.get("/rooms/:roomCode", function(req, res) {
    const room = Socket.getRoom(req.params.roomCode);

    if (room) {
        console.log('room found returning 200');
        return res.status(200).send(room.output());
    } else {
        console.log('room not found returning 500');
        return res.status(404).send('no room');
    }
});

/**
 * delete the "next" video from a playlist for a given room
 * @param {Object} req the Express request
 * @param {Object} res the Express response
 * @param {string} req.params.roomCode
 */
app.delete("/playlist/:roomCode", function (req, res) {
    const room = Socket.getRoom(req.params.roomCode);
    try {
        room.removeVideoFromStartOfPlaylist();
        room.emit("playlist-updated", room.playlist);
        return res.send(room.playlist);
    } catch (err) {
        return res.send(null);
    }
});

/**
 * delete a specific video from a room via the video ID
 * @param {Object} req the Express request
 * @param {Object} res the Express response
 * @param {string} req.params.roomCode
 * @param {string} req.params.videoId the video id to delete from the playlist
 */
app.delete("/playlist/:roomCode/:videoId", function (req, res) {
    const { roomCode, videoId } = req.params;
    const room = Socket.getRoom(roomCode);
    const removedVideo = _.remove(room.playlist, v => v.id === videoId);
    room.emit("playlist-updated", room.playlist);
    return res.send(room.playlist);
});

/**
 * force a given room to skip its current video
 * @param {Object} req the Express request
 * @param {Object} res the Express response
 * @param {string} req.params.roomCode
 */
app.all("/playlist/actions/skip-video/:roomCode", function (req, res) {
    console.log(`skipping video in room ${req.params.roomCode}`);

    const room = Socket.getRoom(req.params.roomCode);
    room.emit("skip-video");
    return res.send(room.playlist);
});

/**
 * force a given room to start playing its video
 */
app.post('/playlist/actions/play-video/:roomCode', function (req, res) {
    const room = Socket.getRoom(req.params.roomCode);
    room.setCurrentVideoTitle(req.body.title);
    room.emit("command-play", room.playlist);
    return res.send(room.playlist);
});

/**
 * force a given room to pause its current video
 */
app.post('/playlist/actions/pause-video/:roomCode', function (req, res) {
    const room = Socket.getRoom(req.params.roomCode);
    room.emit("command-pause", room.playlist);
    return res.send(room.playlist);
});

/**
 * emit to a room the "playing-video" event
 */
app.post('/playing-video/:roomCode', function (req, res) {
    const room = Socket.getRoom(req.params.roomCode);
    room.emit("playing-video", room.playlist);
    return res.send(room.playlist);
});

/**
 * 
 */
app.post('/playlist/actions/re-order/:roomCode/:newPosition', function (req, res) {
    const { roomCode, newPosition } = req.params;
    const room = Socket.getRoom(roomCode);
    const playlist = room.playlist;


    room.emit("playing-video", room.playlist);
    return res.send(room.playlist);
});

app.get('/ip', function (req, res) {
    return res.status(200).send({
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    });
});

/**
 * return something from the API as a health point
 */
app.get('/health', function (req, res) {
    return res.status(200).send('tyketube-health-all-ok');
});

