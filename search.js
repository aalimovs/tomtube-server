const Log = require('winston');
const QueryString = require('querystring');
const Axios = require('axios');
const Video = require('./video');
const Playlist = require('./playlist');
const Moment = require('moment');
const MomentDurationFormatSetup = require('moment-duration-format'); // eslint-disable-line

module.exports = (app) => {
    app.post('/search/:pageToken?', async (req, res) => {
        if (!req.body.search) {
            return res.status(400).send({
                message: 'You must provide a search term',
                error: "Missing payload: 'search'",
            });
        }

        Log.info('SEARCH', `search term: '${req.body.search}'`);

        const { pageToken } = req.params;

        const searchQueryObject = {
            part: 'snippet',
            q: req.body.search,
            maxResults: 10,
            key: process.env.YOUTUBE_API_KEY,
            type: 'video,playlist',
        };

        if (pageToken) { // if we have a `pageToken`, paginate the results using it
            searchQueryObject.pageToken = pageToken;
        }

        const query = QueryString.stringify(searchQueryObject);

        try {
            const searchResponse = await Axios.get(`https://www.googleapis.com/youtube/v3/search?${query}`);
            const { items, nextPageToken } = searchResponse.data;
            
            let results = items.map((item) => {
                switch (item.id.kind) {
                    case 'youtube#video':
                        return new Video({
                            id: item.id.videoId,
                            title: item.snippet.title,
                            author: item.snippet.channelTitle,
                        });
                    case 'youtube#playlist':
                        return new Playlist({
                            id: item.id.playlistId,
                            title: item.snippet.title,
                            author: item.snippet.channelTitle,
                            thumbnail: item.snippet.thumbnails.high.url,
                        });
                    default:
                        return new Error('unknown type');
                }
            });

            // inject durations into the videos
            results = await injectDurationsIntoVideoCollection(results);

            return res.send({
                data: results.map(v => v.output()),
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
};


/**
 * take in a collection of objects. for every one that is a Video, collate the IDs, get the durations, inject them back
 * into the video in place in the collection, and return the modified collection
 * @param {Object[]} collection 
 */
const injectDurationsIntoVideoCollection = collection => {
    const videoIds = collection.filter(c => c instanceof Video).map(c => c.id);

    const queryString = QueryString.stringify({
        part: 'contentDetails',
        id: videoIds.join(','),
        key: process.env.YOUTUBE_API_KEY,
    });
    
    return Axios.get(`https://www.googleapis.com/youtube/v3/videos?${queryString}`)
        .then(videosResponse => {
            console.log('videosResponse.data', videosResponse.data);
            return collection
                .map(c => {
                    if (c instanceof Video) {
                        c.duration = Moment.duration(videosResponse.data.items.find(i => i.id === c.id).contentDetails.duration).format('mm:ss');
                    }
                    return c;
                });
        });
};
