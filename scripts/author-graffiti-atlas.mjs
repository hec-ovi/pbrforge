/**
 * The graffiti atlas the engine sprays on highway piers and other bare
 * concrete: four 2 x 1 m sheets of marker and spray tags, stacked in one
 * 1024 x 2048 RGBA plate, keyed off the pure black they were painted on.
 *
 *   node scripts/author-graffiti-atlas.mjs <art dir>
 *
 * `<art dir>` holds the Grok sheets (graffiti-marker-1/2, graffiti-tags-1/2
 * .png, painted on #000000). Their hashes are recorded in
 * sources/graffiti-atlas/provenance.json; the sheets themselves stay outside
 * the repository. Writes themes/cyberpunk/assets/graffiti-atlas/poor/markers/
 * and the `cyberpunk/graffiti-atlas/poor` entry in the theme.
 *
 * Keying: a pixel's coverage is its brightest channel over a soft threshold,
 * and its colour is unmixed from the black it was painted over (observed =
 * colour x coverage), so a translucent edge keeps the paint's own hue.
 * Paint is satin (roughness 0.5 where covered), flat, never metal.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..' );
const art = process.argv[ 2 ];
if ( ! art ) throw new Error( 'usage: author-graffiti-atlas.mjs <art dir>' );
const SHEETS = [ 'graffiti-marker-1', 'graffiti-marker-2', 'graffiti-tags-1', 'graffiti-tags-2' ];
const W = 1024, H = 512, ROWS = SHEETS.length;
const KEY = 'cyberpunk/graffiti-atlas/poor', VARIANT = 'markers';
const out = path.join( root, 'themes/cyberpunk/assets/graffiti-atlas/poor', VARIANT );
fs.mkdirSync( out, { recursive: true } );

const base = Buffer.alloc( W * H * ROWS * 4 ), opacity = Buffer.alloc( W * H * ROWS ), rough = Buffer.alloc( W * H * ROWS );
const provenance = [];
for ( const [ row, name ] of SHEETS.entries() ) {

	const file = path.join( art, `${name}.png` );
	const bytes = fs.readFileSync( file );
	provenance.push( { sheet: name, row, sha256: crypto.createHash( 'sha256' ).update( bytes ).digest( 'hex' ), worldSizeMetres: [ 2, 1 ] } );
	const { data } = await sharp( bytes ).removeAlpha().resize( W, H, { fit: 'fill', kernel: 'lanczos3' } ).raw().toBuffer( { resolveWithObject: true } );
	for ( let i = 0; i < W * H; i ++ ) {

		const r = data[ i * 3 ], g = data[ i * 3 + 1 ], b = data[ i * 3 + 2 ];
		const peak = Math.max( r, g, b );
		const t = Math.min( 1, Math.max( 0, ( peak - 10 ) / 70 ) );
		const alpha = t * t * ( 3 - 2 * t );
		const at = row * W * H + i;
		const unmix = alpha > 0.02 ? 1 / Math.max( alpha, peak / 255 ) : 1;
		base[ at * 4 ] = Math.min( 255, Math.round( r * unmix ) );
		base[ at * 4 + 1 ] = Math.min( 255, Math.round( g * unmix ) );
		base[ at * 4 + 2 ] = Math.min( 255, Math.round( b * unmix ) );
		base[ at * 4 + 3 ] = Math.round( alpha * 255 );
		opacity[ at ] = base[ at * 4 + 3 ];
		rough[ at ] = Math.round( ( 0.85 - 0.35 * alpha ) * 255 );

	}

}
const size = { width: W, height: H * ROWS };
await sharp( base, { raw: { ...size, channels: 4 } } ).png( { compressionLevel: 9 } ).toFile( path.join( out, 'basecolor.png' ) );
await sharp( opacity, { raw: { ...size, channels: 1 } } ).png( { compressionLevel: 9 } ).toFile( path.join( out, 'opacity.png' ) );
await sharp( rough, { raw: { ...size, channels: 1 } } ).png( { compressionLevel: 9 } ).toFile( path.join( out, 'roughness.png' ) );
await sharp( { create: { ...size, channels: 3, background: { r: 128, g: 128, b: 255 } } } ).png().toFile( path.join( out, 'normal.png' ) );
await sharp( { create: { ...size, channels: 3, background: { r: 0, g: 0, b: 0 } } } ).png().toFile( path.join( out, 'metallic.png' ) );

const themeFile = path.join( root, 'themes/cyberpunk/theme.json' );
const theme = JSON.parse( fs.readFileSync( themeFile, 'utf8' ) );
const maps = Object.fromEntries( [ 'basecolor', 'normal', 'roughness', 'metallic', 'opacity' ].map( ( map ) => [ map, `assets/graffiti-atlas/poor/${VARIANT}/${map}.png` ] ) );
theme.entries[ KEY ] = {
	key: KEY, alignment: 'exact', aspect: [ 1, 2 ],
	physical: { roughnessFactor: 1, metallicFactor: 0, alphaMode: 'BLEND' },
	variants: [ { id: VARIANT, class: 'plate', resolution: [ size.width, size.height ], maps } ]
};
fs.writeFileSync( themeFile, `${JSON.stringify( theme, null, 2 )}\n` );
const sources = path.join( root, 'sources/graffiti-atlas' );
fs.mkdirSync( sources, { recursive: true } );
fs.writeFileSync( path.join( sources, 'provenance.json' ), `${JSON.stringify( { key: KEY, variant: VARIANT, rows: provenance,
	source: 'Grok image sheets painted on pure #000000 (2026-10-06 art set), kept outside the repository', keyed: 'coverage from the brightest channel, smoothstep 10..80 of 255; colour unmixed from black' }, null, 2 )}\n` );
console.log( JSON.stringify( { key: KEY, variant: VARIANT, resolution: [ size.width, size.height ], rows: SHEETS } ) );
