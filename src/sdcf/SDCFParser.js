
import { unpack } from "msgpackr/unpack"
import { Vector3, Quaternion, Matrix4 } from "three";
/**
 * 
 * @param { Uint8Array } buffer 
 */
function decodeType( buffer ) {
    const header = String.fromCharCode(...buffer.slice(0, 4));

    if( header[0] === "{") {
        return "json";
    }

    if( header === "s2dp" ) {
        return "binary"
    }

    if( header === "s2dc") {
        return "compressed"
    }

    return null;
}

export default class SDCFParser {
    _dataStream = null;

    tables = {
        layer: {
            layers: {},
        },
    };

    _adaptors = {};

    constructor() {

        // ???
        this._adaptors = {
            text: this._adaptText,
            mtext: this._adaptText,
            line: this._adaptLine,
            mesh: (v) => v,
        }
    }

    /**
     * 
     * @param { Uint8Array } buffer 
     */
    static validate( buffer ) {
        return !!decodeType(buffer);
    }

    /**
     * 
     * @param { Uint8Array } buffer 
     */
    parseSync( buffer ) {
        const type = decodeType( buffer );

        let unrolledJSONData = null;

        if( type === "json" ) {
            const decode = new TextDecoder("utf-8");
            unrolledJSONData = JSON.parse( decode.decode(buffer) );

        } else {
            if( type === "compressed" ) {
                throw new Error("Not supported yet");
            }

            unrolledJSONData = unpack(new Uint8Array(buffer.buffer, 4));
        }

        if( unrolledJSONData.code < 300 ) {
            throw new Error("Version 3.0+ only supported yet")
        }

        this._dataStream = unrolledJSONData;

        this._stepNext();

        return this;
    }

    _stepNext() {
        // untroll
        // we store by indices
        for( const layer of this._dataStream.layers ) {
            this.tables.layer.layers[ layer.name ] = {
                name: layer.name,
                visible: layer.is_on,
                color: layer.color === -1 ? 0xffffff : layer.color,
                frozen: layer.is_frozen,
                colorIndex: 0,
            };
        }

        
        // convert fonts
        // dim styles etc
    }

    *_iterateEntities() {
        for( const e of this._dataStream.entities ) {
            if( !e.__adapted ) {

                const adaptor = this._adaptors[ e.type ];

                if ( !adaptor ) {
                    //console.warn("No adaptor for:", e.type )
                    continue;
                }

                
                e.__adapted = adaptor( this._adaptRoot(e) );
            }

            yield e.__adapted;
        }
    }
    /**
     * @returns { Generator<null> }
     */
    get entities() {
        return this._iterateEntities();
    }

    get header() {
        return 
    }

    /** Adaptors */

    _adaptRoot = (val) =>{
        let layer = val.layer;
     
        if( typeof(layer) !== "string") {
     
            const layers = this._dataStream.layers;
            let layerIndex = 0;

            if( val.eid ) {
                layerIndex = parseInt(val.eid.substr(0, 2), 16)
            } else {
                layerIndex = val.layer;
            }

            layer = layers[ layerIndex ]?.name;
        }

        return {
            ...val,
            layer,
            color: val.color === -1 ? 0xffffff : val.color,
            type: val.type.toUpperCase(),
        };
    }

    _adaptLine = (val) => {
        const batch =  val.batch ?? [ val.points ];
        const vertices = [];

        for( const b of batch ) {
            
            b.forEach((e) => vertices.push( { x: e[0], y: e[1], z: e[2] || 0 }));
        }

        return  Object.assign(val,{
            extrusionDirection: { x: 0, y: 0, z: 1 },
            vertices: vertices,
        })
    }

    _adaptText = ( val ) => {
        // for simple will decompose matrics now
        const v = new Matrix4();
        v.fromArray( val.matrix );

        const pos = new Vector3();
        const q = new Quaternion();
        const scale = new Vector3();

        v.decompose(pos, q, scale);
        
        let rot = 2.0 * Math.acos(q.w);

        if( q.x < 0 ) {
            rot *= -1;
        }

        return Object.assign(val, {
            startPoint: pos,
            xScale: scale.x,
            rotation: rot * 180 / Math.PI,
            textHeight: val.height / 1.4,
        })
    }
}

