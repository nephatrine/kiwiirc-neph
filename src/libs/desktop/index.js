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
};

export default desktop;
