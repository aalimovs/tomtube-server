class Video {
    constructor({ id, title, author, duration, playlist }) {
        this.type = 'video';
        this.id = id;
        this.title = title;
        this.author = author;
        this.duration = duration;
        this.playlist = playlist;
    }

    output() {
        return {
            type: this.type,
            id: this.id,
            title: this.title,
            author: this.author,
            duration: this.duration,
        };
    }
}

module.exports = Video;
