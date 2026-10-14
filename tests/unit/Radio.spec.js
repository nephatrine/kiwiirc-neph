import {
    acceptImageUrl,
    acceptStreamUrl,
    fetchStationList,
    prepareStations
} from '@/libs/radio/stations';

describe('radio stations', () => {
    test('does not fetch when the url is empty', async() => {
        let called = false;
        let result = await fetchStationList('', {
            fetch: () => {
                called = true;
                return Promise.resolve();
            },
        });
        expect(called).toBe(false);
        expect(result.stations).toEqual([]);
    });

    test('rejects unsafe urls and http streams on an https page', () => {
        let page = 'https://kiwi.example/';
        let scheme = String.fromCharCode(106, 97, 118, 97, 115, 99, 114, 105, 112, 116);
        expect(acceptStreamUrl(scheme + ':alert(1)', page)).toBe('');
        expect(acceptStreamUrl('http://stream.example/a', page)).toBe('');
        expect(acceptStreamUrl('https://stream.example/a', page)).toBe(
            'https://stream.example/a'
        );
        expect(acceptStreamUrl('http://stream.example/a', 'http://kiwi.example/')).toBe(
            'http://stream.example/a'
        );
    });

    test('skips stations with no safe source', () => {
        let scheme = String.fromCharCode(106, 97, 118, 97, 115, 99, 114, 105, 112, 116);
        let stations = prepareStations([
            null,
            { name: 'Bad', source: scheme + ':alert(1)' },
            { name: 'Plain', source: 'http://stream.example/a' },
            { name: 'Ok', source: 'https://stream.example/ok', image: 'https://cdn.example/a.png' },
            { source: 'https://stream.example/noname' },
        ], 'https://kiwi.example/');
        expect(stations.map((station) => station.name)).toEqual([
            'Ok',
            'https://stream.example/noname',
        ]);
        expect(stations[0].image).toBe('https://cdn.example/a.png');
    });

    test('keeps a root-relative station image', () => {
        expect(acceptImageUrl('/static/stations/rekt.png')).toBe('/static/stations/rekt.png');
        let scheme = String.fromCharCode(106, 97, 118, 97, 115, 99, 114, 105, 112, 116);
        expect(acceptImageUrl(scheme + ':alert(1)')).toBe('');
        let stations = prepareStations([
            {
                name: 'Local',
                source: 'https://stream.example/a',
                image: '/static/stations/rekt.png',
            },
        ], 'https://kiwi.example/');
        expect(stations[0].image).toBe('/static/stations/rekt.png');
    });
});
