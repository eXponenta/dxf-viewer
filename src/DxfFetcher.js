import DxfParser from "./parser/DxfParser.js"


const PARSER = [
    DxfParser,
]

/** Fetches and parses DXF file. */
export class DxfFetcher {
    constructor(url, encoding = "utf-8") {
        this.url = url
        this.encoding = encoding
    }

    /** @param progressCbk {Function} (phase, receivedSize, totalSize) */
    async Fetch(progressCbk = null) {
        const response = await fetch(this.url)
        const totalSize = +response.headers.get('Content-Length')

        const reader = response.body.getReader()
        let receivedSize = 0
        //XXX streaming parsing is not supported in dxf-parser for now (its parseStream() method
        // just accumulates chunks in a string buffer before parsing. Fix it later.
        const buffer = []

        while(true) {
            const {done, value} = await reader.read()
            if (done) {
                break
            }

            buffer.push( value );
            receivedSize += value.length
            if (progressCbk !== null) {
                progressCbk("fetch", receivedSize, totalSize)
            }
        }

        if (progressCbk !== null) {
            progressCbk("parse", 0, null)
        }

        let pointer = 0;
        const total = new Uint8Array(receivedSize);

        for( const part of buffer ) {
            total.set(part, pointer)
            pointer += part.byteLength;
        }

        let parserInstance = null;
        for( const Parser of PARSER ) {
            if( Parser.validate( total ) ) {
                parserInstance = new Parser();
                console.log("Use parser:" + Parser.name);
                break;
            }
        }

        return parserInstance.parseSync(total)
    }
}
