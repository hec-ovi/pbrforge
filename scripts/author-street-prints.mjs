/**
 * The street prints atlas: the kiosk fascias, posters, notices, ads, a
 * newspaper, a pizza box lid and a sticker sheet the engine pastes on piers,
 * menu boards, shrines and litter, packed into one 2048 x 2048 plate.
 *
 *   node scripts/author-street-prints.mjs <art dir>
 *
 * `<art dir>` holds the Grok sheets (2026-10-06 art set). Each sheet's cell
 * and its size in metres are published in bindings/street-prints.json, in
 * pixels and as UV rectangles `[u0, v0, u1, v1]` with v = 0 at the top of the
 * plate, the way the engine reads every map (flipY off). The sheets themselves
 * stay outside the repository; their hashes are recorded in
 * sources/street-prints/provenance.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..' );
const art = process.argv[ 2 ];
if ( ! art ) throw new Error( 'usage: author-street-prints.mjs <art dir>' );
const SIZE = 2048, KEY = 'cyberpunk/street-prints/poor', VARIANT = 'sheet';
/** [sheet, x, y, width, height] in atlas pixels. */
const CELLS = [
	[ 'kiosk-noodles', 0, 0, 1024, 512 ], [ 'kiosk-pawn', 1024, 0, 1024, 512 ],
	[ 'kiosk-micro', 0, 512, 1024, 512 ], [ 'pizza-box-top', 1024, 512, 512, 512 ], [ 'art-abstract', 1536, 512, 512, 512 ],
	[ 'poster-vesper', 0, 1024, 512, 768 ], [ 'poster-mire-archive', 512, 1024, 512, 768 ],
	[ 'poster-mind-online', 1024, 1024, 512, 768 ], [ 'ad-salt-signal', 1536, 1024, 512, 768 ],
	[ 'newspaper-front', 0, 1792, 170, 256 ], [ 'notice-dream-levy', 170, 1792, 181, 256 ], [ 'notice-compute', 351, 1792, 181, 256 ],
	[ 'stickers-sheet', 532, 1792, 256, 256 ], [ 'ad-neural-link', 788, 1792, 170, 256 ], [ 'ad-upload', 958, 1792, 170, 256 ],
	[ 'poster-trust-model', 1128, 1792, 170, 256 ], [ 'poster-alignment', 1298, 1792, 170, 256 ],
	[ 'poster-thoughts-data', 1468, 1792, 170, 256 ], [ 'art-ink', 1638, 1792, 256, 256 ]
];
const out = path.join( root, 'themes/cyberpunk/assets/street-prints/poor', VARIANT );
fs.mkdirSync( out, { recursive: true } );

const layers = [];
const layout = { key: KEY, variant: VARIANT, size: [ SIZE, SIZE ], cells: {} };
const hashes = {};
for ( const [ name, x, y, width, height ] of CELLS ) {

	const file = path.join( art, `${name}.png` );
	const bytes = fs.readFileSync( file );
	hashes[ name ] = crypto.createHash( 'sha256' ).update( bytes ).digest( 'hex' );
	const meta = JSON.parse( fs.readFileSync( path.join( art, `${name}.json` ), 'utf8' ) );
	layers.push( { input: await sharp( bytes ).removeAlpha().resize( width, height, { fit: 'fill', kernel: 'lanczos3' } ).png().toBuffer(), left: x, top: y } );
	layout.cells[ name ] = { pixels: [ x, y, width, height ], uv: [ x / SIZE, y / SIZE, ( x + width ) / SIZE, ( y + height ) / SIZE ], metres: meta.worldSizeMetres };

}
await sharp( { create: { width: SIZE, height: SIZE, channels: 3, background: { r: 24, g: 24, b: 24 } } } ).composite( layers ).png( { compressionLevel: 9 } ).toFile( path.join( out, 'basecolor.png' ) );
// Paper and ink: matte, flat, never metal.
await sharp( { create: { width: SIZE, height: SIZE, channels: 3, background: { r: 128, g: 128, b: 255 } } } ).png().toFile( path.join( out, 'normal.png' ) );
await sharp( { create: { width: SIZE, height: SIZE, channels: 3, background: { r: 205, g: 205, b: 205 } } } ).png().toFile( path.join( out, 'roughness.png' ) );
await sharp( { create: { width: SIZE, height: SIZE, channels: 3, background: { r: 0, g: 0, b: 0 } } } ).png().toFile( path.join( out, 'metallic.png' ) );

const themeFile = path.join( root, 'themes/cyberpunk/theme.json' );
const theme = JSON.parse( fs.readFileSync( themeFile, 'utf8' ) );
theme.entries[ KEY ] = {
	key: KEY, alignment: 'exact', aspect: [ 1, 1 ],
	physical: { roughnessFactor: 1, metallicFactor: 0 },
	variants: [ { id: VARIANT, class: 'plate', resolution: [ SIZE, SIZE ],
		maps: Object.fromEntries( [ 'basecolor', 'normal', 'roughness', 'metallic' ].map( ( map ) => [ map, `assets/street-prints/poor/${VARIANT}/${map}.png` ] ) ) } ]
};
fs.writeFileSync( themeFile, `${JSON.stringify( theme, null, 2 )}\n` );
fs.writeFileSync( path.join( root, 'bindings/street-prints.json' ), `${JSON.stringify( layout, null, 2 )}\n` );
const sources = path.join( root, 'sources/street-prints' );
fs.mkdirSync( sources, { recursive: true } );
fs.writeFileSync( path.join( sources, 'provenance.json' ), `${JSON.stringify( { source: 'Grok image sheets (2026-10-06 art set), kept outside the repository', sha256: hashes }, null, 2 )}\n` );
console.log( JSON.stringify( { key: KEY, cells: Object.keys( layout.cells ).length } ) );
