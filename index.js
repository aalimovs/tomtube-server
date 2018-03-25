require('dotenv').config()

const express = require('express');
const YoutubeSearch = require('youtube-api-v3-search');
var bodyParser = require('body-parser');

const app = express();

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

const serverPort = 4000;

app.listen(serverPort, () => console.log(`Example app listening on serverPort ${serverPort}`));

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH');
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
 
const Socket = require('./socket')();

const playlist = [];

app.post('/search', function(req, res) {
    YoutubeSearch(process.env.YOUTUBE_API_KEY, {
        maxResults: 10,
        q: req.body.search,
        type:'video'
    })
        .then((results) => {
            return results.items.map(result => {
                return {
                    id: result.id.videoId,
                    title: result.snippet.title,
                    author: result.snippet.channelTitle,
                };
            });
        })
        .then(videos => {
            res.send(videos);
        });
});

app.post('/playlist', function(req, res) {
    playlist.push({
        ... req.body
    });
    Socket.emit('playlist-updated', playlist);
    Socket.emit('new-video', playlist);
    return res.send(playlist);
});

app.get('/playlist', function(req, res) {
    return res.send(playlist);
});

app.delete('/playlist', function(req, res) {
    console.log('popping video from playlist');
    playlist.shift();
    Socket.emit('playlist-updated', playlist);
    return res.send(playlist);
});
