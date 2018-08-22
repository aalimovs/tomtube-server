class Playlist {
    constructor({ id, title, author, thumbnail }) {
        this.type = 'playlist';
        this.id = id;
        this.title = title;
        this.author = author;
        this.thumbnail = thumbnail;
    }
    output() {
        return {
            type: this.type
            , id: this.id
            , title: this.title
            , author: this.author
            , thumbnail: this.thumbnail,
        };
    }
}

module.exports = Playlist;
