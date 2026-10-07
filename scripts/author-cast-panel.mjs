/**
 * Cast-in-place concrete as poor walls show it: the photographed cast
 * concrete of `cyberpunk/concrete-monolith/mid#native-cast` laid as 2.4 x 1.2 m
 * formwork panels, with the board imprint of the forms, recessed panel joints,
 * a grid of tie holes (some plugged with paler mortar), rust-brown and dark
 * water stains running down from the holes and joints, efflorescence under the
 * joints and a few smoother patch repairs. One 2.4 m square tile holds a panel
 * across and two up, so the joints and tie holes repeat as built while the
 * stains, plugs and patches differ panel to panel.
 *
 *   node scripts/author-cast-panel.mjs
 *
 * Writes themes/cyberpunk/assets/concrete-monolith/poor/cast-panel/ and points
 * `cyberpunk/concrete-monolith/poor#native-cast` (the field of the poor kit
 * plans' facades) at it, at 2.4 m a repeat.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..' );
const N = 1024, METRES = 2.4, PX = N / METRES;
const source = path.join( root, 'themes/cyberpunk/assets/concrete-monolith/mid/native-cast' );
const out = path.join( root, 'themes/cyberpunk/assets/concrete-monolith/poor/cast-panel' );
fs.mkdirSync( out, { recursive: true } );

// A small deterministic generator, so the stains land in the same places on every run.
let seed = 0x2f6b9e1d;
const random = () => ( seed = Math.imul( seed ^ ( seed >>> 15 ), 0x2c1b3c6d ) >>> 0, ( ( seed ^ ( seed >>> 12 ) ) >>> 0 ) / 4294967296 );
const clamp = ( x, lo = 0, hi = 1 ) => Math.max( lo, Math.min( hi, x ) );
const smooth = ( a, b, x ) => { const t = clamp( ( x - a ) / ( b - a ) ); return t * t * ( 3 - 2 * t ); };

async function read( name, channels ) {

	// The source tiles 4 m; it is read at the same metres here, wrapping.
	const { data, info } = await sharp( path.join( source, `${name}.png` ) ).removeAlpha().raw().toBuffer( { resolveWithObject: true } );
	const scale = info.width / 4;
	return ( x, y, c ) => {

		const sx = Math.floor( ( x / PX ) * scale ) % info.width, sy = Math.floor( ( y / PX ) * scale ) % info.height;
		return data[ ( sy * info.width + sx ) * info.channels + Math.min( c, info.channels - 1 ) ];

	};

}

const base = await read( 'basecolor', 3 ), baseRough = await read( 'roughness', 1 ), baseAo = await read( 'ao', 1 );
const height = new Float32Array( N * N ), tone = new Float32Array( N * N ).fill( 1 ), rough = new Float32Array( N * N ), rust = new Float32Array( N * N ), white = new Float32Array( N * N );

// Joints: across the tile at 0 and 1.2 m, and up its side, a 12 mm groove.
const groove = ( d ) => smooth( 0.009, 0.0035, Math.abs( d ) );
for ( let y = 0; y < N; y ++ ) for ( let x = 0; x < N; x ++ ) {

	const mx = x / PX, my = y / PX;
	const dy = Math.min( my % 1.2, 1.2 - ( my % 1.2 ) ), dx = Math.min( mx, METRES - mx );
	const g = Math.max( groove( dx ), groove( dy ) );
	const i = y * N + x;
	height[ i ] -= g;
	tone[ i ] *= 1 - g * 0.45;
	// The board imprint of the forms, 150 mm boards across each panel.
	const board = Math.floor( ( my % 1.2 ) / 0.15 );
	tone[ i ] *= 1 + ( ( board * 2654435761 >>> 0 ) % 1000 / 1000 - 0.5 ) * 0.04;

}

// Tie holes: 0.3, 0.9, 1.5, 2.1 m across and 0.3, 0.9 m up each panel.
const holes = [];
for ( const panel of [ 0, 1 ] ) for ( const hx of [ 0.3, 0.9, 1.5, 2.1 ] ) for ( const hy of [ 0.3, 0.9 ] ) holes.push( [ hx, panel * 1.2 + hy ] );
for ( const [ hx, hy ] of holes ) {

	const plugged = random() < 0.4, stain = random(), rusty = random() < 0.35;
	const length = 0.15 + stain * 0.65, width = 0.025 + random() * 0.035;
	for ( let y = Math.floor( ( hy - 0.03 ) * PX ); y < Math.min( N, ( hy + length + 0.05 ) * PX ); y ++ ) for ( let x = Math.floor( ( hx - 0.08 ) * PX ); x < ( hx + 0.08 ) * PX; x ++ ) {

		const wx = ( x + N ) % N, wy = ( y + N ) % N, i = wy * N + wx;
		const mx = x / PX - hx, my = y / PX - hy, r = Math.hypot( mx, my );
		// The hole, or its pale mortar plug.
		if ( r < 0.032 ) {

			if ( plugged ) { tone[ i ] *= 1.12; height[ i ] += 0.2; rough[ i ] -= 0.05; }
			else if ( r < 0.015 ) { tone[ i ] *= 0.35; height[ i ] -= 1.4; }
			else { tone[ i ] *= 0.85; height[ i ] -= 0.3; }

		}
		// Water runs down from it, narrowing and fading as it goes.
		if ( my > 0.012 && my < length ) {

			const along = my / length;
			const spread = width * ( 1 - along * 0.6 ) * ( 0.8 + 0.4 * Math.sin( my * 37 + hx * 11 ) );
			const streak = smooth( spread, spread * 0.25, Math.abs( mx + Math.sin( my * 9 + hx ) * 0.006 ) ) * ( 1 - along ) * ( 0.5 + stain * 0.5 );
			tone[ i ] *= 1 - streak * 0.32;
			rough[ i ] -= streak * 0.05;
			if ( rusty ) rust[ i ] = Math.max( rust[ i ], streak * 0.8 );

		}

	}

}

// Runoff from the horizontal joints: dark streaks and white efflorescence hanging below them.
for ( const jy of [ 0, 1.2 ] ) {

	for ( let k = 0; k < 14; k ++ ) {

		const sx = random() * METRES, length = 0.1 + random() * 0.55, width = 0.02 + random() * 0.05, salt = random() < 0.4;
		for ( let y = Math.floor( jy * PX ); y < ( jy + length ) * PX; y ++ ) for ( let x = Math.floor( ( sx - width * 2 ) * PX ); x < ( sx + width * 2 ) * PX; x ++ ) {

			const wx = ( x + N ) % N, wy = ( y + N ) % N, i = wy * N + wx;
			const along = ( y / PX - jy ) / length;
			const d = Math.abs( x / PX - sx );
			const streak = smooth( width, width * 0.2, d ) * ( 1 - along );
			if ( salt ) white[ i ] = Math.max( white[ i ], streak * 0.55 );
			else tone[ i ] *= 1 - streak * 0.28;

		}

	}

}

// Patch repairs: smoother mortar trowelled over spalls, a little proud, paler or darker.
for ( let k = 0; k < 3; k ++ ) {

	const px = 0.2 + random() * 1.8, py = 0.15 + random() * 1.9, w = 0.18 + random() * 0.35, h = 0.12 + random() * 0.3;
	const shade = random() < 0.5 ? 1.1 : 0.9, turn = ( random() - 0.5 ) * 0.25;
	for ( let y = Math.floor( py * PX ); y < ( py + h ) * PX; y ++ ) for ( let x = Math.floor( px * PX ); x < ( px + w ) * PX; x ++ ) {

		const lx = x / PX - px - ( y / PX - py ) * turn;
		if ( lx < 0 || lx > w ) continue;
		const i = ( ( y + N ) % N ) * N + ( x + N ) % N;
		tone[ i ] *= shade;
		height[ i ] += 0.15;
		rough[ i ] -= 0.08;

	}

}

const color = Buffer.alloc( N * N * 3 ), normal = Buffer.alloc( N * N * 3 ), roughness = Buffer.alloc( N * N ), ao = Buffer.alloc( N * N ), metal = Buffer.alloc( N * N );
for ( let y = 0; y < N; y ++ ) for ( let x = 0; x < N; x ++ ) {

	const i = y * N + x;
	const r = base( x, y, 0 ) * tone[ i ], g = base( x, y, 1 ) * tone[ i ], b = base( x, y, 2 ) * tone[ i ];
	// Rust is a warm brown, efflorescence a chalky white, both over the concrete.
	const mixRust = ( v, target ) => v + ( target - v ) * rust[ i ] * 0.6;
	const mixWhite = ( v ) => v + ( 205 - v ) * white[ i ];
	color[ i * 3 ] = clamp( mixWhite( mixRust( r, 118 ) ), 0, 255 );
	color[ i * 3 + 1 ] = clamp( mixWhite( mixRust( g, 74 ) ), 0, 255 );
	color[ i * 3 + 2 ] = clamp( mixWhite( mixRust( b, 46 ) ), 0, 255 );
	const at = ( xx, yy ) => height[ ( ( yy + N ) % N ) * N + ( xx + N ) % N ];
	const nx = ( at( x - 1, y ) - at( x + 1, y ) ) * 1.6, ny = ( at( x, y + 1 ) - at( x, y - 1 ) ) * 1.6;
	const length = Math.hypot( nx, ny, 1 );
	normal[ i * 3 ] = Math.round( ( nx / length * 0.5 + 0.5 ) * 255 );
	normal[ i * 3 + 1 ] = Math.round( ( ny / length * 0.5 + 0.5 ) * 255 );
	normal[ i * 3 + 2 ] = Math.round( ( 1 / length * 0.5 + 0.5 ) * 255 );
	roughness[ i ] = clamp( baseRough( x, y, 0 ) / 255 + rough[ i ], 0.45, 1 ) * 255;
	ao[ i ] = clamp( baseAo( x, y, 0 ) / 255 * ( 1 + Math.min( 0, height[ i ] ) * 0.35 ), 0, 1 ) * 255;

}
const raw = ( channels ) => ( { raw: { width: N, height: N, channels } } );
await sharp( color, raw( 3 ) ).png( { compressionLevel: 9 } ).toFile( path.join( out, 'basecolor.png' ) );
await sharp( normal, raw( 3 ) ).png( { compressionLevel: 9 } ).toFile( path.join( out, 'normal.png' ) );
await sharp( roughness, raw( 1 ) ).png( { compressionLevel: 9 } ).toFile( path.join( out, 'roughness.png' ) );
await sharp( ao, raw( 1 ) ).png( { compressionLevel: 9 } ).toFile( path.join( out, 'ao.png' ) );
await sharp( metal, raw( 1 ) ).png( { compressionLevel: 9 } ).toFile( path.join( out, 'metallic.png' ) );

const themeFile = path.join( root, 'themes/cyberpunk/theme.json' );
const theme = JSON.parse( fs.readFileSync( themeFile, 'utf8' ) );
const variant = theme.entries[ 'cyberpunk/concrete-monolith/poor' ].variants.find( ( entry ) => entry.id === 'native-cast' );
variant.class = 'prepared';
variant.maps = Object.fromEntries( [ 'basecolor', 'normal', 'roughness', 'ao', 'metallic' ].map( ( map ) => [ map, `assets/concrete-monolith/poor/cast-panel/${map}.png` ] ) );
delete variant.ktx2;
variant.tiling = { worldSize: [ METRES, METRES ] };
fs.writeFileSync( themeFile, `${JSON.stringify( theme, null, 2 )}\n` );
console.log( JSON.stringify( { variant: 'cyberpunk/concrete-monolith/poor#native-cast', tile: METRES, holes: holes.length } ) );
