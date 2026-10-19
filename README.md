# Kiwi IRC

***A web-based IRC client***

- Static files only, so it can be hosted on any web server or CDN
- One or many networks, over a websocket directly, through
  [webircgateway](https://github.com/kiwiirc/webircgateway), or through a
  bouncer such as [soju](https://soju.im/) with the IRCv3 `bouncer-networks`
  extension
- 39 built-in themes, plus a custom theme URL
- Replies, reactions, typing indicators, and an emoji picker
- Display names, pronouns, and profile colour when the server provides them
- History and read markers that stay in sync across sessions
- Image, audio, and video embeds, with previews for YouTube, Twitch, SoundCloud,
  Spotify, Streamable, Giphy, and RedGifs. Imgur single images are shown as
  images
- Optional uploads through Litterbox or the server `FILEHOST`, with per-user
  service and retention overrides
- Favourite and mute channels, and export a buffer as plain text
- Desktop notifications, independent of synthesized sounds
- [Plugin support](https://github.com/kiwiirc/kiwiirc/wiki/03.-Plugins),
  including self-hosted
  [file uploading](https://github.com/kiwiirc/plugin-fileuploader/) and
  [video calling](https://github.com/kiwiirc/plugin-conference)

## Installing Kiwi IRC

Source and issues: https://code.nephatrine.net/nephatrine/kiwiirc

For help, join `#support` on `irc.nephatrine.net`.

To install on your own server, build from source below.

## Building from source

### Dependencies

Before you can build or start to develop on Kiwi IRC, make sure to have the
following installed on your system:

- [Node.js](https://nodejs.org/) (>= 22.0.0)
- [npm](https://www.npmjs.com/)

### Building for production

```bash
# Install dependencies
$ npm install

# Build Kiwi IRC into the dist/ folder
$ npm run build
```

***Note:*** *Be sure to copy the files from the `dist/` folder to your
webserver! This folder will be overwritten each time it is built.*

### Development environment

Kiwi IRC is built with Vue.js, webpack, and Babel.

```bash
# Install dependencies
npm install

# Optionally link git pre-commit linting hooks
ln -s $PWD/scripts/pre-commit .git/hooks/

# A development web server with hot reloading at http://localhost:8080/
npm run dev
```

***Note:*** *Do not use this development environment on your live website. It is
slow, very large, and insecure.*

### Configuration

The client loads [static/config.json](static/config.json) on startup. The
browser fetches it, so do not put secrets in it. Options, defaults, and the keys
an admin must set are in [CONFIGURATION.md](CONFIGURATION.md).

## Browser support

Kiwi IRC is tested on all modern browsers.

- Chrome
- Chrome Mobile (Android)
- Firefox
- Safari 15+
- Edge (Chromium)

## Technical Documentation

For more detailed technical information, refer to the following documents in the
repository:

- **[CONFIGURATION.md](CONFIGURATION.md)**: Configuration options and defaults.
- **[IRCv3.md](IRCv3.md)**: Supported capabilities, client tags, and
  synchronization behaviour.
- **[CHANGELOG.md](CHANGELOG.md)**: Features, changes, and security updates.
