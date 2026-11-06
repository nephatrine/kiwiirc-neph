import { desktopUploadMultipart } from '@/libs/desktop/Http';

const ENDPOINT = 'https://litterbox.catbox.moe/resources/internals/api.php';

export async function uploadLitterbox(file, retention) {
    let response = await desktopUploadMultipart(
        ENDPOINT,
        {
            reqtype: 'fileupload',
            time: retention,
        },
        file
    );

    if (!response) {
        let body = new FormData();
        body.append('reqtype', 'fileupload');
        body.append('time', retention);
        body.append('fileToUpload', file, file.name || 'file');

        response = await fetch(ENDPOINT, {
            method: 'POST',
            body,
        });
    }

    if (!response.ok) {
        throw new Error('upload failed');
    }

    return response.text();
}
