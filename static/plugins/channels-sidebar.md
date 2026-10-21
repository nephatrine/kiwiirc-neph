# Channels Sidebar

Adds a channel-list button to the channel header and opens the existing
`ChannelList` component in the sidebar.

## Enable

```json
"plugins": [
    { "name": "channels-sidebar", "url": "static/plugins/channels-sidebar.html" }
]
```

## Features

- Adds a list button to the channel header.
- Opens or closes `components/ChannelList` in the sidebar.
- Uses the existing channel-list loading and connect-cooldown behavior.
- Hides the button while the server is still in its channel-list cooldown.

## Dependencies

Uses `kiwi.require('components/ChannelList')`, `addUi('header_channel', ...)`,
and `toggleInSidebar(...)`. No external dependencies are required.
