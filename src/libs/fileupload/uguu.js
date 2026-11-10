import { desktopUploadMultipart } from '@/libs/desktop/Http';
import { acceptUploadUrl } from './url';

const ENDPOINT = 'https://uguu.se/upload';

export async function uploadUguu(file) {
    const response = await desktopUploadMultipart(
        ENDPOINT,
        {},
        file,
        { fileField: 'files[]' }
    );
    if (!response || !response.ok) {
        throw new Error('upload failed');
    }

    let data;
    try {
        data = await response.json();
    } catch (err) {
        throw new Error('invalid upload response');
    }

    const files = data && Array.isArray(data.files) ? data.files : [];
    const url = files.length && files[0] ? acceptUploadUrl(files[0].url) : '';
    if (!data || !data.success || !url) {
        throw new Error('invalid upload url');
    }
    return url;
}
