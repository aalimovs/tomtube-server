const Log = require('winston');
const QueryString = require('querystring');
const Axios = require('axios');
const Video = require('./video');
const Playlist = require('./playlist');
const Moment = require('moment');
const { dd, dump } = require('dumper.js');
const MomentDurationFormatSetup = require('moment-duration-format'); // eslint-disable-line

const parseYoutubeResponseItems = items => {
    const results = items.map((item) => {
        let { kind } = item;
        if (kind === 'youtube#searchResult') {
            kind = item.id.kind; // eslint-disable-line
        }
        dump(item);
        switch (kind) {
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
            case 'youtube#playlistItem':
                return new Video({
                    id: item.snippet.resourceId.videoId,
                    title: item.snippet.title,
                    author: item.snippet.channelTitle,
                });
            default:
                return new Error('unknown type');
        }
    });

    return results;
};

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
            
            let results = parseYoutubeResponseItems(items);

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

    app.get('/search/playlist/:playlistId/:pageToken?', async (req, res) => {
        const queryParams = {
            part: 'snippet,contentDetails',
            playlistId: req.params.playlistId,
            key: process.env.YOUTUBE_API_KEY,
        };
        if (req.params.pageToken) {
            queryParams.pageToken = req.params.pageToken;
        }
        const queryString = QueryString.stringify(queryParams);

        const youtubeResponse = await Axios.get(`https://www.googleapis.com/youtube/v3/playlistItems?${queryString}`);

        const { items, nextPageToken } = youtubeResponse.data;

        let results = await parseYoutubeResponseItems(items);
        results = await injectDurationsIntoVideoCollection(results);

        return res.send({
            results,
            nextPageToken,
        });
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
            dump('AAAAAAAA');
            return collection
                .map(c => {
                    dump(c);
                    if (c instanceof Video) {
                        c.duration = Moment.duration(videosResponse.data.items.find(i => i.id === c.id).contentDetails.duration).format('mm:ss');
                    }
                    return c;
                });
        });
};
