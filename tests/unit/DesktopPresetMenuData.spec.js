import {
    buildPresetMenu,
    normalisePresetItems
} from '../../desktop/electron/preset-menu';

describe('desktop preset menu data', () => {
    test('removes invalid and duplicate preset entries', () => {
        expect(normalisePresetItems([
            { id: 'nephnet', label: 'NephNET' },
            { id: ' nephnet ', label: 'Duplicate' },
            { id: '', label: 'Empty ID' },
            { id: 'aim', label: '' },
            { id: 'irc' },
            null,
            'nope',
        ])).toEqual([
            { id: 'nephnet', label: 'NephNET' },
        ]);
    });

    test('builds a menu only when presets are available', () => {
        expect(buildPresetMenu([], () => {})).toBeNull();

        const onSelect = jest.fn();
        const menu = buildPresetMenu([
            { id: 'nephnet', label: 'NephNET' },
        ], onSelect);

        expect(menu.label).toBe('Presets');
        expect(menu.submenu).toHaveLength(1);

        menu.submenu[0].click();
        expect(onSelect).toHaveBeenCalledWith('nephnet');
    });
});
