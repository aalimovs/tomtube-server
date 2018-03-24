const Socket = require('./socket')();

const express = require('express');
const YoutubeSearch = require('youtube-api-v3-search');
var bodyParser = require('body-parser');

const app = express();

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

const serverPort = 4000;
const apiKey = 'naughties';

app.listen(serverPort, () => console.log(`Example app listening on serverPort ${serverPort}`));

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
 
const videos = [];

app.post('/search', function(req, res) {
    YoutubeSearch(apiKey, {
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

app.post('/videos', function(req, res) {
    videos.unshift({
        ... req.body
    });

    Socket.emit('new-video', { ...req.body });
});

app.get('/videos', function(req, res) {
    res.send(videos);
});
