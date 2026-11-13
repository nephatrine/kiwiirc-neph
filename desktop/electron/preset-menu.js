const MAX_PRESET_LABEL_LENGTH = 80;

function normalisePresetItems(items) {
    const seen = new Set();
    const presets = [];

    (Array.isArray(items) ? items : []).forEach((item) => {
        if (!item || typeof item.id !== 'string' || typeof item.label !== 'string') {
            return;
        }

        const id = item.id.trim();
        const label = item.label.trim();
        if (!id || !label || seen.has(id)) {
            return;
        }

        seen.add(id);
        presets.push({
            id,
            label: label.slice(0, MAX_PRESET_LABEL_LENGTH),
        });
    });

    return presets;
}

function buildPresetMenu(items, onSelect) {
    const presets = normalisePresetItems(items);
    if (!presets.length || typeof onSelect !== 'function') {
        return null;
    }

    return {
        label: 'Presets',
        submenu: presets.map((preset) => ({
            label: preset.label,
            click: () => onSelect(preset.id),
        })),
    };
}

module.exports = {
    buildPresetMenu,
    normalisePresetItems,
};
