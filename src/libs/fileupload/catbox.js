import { desktopUploadMultipart } from '@/libs/desktop/Http';
import { acceptUploadUrl } from './url';

const ENDPOINT = 'https://catbox.moe/user/api.php';

export async function uploadCatbox(file, userhash) {
    const fields = {
        reqtype: 'fileupload',
    };
    if (userhash) {
        fields.userhash = userhash;
    }

    const response = await desktopUploadMultipart(ENDPOINT, fields, file);
    if (!response || !response.ok) {
        throw new Error('upload failed');
    }

    const url = acceptUploadUrl(await response.text());
    if (!url) {
        throw new Error('invalid upload url');
    }
    return url;
}
