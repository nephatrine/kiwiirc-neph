import { filehostAvailable, uploadFilehost } from './filehost';
import { uploadCatbox } from './catbox';
import { uploadFilebin } from './filebin';
import { uploadLitterbox } from './litterbox';
import { uploadSharebin } from './sharebin';
import { uploadUguu } from './uguu';
import { uploadWebdav } from './webdav';
import { acceptUploadUrl } from './url';

export { acceptUploadUrl } from './url';
export {
    basicAuthorization,
    filehostAvailable,
    filehostSupported,
    filehostUploadUrl,
    resolveUploadLocation
} from './filehost';

export const services = {
    litterbox: {
        id: 'litterbox',
        label: 'Litterbox',
        retentions: ['1h', '12h', '24h', '72h'],
        defaultRetention: '72h',
        retentionSetting: 'fileupload.litterbox.retention',
        upload(file, options) {
            let retention = retentionFor(this, options && options.retention);
            return uploadLitterbox(file, retention).then((text) => {
                let url = acceptUploadUrl(text);
                if (!url) {
                    throw new Error('invalid upload url');
                }
                return url;
            });
        },
    },
    catbox: {
        id: 'catbox',
        label: 'Catbox',
        desktopOnly: true,
        maxBytes: 200 * 1024 * 1024,
        upload(file, options) {
            const state = options && options.state;
            const userhash = state ?
                state.setting('fileupload.catbox.userhash') :
                '';
            return uploadCatbox(file, userhash);
        },
    },
    filebin: {
        id: 'filebin',
        label: 'Filebin',
        desktopOnly: true,
        upload(file) {
            return uploadFilebin(file);
        },
    },
    sharebin: {
        id: 'sharebin',
        label: 'ShareBin.eu',
        desktopOnly: true,
        maxBytes: 500 * 1024 * 1024,
        retentions: ['1d', '7d', '30d', 'never'],
        defaultRetention: '7d',
        retentionSetting: 'fileupload.sharebin.retention',
        upload(file, options) {
            const retention = retentionFor(this, options && options.retention);
            return uploadSharebin(file, retention);
        },
    },
    uguu: {
        id: 'uguu',
        label: 'Uguu~',
        desktopOnly: true,
        maxBytes: 128 * 1024 * 1024,
        upload(file) {
            return uploadUguu(file);
        },
    },
    webdav: {
        id: 'webdav',
        label: 'WebDAV',
        desktopOnly: true,
        upload(file, options) {
            const state = options && options.state;
            return uploadWebdav(file, {
                uploadUrl: state ?
                    state.setting('fileupload.webdav.upload_url') :
                    '',
                accessUrl: state ?
                    state.setting('fileupload.webdav.access_url') :
                    '',
                username: state ?
                    state.setting('fileupload.webdav.username') :
                    '',
                password: state ?
                    state.setting('fileupload.webdav.password') :
                    '',
            });
        },
    },
    filehost: {
        id: 'filehost',
        label: 'Filehost',
        persistent: true,
        upload(file, options) {
            return uploadFilehost(file, options && options.network);
        },
    },
};

export function serviceAvailableOnPlatform(service) {
    if (!service) {
        return false;
    }
    if (!service.desktopOnly) {
        return true;
    }
    return typeof window !== 'undefined' && !!window.kiwiDesktop;
}

export function listUploadServices() {
    return Object.keys(services).map((id) => services[id]);
}

export function serviceFromId(id) {
    if (!id || id === 'none') {
        return null;
    }
    return services[id] || null;
}

export function effectiveService(state, network) {
    if (!state || typeof state.setting !== 'function') {
        return null;
    }

    const useFilehost = !network || typeof network.setting !== 'function' ||
        network.setting('useFilehost') !== false;
    if (useFilehost && filehostAvailable(network)) {
        return services.filehost;
    }

    const id = state.setting('fileupload.service');
    if (id === 'filehost') {
        return null;
    }
    const service = serviceFromId(id);
    return serviceAvailableOnPlatform(service) ? service : null;
}

export function retentionFor(service, value) {
    if (!service || !service.retentions || !service.retentions.length) {
        return '';
    }
    if (service.retentions.indexOf(value) !== -1) {
        return value;
    }
    return service.defaultRetention || service.retentions[0];
}

export function effectiveRetention(state, service) {
    if (!service) {
        return '';
    }
    let value = '';
    if (service.retentionSetting && state &&
        typeof state.setting === 'function'
    ) {
        value = state.setting(service.retentionSetting);
    }
    return retentionFor(service, value);
}
