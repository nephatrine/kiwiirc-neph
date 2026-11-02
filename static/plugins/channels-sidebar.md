# Channels Sidebar

## Overview

Adds a channel-list button to the channel header and opens the existing
`ChannelList` component in the sidebar. It reuses the normal channel-list
loading and connect-cooldown behavior.

The default configuration enables this plugin.

## Enable

The default `plugins` list includes this entry:

```json
"plugins": [
    { "name": "channels-sidebar", "url": "static/plugins/channels-sidebar.html" }
]
```

Remove it from the `plugins` array to disable the plugin.

## Usage

- The list button appears in the channel header.
- Clicking it opens the channel list in the sidebar.
- Clicking it again closes the sidebar.
- The button is hidden while the server is still in its channel-list cooldown.
- The list uses the client's existing channel-list loading and filtering.

## Technical Details

The plugin:

- Loads `components/ChannelList` with `kiwi.require('components/ChannelList')`.
- Registers a `header_channel` component with
  `kiwi.addUi('header_channel', Button)`.
- Opens and closes the sidebar with
  `kiwi.toggleInSidebar('channels-sidebar', chanList, { network })`.
- Uses `sidebarState.isComponentOpen('channels-sidebar')` to reflect whether its
  own sidebar content is open.
- Calls `network.maybeUpdateChannelList()` before opening the list.
- Checks `network.channelListConnectRemaining(now)` to hide the button during
  the channel-list cooldown.

There are no settings and no external dependencies.

## Attribution

Station playback is adapted from
[kiwiirc-plugin-radio](https://github.com/ItsOnlyBinary/my-kiwiirc-plugins)
(Apache-2.0).
