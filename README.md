# tyke tube server

- `cp .env.example .env`

- `nano .env` and input your youtube api key

- `npm i && npm start`

## searching

searching is done in the `search.js` file, which actually exposes an express endpoint then handles all the search logic

the searching can return 2 types of results - `video`s and `playlist`s

## common data structures

### example video ids
```

974E6IU_4I0


```

### search result object schema

```js
// video
{
    "type": "video",
    "id": "Lo2qQmj0_h4",
    "title": "AC/DC - You Shook Me All Night Long (Official Video)",
    "author": "acdcVEVO",
    "duration": "03:31"
}

//playlist
{
    "type": "playlist",
    "id": "PLSKiP8AuSHih2m6mzB69N_tQXA6R1ExNC",
    "title": "Top Tracks - AC/DC",
    "author": "AC/DC - Topic",
    "thumbnail": "https://i.ytimg.com/vi/v2AC41dglnM/hqdefault.jpg"
}
```