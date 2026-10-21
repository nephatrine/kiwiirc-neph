import Sidebar from '@/components/Sidebar';

function clickEvent(handle) {
    return {
        target: {
            closest: jest.fn(() => handle),
        },
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
    };
}

describe('Sidebar link handles', () => {
    it('opens a link handle in the pinned media viewer', () => {
        let emit = jest.fn();
        let handle = {
            getAttribute: jest.fn(() => 'https://example.com/embed'),
        };
        let event = clickEvent(handle);

        Sidebar.methods.onSidebarClick.call({ $state: { $emit: emit } }, event);

        expect(event.target.closest).toHaveBeenCalledWith('a[data-url]');
        expect(emit).toHaveBeenCalledWith(
            'mediaviewer.show',
            'https://example.com/embed'
        );
        expect(event.preventDefault).toHaveBeenCalled();
        expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('leaves normal sidebar links alone', () => {
        let emit = jest.fn();
        let event = clickEvent(null);

        Sidebar.methods.onSidebarClick.call({ $state: { $emit: emit } }, event);

        expect(emit).not.toHaveBeenCalled();
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(event.stopPropagation).not.toHaveBeenCalled();
    });

    it('ignores link handles without a URL', () => {
        let emit = jest.fn();
        let handle = {
            getAttribute: jest.fn(() => ''),
        };
        let event = clickEvent(handle);

        Sidebar.methods.onSidebarClick.call({ $state: { $emit: emit } }, event);

        expect(emit).not.toHaveBeenCalled();
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(event.stopPropagation).not.toHaveBeenCalled();
    });
});
