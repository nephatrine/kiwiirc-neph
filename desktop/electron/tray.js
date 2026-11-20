const MAX_BADGE_COUNT = 9999;

function normalizeBadgeSummary(value) {
    const summary = value && typeof value === 'object' ? value : {};
    const count = (number) => {
        if (!Number.isFinite(number)) {
            return 0;
        }
        return Math.max(0, Math.min(MAX_BADGE_COUNT, Math.trunc(number)));
    };

    return {
        unread: count(summary.unread),
        highlights: count(summary.highlights),
        errors: count(summary.errors),
    };
}

function summaryParts(summary) {
    const parts = [];
    if (summary.unread > 0) {
        parts.push(`${summary.unread > 999 ? '999+' : summary.unread} unread`);
    }
    if (summary.highlights > 0) {
        parts.push(`${summary.highlights} highlight${summary.highlights === 1 ? '' : 's'}`);
    }
    if (summary.errors > 0) {
        parts.push(`${summary.errors} error${summary.errors === 1 ? '' : 's'}`);
    }
    return parts;
}

function formatTrayTooltip(value) {
    const summary = normalizeBadgeSummary(value);
    const parts = summaryParts(summary);
    return parts.length ? `Kiwi IRC — ${parts.join(', ')}` : 'Kiwi IRC';
}

function formatOverlayDescription(value) {
    const summary = normalizeBadgeSummary(value);
    const parts = summaryParts(summary);
    return parts.length ? parts.join(', ') : 'Kiwi IRC';
}

function normalizeUpdate(value) {
    if (!value || !value.updateAvailable) {
        return null;
    }

    const latestVersion = typeof value.latestVersion === 'string' ?
        value.latestVersion.trim() :
        '';
    const releaseUrl = typeof value.releaseUrl === 'string' ?
        value.releaseUrl.trim() :
        '';
    if (!latestVersion || !releaseUrl) {
        return null;
    }

    return {
        latestVersion,
        releaseUrl,
    };
}

function createTrayService({
    app,
    Tray,
    Menu,
    nativeImage,
    getWindow,
    getSettings,
    onChangeCloseToTray,
    onDiagnostics,
    onOpenUpdate,
    onQuit,
    trayIconPath,
    badgeIconPath,
    platform,
}) {
    let tray = null;
    let created = false;
    let badgeImage = null;
    let summary = normalizeBadgeSummary(null);
    let update = null;

    function currentSettings() {
        if (typeof getSettings !== 'function') {
            return {};
        }
        try {
            return getSettings() || {};
        } catch (err) {
            return {};
        }
    }

    function closeToTray() {
        return !!currentSettings().closeToTray;
    }

    function isAvailable() {
        return created;
    }

    function shouldHideOnClose() {
        return created && closeToTray();
    }

    function loadBadgeImage() {
        if (badgeImage) {
            return badgeImage;
        }
        if (!nativeImage || typeof nativeImage.createFromPath !== 'function' || !badgeIconPath) {
            return null;
        }

        try {
            const image = nativeImage.createFromPath(badgeIconPath);
            if (image && !image.isEmpty()) {
                badgeImage = image;
            }
        } catch (err) {
            badgeImage = null;
        }
        return badgeImage;
    }

    function updateMenu() {
        if (!tray || !Menu || typeof Menu.buildFromTemplate !== 'function') {
            return;
        }

        const window = typeof getWindow === 'function' ? getWindow() : null;
        const visible = !!window &&
            !window.isDestroyed() &&
            typeof window.isVisible === 'function' &&
            window.isVisible();

        const items = [
            {
                label: visible ? 'Hide Kiwi IRC' : 'Show Kiwi IRC',
                click: () => {
                    if (visible) {
                        hideWindow();
                    } else {
                        showWindow();
                    }
                },
            },
            { type: 'separator' },
        ];

        if (update) {
            items.push({
                label: `Update Available: ${update.latestVersion}`,
                click: () => {
                    if (typeof onOpenUpdate === 'function') {
                        onOpenUpdate(update);
                    }
                },
            });
            items.push({ type: 'separator' });
        }

        items.push(
            {
                label: 'Close to Tray',
                type: 'checkbox',
                checked: closeToTray(),
                click: (item) => {
                    if (typeof onChangeCloseToTray === 'function') {
                        onChangeCloseToTray(!!item.checked);
                    }
                },
            },
            { type: 'separator' }
        );

        if (typeof onDiagnostics === 'function') {
            items.push(
                {
                    label: 'Capture Diagnostics Snapshot',
                    click: () => {
                        onDiagnostics();
                    },
                },
                { type: 'separator' }
            );
        }

        items.push({
            label: 'Quit Kiwi IRC',
            click: () => {
                if (typeof onQuit === 'function') {
                    onQuit();
                }
            },
        });

        tray.setContextMenu(Menu.buildFromTemplate(items));
    }

    function updateTooltip() {
        if (tray) {
            tray.setToolTip(formatTrayTooltip(summary));
        }
    }

    function updateBadge(nextSummary) {
        summary = normalizeBadgeSummary(nextSummary);
        updateTooltip();

        if (app && typeof app.setBadgeCount === 'function') {
            try {
                app.setBadgeCount(summary.unread);
            } catch (err) {
                // Some Linux desktops do not implement the launcher badge.
            }
        }

        if (platform === 'win32') {
            const window = typeof getWindow === 'function' ? getWindow() : null;
            if (window && !window.isDestroyed() &&
                typeof window.setOverlayIcon === 'function'
            ) {
                try {
                    const image = summary.unread > 0 ? loadBadgeImage() : null;
                    window.setOverlayIcon(
                        image,
                        image ? formatOverlayDescription(summary) : ''
                    );
                } catch (err) {
                    // The taskbar may have gone away during shutdown.
                }
            }
        }
    }

    function showWindow() {
        const window = typeof getWindow === 'function' ? getWindow() : null;
        if (!window || window.isDestroyed()) {
            return false;
        }

        if (window.isMinimized()) {
            window.restore();
        }
        window.show();
        window.focus();
        updateMenu();
        return true;
    }

    function hideWindow() {
        const window = typeof getWindow === 'function' ? getWindow() : null;
        if (!window || window.isDestroyed()) {
            return false;
        }

        window.hide();
        updateMenu();
        return true;
    }

    function toggleWindow() {
        const window = typeof getWindow === 'function' ? getWindow() : null;
        if (!window || window.isDestroyed()) {
            return false;
        }

        if (window.isVisible()) {
            return hideWindow();
        }
        return showWindow();
    }

    function setCloseToTray() {
        updateMenu();
    }

    function setUpdate(value) {
        update = normalizeUpdate(value);
        updateMenu();
    }

    function create() {
        if (created) {
            return true;
        }
        if (!Tray || !trayIconPath) {
            return false;
        }

        try {
            const image = nativeImage && typeof nativeImage.createFromPath === 'function' ?
                nativeImage.createFromPath(trayIconPath) :
                null;
            if (!image || image.isEmpty()) {
                return false;
            }

            tray = new Tray(image);
            tray.setToolTip(formatTrayTooltip(summary));
            tray.on('click', toggleWindow);
            tray.on('double-click', showWindow);
            created = true;
            updateMenu();
            return true;
        } catch (err) {
            tray = null;
            created = false;
            return false;
        }
    }

    function destroy() {
        if (tray) {
            try {
                tray.destroy();
            } catch (err) {
                // The tray may already be gone.
            }
        }
        tray = null;
        created = false;
    }

    return {
        create,
        destroy,
        isAvailable,
        shouldHideOnClose,
        getCloseToTray: closeToTray,
        setCloseToTray,
        setUpdate,
        showWindow,
        hideWindow,
        toggleWindow,
        updateMenu,
        updateBadge,
        updateTooltip,
    };
}

module.exports = {
    createTrayService,
    formatOverlayDescription,
    formatTrayTooltip,
    normalizeBadgeSummary,
    normalizeUpdate,
};
