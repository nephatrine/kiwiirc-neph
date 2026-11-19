import state from '@/libs/state';
import * as TextFormatting from '@/helpers/TextFormatting';

function dispatchRename(client, params, overrides = {}) {
    return new Promise((resolve, reject) => {
        client.parsed_middleware.handle([
            'unknown command',
            {
                command: 'RENAME',
                params,
                nick: 'Oper',
                tags: {},
                time: Date.now(),
                ...overrides,
            },
            client,
        ], (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

describe('draft/channel-rename', () => {
    let s;
    let network;
    let client;
    let buffer;
    let otherBuffer;

    beforeEach(() => {
        jest.spyOn(TextFormatting, 't').mockImplementation((key, params = {}) => {
            if (key === 'channel_renamed') {
                return `${params.old} was renamed to ${params.new}.`;
            }
            if (key === 'channel_renamed_reason') {
                return `${params.old} was renamed to ${params.new} (${params.reason}).`;
            }
            if (key === 'channel_renamed_title') {
                return 'Channel Renamed';
            }
            return key;
        });

        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.state = 'connected';
        network.nick = 'TestNick';
        client = network.ircClient;
        client.user.nick = 'TestNick';

        buffer = s.addBuffer(network.id, '#old');
        otherBuffer = s.addBuffer(network.id, '#other');

        s.setActiveBuffer(network.id, '#old');
        s.setActiveBuffer(network.id, '#other');
        s.setActiveBuffer(network.id, '#old');

        buffer.joined = true;
        buffer.key = 'secret';
        buffer.topic = 'Topic';
        buffer.setting('alert_on', 'message');
        network.active_metadata_subs['#old'] = new Set(['display-name']);
        network.metadata_label_targets.set('label-1', '#old');

        s.addMessage(buffer, {
            time: Date.now(),
            nick: 'Other',
            message: 'hello',
            type: 'privmsg',
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('moves the existing buffer and preserves its state', async() => {
        const notifications = jest.fn();
        s.$on('notification.show', notifications);

        await dispatchRename(client, ['#old', '#new', 'Typo fix']);

        expect(buffer.name).toBe('#new');
        expect(s.getBufferByName(network.id, '#old')).toBeFalsy();
        expect(s.getBufferByName(network.id, '#new')).toBe(buffer);
        expect(buffer.joined).toBe(true);
        expect(buffer.key).toBe('secret');
        expect(buffer.topic).toBe('Topic');
        expect(s.getActiveBuffer()).toBe(buffer);
        expect(s.ui.active_buffer).toBe('#new');

        expect(buffer.messagesObj.buffer).toBe('#new');
        expect(buffer.getMessages()).toHaveLength(2);
        expect(buffer.getMessages()[0].message).toBe('hello');
        expect(buffer.getMessages()[1].type).toBe('info');
        expect(buffer.getMessages()[1].message).toBe(
            '#old was renamed to #new (Typo fix).'
        );

        expect(network.active_metadata_subs['#old']).toBeUndefined();
        expect(network.active_metadata_subs['#new']).toEqual(new Set(['display-name']));
        expect(network.metadata_label_targets.get('label-1')).toBe('#new');

        expect(s.ui.last_active_buffers).toEqual(
            expect.arrayContaining([
                { networkid: network.id, bufferName: '#new' },
            ])
        );
        expect(s.ui.last_active_buffers.every((entry) => entry.bufferName !== '#old'))
            .toBe(true);

        expect(notifications).toHaveBeenCalledTimes(1);
        const [body, opts] = notifications.mock.calls[0];
        expect(body).toBe('#old was renamed to #new (Typo fix).');
        expect(opts.title).toBe('Channel Renamed');
        expect(opts.force).toBeUndefined();

        s.setActiveBuffer(network.id, '#other');
        opts.onclick();
        expect(s.getActiveBuffer()).toBe(buffer);
    });

    it('omits an empty reason and supports case-only renames', async() => {
        let notifications = jest.fn();
        s.$on('notification.show', notifications);

        await dispatchRename(client, ['#old', '#new', '']);

        expect(buffer.getMessages()[1].message).toBe('#old was renamed to #new.');
        expect(notifications).toHaveBeenCalledWith(
            '#old was renamed to #new.',
            expect.objectContaining({ title: 'Channel Renamed' })
        );

        const caseRename = state.create();
        const caseNetwork = caseRename.addNetwork('CaseNetwork', 'TestNick', {});
        caseNetwork.state = 'connected';
        caseNetwork.nick = 'TestNick';
        const caseClient = caseNetwork.ircClient;
        caseClient.user.nick = 'TestNick';
        const caseBuffer = caseRename.addBuffer(caseNetwork.id, '#old');
        caseRename.setActiveBuffer(caseNetwork.id, '#old');

        await dispatchRename(caseClient, ['#old', '#OLD', '']);

        expect(caseBuffer.name).toBe('#OLD');
        expect(caseRename.getBufferByName(caseNetwork.id, '#old')).toBe(caseBuffer);
        expect(caseRename.ui.active_buffer).toBe('#OLD');
        expect(caseBuffer.getMessages().some((message) => (
            message.message === '#old was renamed to #OLD.'
        ))).toBe(true);
    });

    it('updates history without switching buffers and ignores unknown channels', async() => {
        s.setActiveBuffer(network.id, '#other');

        await dispatchRename(client, ['#old', '#new', '']);

        expect(buffer.name).toBe('#new');
        expect(s.getActiveBuffer()).toBe(otherBuffer);
        expect(s.ui.active_buffer).toBe('#other');
        expect(s.ui.last_active_buffers).toEqual(
            expect.arrayContaining([
                { networkid: network.id, bufferName: '#new' },
            ])
        );

        const notifications = jest.fn();
        s.$on('notification.show', notifications);

        await dispatchRename(client, ['#missing', '#newer', '']);

        expect(s.getBufferByName(network.id, '#missing')).toBeFalsy();
        expect(s.getBufferByName(network.id, '#newer')).toBeFalsy();
        expect(notifications).not.toHaveBeenCalled();
    });

    it('does not create duplicate buffers when the new name exists', async() => {
        const existing = s.addBuffer(network.id, '#new');
        const notifications = jest.fn();
        s.$on('notification.show', notifications);

        await dispatchRename(client, ['#old', '#new', '']);

        expect(buffer.name).toBe('#old');
        expect(existing.name).toBe('#new');
        expect(s.getBufferByName(network.id, '#new')).toBe(existing);
        expect(notifications).not.toHaveBeenCalled();
    });
});
