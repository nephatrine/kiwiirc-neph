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
};

export default desktop;
