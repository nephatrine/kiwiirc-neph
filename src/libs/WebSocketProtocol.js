// IRCv3 WebSocket subprotocol used by direct connections. Kiwi IRC sends and
// receives text frames, so it requests the text subprotocol rather than the
// binary one.
export const IRC_WEBSOCKET_PROTOCOL = 'text.ircv3.net';
