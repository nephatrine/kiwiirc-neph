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
};

export default desktop;
