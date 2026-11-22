# Channels Sidebar

## Overview

Adds a **Channels** button to the channel header. The button opens the normal
channel list in the sidebar, using the client's existing loading, filtering, and
cooldown behavior.

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

- Click the channel-header button to open or close the channel list.
- The button is hidden while the server is in its channel-list cooldown.
- The sidebar uses the same channel list as the full channel browser.

There are no settings.

## Attribution

Adapted from `plugin-channels-sidebar.html` in
[ItsOnlyBinary/my-kiwiirc-plugins](https://github.com/ItsOnlyBinary/my-kiwiirc-plugins)
(Apache-2.0).
