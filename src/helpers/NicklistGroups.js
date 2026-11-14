'kiwi public';

export const NICKLIST_GROUP_LABELS = {
    owner: 'nicklist_group_owner',
    operator: 'nicklist_group_operator',
    halfop: 'nicklist_group_halfop',
    voiced: 'nicklist_group_voiced',
    users: 'nicklist_group_users',
    online: 'nicklist_group_online',
    offline: 'nicklist_group_offline',
};

const MODE_GROUPS = {
    q: 'owner',
    a: 'operator',
    o: 'operator',
    h: 'halfop',
    v: 'voiced',
};

const PRIVILEGED_GROUPS = ['owner', 'operator', 'halfop', 'voiced'];

export function nicklistGroupForUser(buffer, user, groupAway) {
    const rawMode = String(buffer.userMode(user) || '');
    const mode = rawMode.toLowerCase();

    if (Object.prototype.hasOwnProperty.call(MODE_GROUPS, mode)) {
        return MODE_GROUPS[mode];
    }

    if (rawMode) {
        const prefixes = buffer.userPrefixes() || [];
        const rank = prefixes.findIndex((prefix) => (
            String(prefix.mode || '') === rawMode
        ));

        if (rank === 0) {
            return 'owner';
        }
        if (rank === 1) {
            return 'operator';
        }
        if (rank === 2) {
            return 'halfop';
        }
        if (rank >= 3) {
            return 'voiced';
        }
    }

    if (groupAway && user.away) {
        return 'offline';
    }

    return 'users';
}

function userItem(user) {
    return {
        id: 'user-' + user.id,
        type: 'user',
        user,
    };
}

function headingItem(groupId) {
    return {
        id: 'group-' + groupId,
        type: 'heading',
        labelKey: NICKLIST_GROUP_LABELS[groupId],
    };
}

function appendGroup(items, groupId, users) {
    if (!users.length) {
        return;
    }

    items.push(headingItem(groupId));
    users.forEach((user) => {
        items.push(userItem(user));
    });
}

export function buildNicklistGroups(buffer, users, groupAway) {
    const groups = {
        owner: [],
        operator: [],
        halfop: [],
        voiced: [],
        users: [],
        offline: [],
    };

    users.forEach((user) => {
        groups[nicklistGroupForUser(buffer, user, groupAway)].push(user);
    });

    const items = [];
    PRIVILEGED_GROUPS.forEach((groupId) => {
        appendGroup(items, groupId, groups[groupId]);
    });

    appendGroup(items, groupAway ? 'online' : 'users', groups.users);

    if (groupAway) {
        appendGroup(items, 'offline', groups.offline);
    }

    return items;
}
