import {
    desktopFetch,
    desktopUploadFile,
    desktopUploadMultipart,
    isDesktop,
    isNativeHttpAvailable
} from './Http';
import {
    isNativeDownloadAvailable,
    saveUrl
} from './Files';
import {
    desktopMediaUrl,
    isMediaProxyAvailable
} from './Media';
import {
    clear as clearSecrets,
    isAvailable as isSecretStorageAvailable,
    load as loadSecrets,
    save as saveSecrets,
    status as secretStorageStatus
} from './Secrets';
import {
    backup as backupProfile,
    exportBundle as exportProfileBundle,
    importBundle as importProfileBundle,
    isAvailable as isProfileTransferAvailable,
    openFolder as openProfileFolder
} from './Profile';
import {
    install as installTheme,
    isAvailable as isThemeInstallAvailable,
    list as listThemes,
    uninstall as uninstallTheme
} from './Themes';
import {
    install as installEmojiPack,
    isAvailable as isEmojiPackInstallAvailable,
    list as listEmojiPacks,
    uninstall as uninstallEmojiPack
} from './EmojiPacks';
import {
    close as closeNotification,
    isAvailable as isNativeNotificationAvailable,
    onClose as onNotificationClose,
    onClick as onNotificationClick,
    show as showNotification
} from './Notifications';

const desktop = {
    isDesktop,
    http: {
        fetch: desktopFetch,
        uploadFile: desktopUploadFile,
        uploadMultipart: desktopUploadMultipart,
        isAvailable: isNativeHttpAvailable,
    },
    files: {
        saveUrl,
        isAvailable: isNativeDownloadAvailable,
    },
    media: {
        proxyUrl: desktopMediaUrl,
        isAvailable: isMediaProxyAvailable,
    },
    secrets: {
        status: secretStorageStatus,
        load: loadSecrets,
        save: saveSecrets,
        clear: clearSecrets,
        isAvailable: isSecretStorageAvailable,
    },
    profile: {
        exportBundle: exportProfileBundle,
        importBundle: importProfileBundle,
        backup: backupProfile,
        openFolder: openProfileFolder,
        isAvailable: isProfileTransferAvailable,
    },
    themes: {
        list: listThemes,
        install: installTheme,
        uninstall: uninstallTheme,
        isAvailable: isThemeInstallAvailable,
    },
    emojiPacks: {
        list: listEmojiPacks,
        install: installEmojiPack,
        uninstall: uninstallEmojiPack,
        isAvailable: isEmojiPackInstallAvailable,
    },
    notifications: {
        show: showNotification,
        close: closeNotification,
        onClick: onNotificationClick,
        onClose: onNotificationClose,
        isAvailable: isNativeNotificationAvailable,
    },
};

export default desktop;
