import { filehostAvailable, uploadFilehost } from './filehost';
import { uploadLitterbox } from './litterbox';
import { acceptUploadUrl } from './url';

export { acceptUploadUrl } from './url';
export {
    basicAuthorization,
    filehostAvailable,
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
    filehost: {
        id: 'filehost',
        label: 'Filehost',
        upload(file, options) {
            return uploadFilehost(file, options && options.network);
        },
    },
};

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
    let id = state.setting('fileupload.service');
    if (id === 'filehost' && !filehostAvailable(network)) {
        return null;
    }
    return serviceFromId(id);
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
    if (service.retentionSetting && state && typeof state.setting === 'function') {
        value = state.setting(service.retentionSetting);
    }
    return retentionFor(service, value);
}
