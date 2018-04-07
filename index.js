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

const Socket = require("./socket")();

const playlist = [];

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
 * replacing the entire playlist with a new playlist
 */
app.put('/playlist', function(req, res) {

});

/**
 * add a video to the playlist
 */
app.post("/playlist", function(req, res) {
    Log.info('Adding a video to playlist', req.body);
    playlist.push({
        ...req.body
    });
    Socket.emit("playlist-updated", playlist);
    Socket.emit("new-video", playlist);
    return res.send(playlist);
});

/**
 * add a video to the start of the playlist
 */
app.post("/playlist/next", function(req, res) {
    Log.info('Pushing a video to front of playlist', req.body);
    playlist.unshift({
        ...req.body
    });
    Socket.emit("playlist-updated", playlist);
    Socket.emit("new-video", playlist);
    return res.send(playlist);
});

/**
 * return the whole playlist
 */
app.get("/playlist", function(req, res) {
    return res.send(playlist);
});

/**
 * delete the "next" video
 */
app.delete("/playlist", function(req, res) {
    const deletedVideo = playlist.shift();
    Log.info('Deleting the "next" video from the playlist', deletedVideo);
    Socket.emit("playlist-updated", playlist);
    return res.send(playlist);
});

/**
 * delete a specific video from the playlist via id
 */
app.delete("/playlist/:id", function(req, res) {
    const removedVideo = _.remove(playlist, video => {
        return video.id === req.params.id;
    });
    Socket.emit("playlist-updated", playlist);
    return res.send(playlist);
});

app.all("/playlist/actions/skip-video", function(req, res) {
    Socket.emit("skip-video");
    return res.send();
});

app.get('health', function(req, res) {
    res.send('tyketube-health-all-ok');
});
