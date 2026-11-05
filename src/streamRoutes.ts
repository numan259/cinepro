import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

type MovieParams = { id: string };
type TvParams = { id: string; season: string; episode: string };
type StreamProxyQuery = { data?: string };

type Source = {
    url: string;
    type: string;
    quality?: string;
    provider?: { id: string; name: string };
};

type SourceResponse = {
    sources?: Source[];
};

function getCandidateSources(response: SourceResponse): Source[] {
    const sources = response.sources ?? [];
    return [...sources].sort((a, b) => {
        const rank = (source: Source) =>
            source.type === 'mp4' ? 0 : source.type === 'hls' ? 1 : 2;
        return rank(a) - rank(b);
    });
}

function encodeProxyData(
    url: string,
    headers?: Record<string, string>
): string {
    return `b64.${Buffer.from(JSON.stringify({ url, headers })).toString(
        'base64url'
    )}`;
}

function decodeProxyData(data: string): {
    url: string;
    headers?: Record<string, string>;
} {
    if (data.startsWith('b64.')) {
        const parsed = JSON.parse(
            Buffer.from(data.slice(4), 'base64url').toString('utf8')
        ) as { url?: unknown; headers?: unknown };
        if (typeof parsed.url !== 'string' || parsed.url.length === 0) {
            throw new Error('Invalid proxy data');
        }
        return {
            url: parsed.url,
            headers:
                parsed.headers && typeof parsed.headers === 'object'
                    ? (parsed.headers as Record<string, string>)
                    : undefined
        };
    }

    const candidates = [data];
    let current = data;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const decoded = decodeURIComponent(current);
            if (decoded === current) {
                break;
            }
            candidates.push(decoded);
            current = decoded;
        } catch {
            const decoded = current.replace(/%(?![0-9a-f]{2})/gi, '%25');
            candidates.push(decodeURIComponent(decoded));
            break;
        }
    }

    let parsed: { url?: unknown; headers?: unknown } | undefined;
    for (const candidate of candidates) {
        try {
            parsed = JSON.parse(candidate) as {
                url?: unknown;
                headers?: unknown;
            };
            break;
        } catch {
            continue;
        }
    }

    if (!parsed) {
        throw new Error('Invalid proxy data');
    }

    if (typeof parsed.url !== 'string' || parsed.url.length === 0) {
        throw new Error('Invalid stream URL');
    }

    return {
        url: parsed.url,
        headers:
            parsed.headers && typeof parsed.headers === 'object'
                ? (parsed.headers as Record<string, string>)
                : undefined
    };
}

function isManifest(contentType: string, url: string): boolean {
    return /mpegurl|m3u8/i.test(contentType) || /\.m3u8(?:$|\?)/i.test(url);
}

function getFirstPlaylistUrl(manifest: string): string | undefined {
    const lineUrl = manifest
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0 && !line.startsWith('#'));

    if (lineUrl) {
        return lineUrl;
    }

    const uri = manifest.match(/URI="([^"]+)"/i);
    return uri?.[1];
}

function getSourceProxyUrl(source: Source): string | undefined {
    try {
        const sourceUrl = new URL(source.url);
        const data = sourceUrl.searchParams.get('data');
        if (!data) {
            return undefined;
        }
        const proxyData = decodeProxyData(data);
        return `/streams/proxy?data=${encodeProxyData(
            proxyData.url,
            proxyData.headers
        )}`;
    } catch {
        return undefined;
    }
}

async function isPlayableSource(source: Source): Promise<boolean> {
    const proxyUrl = getSourceProxyUrl(source);
    if (!proxyUrl) {
        return false;
    }

    try {
        const manifestResponse = await fetch(
            `http://localhost:${process.env.PORT ?? 3000}${proxyUrl}`,
            { signal: AbortSignal.timeout(10_000) }
        );
        if (!manifestResponse.ok) {
            return false;
        }

        if (source.type !== 'hls') {
            return true;
        }

        const manifest = await manifestResponse.text();
        const playlistPath = getFirstPlaylistUrl(manifest);
        if (!playlistPath) {
            return false;
        }

        const playlistResponse = await fetch(
            `http://localhost:${process.env.PORT ?? 3000}${playlistPath}`,
            { signal: AbortSignal.timeout(10_000) }
        );
        if (!playlistResponse.ok) {
            return false;
        }

        const playlist = await playlistResponse.text();
        const segmentPath = getFirstPlaylistUrl(playlist);
        if (!segmentPath) {
            return false;
        }

        const segmentResponse = await fetch(
            `http://localhost:${process.env.PORT ?? 3000}${segmentPath}`,
            { signal: AbortSignal.timeout(10_000) }
        );
        const contentType = segmentResponse.headers.get('content-type') ?? '';
        const segmentBody = await segmentResponse.arrayBuffer();
        const preview = Buffer.from(segmentBody)
            .subarray(0, 256)
            .toString('utf8')
            .trimStart();
        return (
            segmentResponse.ok &&
            !(
                /application\/json/i.test(contentType) ||
                (/text\/html/i.test(contentType) &&
                    /^(?:<!doctype|<html)/i.test(preview))
            ) &&
            segmentBody.byteLength > 0
        );
    } catch {
        return false;
    }
}

function rewriteManifest(
    content: string,
    baseUrl: string,
    headers?: Record<string, string>
): string {
    return content
        .split(/\r?\n/)
        .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) {
                return line;
            }

            if (trimmed.startsWith('#')) {
                let rewrittenLine = line;
                if (
                    /^#EXT-X-MEDIA:/i.test(trimmed) &&
                    /TYPE=AUDIO/i.test(trimmed)
                ) {
                    const isEnglish =
                        /LANGUAGE="eng"/i.test(trimmed) ||
                        /NAME="English"/i.test(trimmed);
                    rewrittenLine = rewrittenLine
                        .replace(
                            /DEFAULT=(?:YES|NO)/i,
                            `DEFAULT=${isEnglish ? 'YES' : 'NO'}`
                        )
                        .replace(
                            /AUTOSELECT=(?:YES|NO)/i,
                            `AUTOSELECT=${isEnglish ? 'YES' : 'NO'}`
                        );
                }

                return rewrittenLine.replace(
                    /URI="([^"]+)"/gi,
                    (_match, uri: string) => {
                        const resolved = new URL(uri, baseUrl).toString();
                        return `URI="/streams/proxy?data=${encodeProxyData(resolved, headers)}"`;
                    }
                );
            }

            const resolved = new URL(trimmed, baseUrl).toString();
            return `/streams/proxy?data=${encodeProxyData(resolved, headers)}`;
        })
        .join('\n');
}

async function proxyStream(
    request: FastifyRequest<{ Querystring: StreamProxyQuery }>,
    reply: FastifyReply
): Promise<void> {
    if (!request.query.data) {
        reply.code(400).send({ error: 'Missing data parameter' });
        return;
    }

    let proxyData: ReturnType<typeof decodeProxyData>;
    try {
        proxyData = decodeProxyData(request.query.data);
    } catch (error) {
        reply.code(400).send({
            error:
                error instanceof Error
                    ? error.message
                    : 'Invalid data parameter'
        });
        return;
    }

    const headers = { ...(proxyData.headers ?? {}) };
    const range = request.headers.range;
    if (range) {
        headers.Range = range;
    }

    const response = await fetch(proxyData.url, {
        headers,
        signal: AbortSignal.timeout(30_000)
    });
    const contentType =
        response.headers.get('content-type') ??
        (isManifest('', proxyData.url)
            ? 'application/vnd.apple.mpegurl'
            : 'application/octet-stream');
    const body = await response.arrayBuffer();
    const content = isManifest(contentType, proxyData.url)
        ? Buffer.from(
              rewriteManifest(
                  Buffer.from(body).toString('utf8'),
                  proxyData.url,
                  proxyData.headers
              )
          )
        : Buffer.from(body);

    reply.raw.statusCode = response.status;
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.setHeader(
        'Access-Control-Expose-Headers',
        'Content-Length, Content-Range, Accept-Ranges'
    );
    reply.raw.setHeader('Content-Type', contentType);

    for (const header of ['content-range', 'accept-ranges', 'etag']) {
        const value = response.headers.get(header);
        if (value) {
            reply.raw.setHeader(header, value);
        }
    }
    reply.raw.setHeader('content-length', content.byteLength);

    reply.raw.end(content);
}

async function resolveSource(
    app: FastifyInstance,
    path: string,
    reply: FastifyReply
): Promise<void> {
    let response = await app.inject({ method: 'GET', url: path });
    const shouldRetryDiscovery =
        response.statusCode >= 500 ||
        (response.statusCode === 404 &&
            response.body.includes('"code":"NO_SOURCES_AVAILABLE"'));
    if (shouldRetryDiscovery) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        response = await app.inject({ method: 'GET', url: path });
    }

    if (response.statusCode !== 200) {
        reply
            .code(response.statusCode)
            .type('application/json')
            .send(response.body);
        return;
    }

    const candidates = getCandidateSources(response.json<SourceResponse>());
    const checkedSources = await Promise.all(
        candidates.map(async (candidate) => ({
            candidate,
            playable: await isPlayableSource(candidate)
        }))
    );
    const source = checkedSources.find((result) => result.playable)?.candidate;
    if (!source) {
        reply.code(404).send({
            error: {
                code: 'NO_BROWSER_PLAYABLE_SOURCE',
                message: 'No browser-playable HLS or MP4 source is available',
                details: {
                    path,
                    providersChecked: [
                        ...new Set(
                            candidates.map(
                                (candidate) =>
                                    candidate.provider?.name ?? 'Unknown'
                            )
                        )
                    ],
                    sourcesReturned: candidates.length
                }
            }
        });
        return;
    }

    const proxyUrl = getSourceProxyUrl(source);
    if (!proxyUrl) {
        reply.code(502).send({
            error: {
                code: 'INVALID_SOURCE_URL',
                message: 'Selected source does not contain proxy data'
            }
        });
        return;
    }

    reply.redirect(proxyUrl);
}

export function registerStreamRoutes(app: FastifyInstance): void {
    app.get('/streams/proxy', proxyStream);

    app.get(
        '/streams/movie/:id/master.m3u8',
        async (request: FastifyRequest<{ Params: MovieParams }>, reply) => {
            await resolveSource(
                app,
                `/v1/movies/${encodeURIComponent(request.params.id)}`,
                reply
            );
        }
    );

    app.get(
        '/streams/tv/:id/:season/:episode/master.m3u8',
        async (request: FastifyRequest<{ Params: TvParams }>, reply) => {
            const { id, season, episode } = request.params;
            await resolveSource(
                app,
                `/v1/tv/${encodeURIComponent(id)}/seasons/${encodeURIComponent(season)}/episodes/${encodeURIComponent(episode)}`,
                reply
            );
        }
    );

    app.get(
        '/streams/movie/:id',
        async (request: FastifyRequest<{ Params: MovieParams }>, reply) => {
            await resolveSource(
                app,
                `/v1/movies/${encodeURIComponent(request.params.id)}`,
                reply
            );
        }
    );
}
