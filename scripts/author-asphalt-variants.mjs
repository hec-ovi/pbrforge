/** Four distinct asphalt condition sets in this staging database only. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stage = path.join(root, 'out/asphalt-authoring');
fs.mkdirSync(stage, {recursive:true});
fs.cpSync(path.join(root, 'sources/street-variants/asphalt/raw'), path.join(stage, 'raw'), {recursive:true});
const themes = path.join( stage, 'themes' ), key = 'cyberpunk/street-asphalt/mid';
assert( themes.endsWith( '/out/asphalt-authoring/themes' ) );
const N = 1024, COUNT = N * N, WORLD = [ 2, 2 ], states = [ 'clean', 'stained', 'cracked', 'patched' ];
const target = [ 74, 76, 76 ];
const clip = ( x, a = 0, b = 1 ) => Math.max( a, Math.min( b, x ) );
const smooth = ( a, b, x ) => { const t = clip( ( x - a ) / ( b - a ) ); return t * t * ( 3 - 2 * t ); };
const mix = ( a, b, t ) => a + ( b - a ) * t;
const field = x => new Float32Array( COUNT ).fill( x );
const mean = x => x.reduce( ( a, b ) => a + b, 0 ) / x.length;
function blur( input, radius ) {
  const tmp = field( 0 ), out = field( 0 ), width = 2 * radius + 1;
  for ( let y = 0; y < N; y++ ) {
    let sum = 0; for ( let j = -radius; j <= radius; j++ ) sum += input[ y * N + ( j + N ) % N ];
    for ( let x = 0; x < N; x++ ) { tmp[ y * N + x ] = sum / width; sum += input[ y * N + ( x + radius + 1 ) % N ] - input[ y * N + ( x - radius + N ) % N ]; }
  }
  for ( let x = 0; x < N; x++ ) {
    let sum = 0; for ( let j = -radius; j <= radius; j++ ) sum += tmp[ ( j + N ) % N * N + x ];
    for ( let y = 0; y < N; y++ ) { out[ y * N + x ] = sum / width; sum += tmp[ ( y + radius + 1 ) % N * N + x ] - tmp[ ( y - radius + N ) % N * N + x ]; }
  }
  return out;
}
function closeEdges( data, channels = 1 ) {
  for ( let y = 0; y < N; y++ ) for ( let k = 0; k < channels; k++ ) {
    const a = y * N * channels + k, b = ( y * N + N - 1 ) * channels + k; data[ a ] = data[ b ] = ( data[ a ] + data[ b ] ) / 2;
  }
  for ( let x = 0; x < N; x++ ) for ( let k = 0; k < channels; k++ ) {
    const a = x * channels + k, b = ( ( N - 1 ) * N + x ) * channels + k; data[ a ] = data[ b ] = ( data[ a ] + data[ b ] ) / 2;
  }
}
function periodic( data ) {
  for ( let axis = 0; axis < 2; axis++ ) {
    const source = data.slice();
    for ( let y = 0; y < N; y++ ) for ( let x = 0; x < N; x++ ) {
      const p = axis ? y : x, d = Math.min( p, N - 1 - p ); if ( d >= 100 ) continue;
      const amount = 1 - smooth( 0, 100, d ), ox = axis ? x : ( x + N / 2 ) % N, oy = axis ? ( y + N / 2 ) % N : y;
      for ( let k = 0; k < 3; k++ ) data[ ( y * N + x ) * 3 + k ] = mix( source[ ( y * N + x ) * 3 + k ], source[ ( oy * N + ox ) * 3 + k ], amount );
    }
  }
  closeEdges( data, 3 );
}
async function read( state ) {
  const file = path.join( stage, 'raw', `${state}.png` ), metadata = await sharp( file ).metadata();
  assert( metadata.width >= N && metadata.height >= N && metadata.width === metadata.height, 'Do not upscale or stretch source' );
  const rgb = new Uint8Array( await sharp( file ).removeAlpha().resize( N, N, { kernel: 'lanczos3' } ).raw().toBuffer() );
  periodic( rgb );
  const lum = field( 0 ), border = [ [], [], [] ];
  for ( let y = 0; y < N; y++ ) for ( let x = 0; x < N; x++ ) {
    const i = y * N + x; lum[ i ] = ( rgb[ i * 3 ] * .2126 + rgb[ i * 3 + 1 ] * .7152 + rgb[ i * 3 + 2 ] * .0722 ) / 255;
    if ( Math.min( x, y, N - 1 - x, N - 1 - y ) < 100 && x % 4 === 0 && y % 4 === 0 ) for ( let k = 0; k < 3; k++ ) border[ k ].push( rgb[ i * 3 + k ] );
  }
  const pigment = border.map( values => values.sort( ( a, b ) => a - b )[ Math.floor( values.length / 2 ) ] );
  return { rgb, lum, fine: blur( lum, 2 ), soft: blur( blur( lum, 10 ), 10 ), pigment,
    baseline: ( pigment[ 0 ] * .2126 + pigment[ 1 ] * .7152 + pigment[ 2 ] * .0722 ) / 255,
    rawDimensions: [ metadata.width, metadata.height ] };
}
async function png( file, values, channels = 1 ) {
  const bytes = channels === 1 ? Buffer.alloc( values.length ) : Buffer.from( values );
  if ( channels === 1 ) for ( let i = 0; i < values.length; i++ ) bytes[ i ] = Math.round( clip( values[ i ] ) * 255 );
  await sharp( bytes, { raw: { width: N, height: N, channels } } ).png().toFile( file );
}
const fissures = [
  [ [ 340, 384 ], [ 368, 428 ], [ 414, 453 ], [ 433, 489 ], [ 449, 514 ], [ 507, 553 ], [ 581, 559 ], [ 628, 580 ], [ 703, 622 ], [ 756, 662 ], [ 775, 703 ], [ 789, 751 ], [ 828, 800 ] ],
  [ [ 756, 662 ], [ 830, 666 ], [ 926, 670 ] ]
].map( line => line.map( point => point.map( v => v / 1254 ) ) );
function distance( u, v ) {
  let found = Infinity;
  for ( const line of fissures ) for ( let j = 1; j < line.length; j++ ) {
    const [ x, y ] = line[ j - 1 ], [ bx, by ] = line[ j ], dx = bx - x, dy = by - y;
    const t = clip( ( ( u - x ) * dx + ( v - y ) * dy ) / ( dx * dx + dy * dy ) );
    found = Math.min( found, Math.hypot( u - x - t * dx, v - y - t * dy ) );
  }
  return found;
}
const sources = {};
for ( const state of states ) sources[ state ] = await read( state );
const shared = sources.clean;
const report = { authoredAt: new Date().toISOString(), key, database: themes, resolution: [ N, N ], worldSize: WORLD,
  heightEncoding: { zero: .5, metresPerUnit: .005, maxFissureDepthMetres: .0011, repair: 'flush; no macro raised/lowered patch height' },
  variants: [], commands: [], status: 'technical candidates only; actual asphalt/parking rendering and four-condition routing pending' };
for ( const state of states ) {
  const s = sources[ state ], base = new Uint8Array( COUNT * 3 ), roughness = field( 0 ), height = field( .5 ), metres = field( 0 ), metallic = field( 0 ), ao = field( 1 ), primary = field( 0 );
  for ( let y = 0; y < N; y++ ) for ( let x = 0; x < N; x++ ) {
    const i = y * N + x, u = x / ( N - 1 ), v = y / ( N - 1 );
    const edgeDistance = Math.min( u, v, 1 - u, 1 - v );
    const interior = smooth( .09, .15, edgeDistance ), own = smooth( .014, .04, edgeDistance );
    const local = s.soft[ i ] - s.baseline, micro = s.lum[ i ] - s.fine[ i ];
    const grain = s.fine[ i ] - s.soft[ i ], pore = smooth( .035, .12, s.fine[ i ] - s.lum[ i ] );
    let mark = 0, reliefScale = 1;
    // Common intact asphalt response: condition changes stay localized. A
    // different whole-image baseline would create a false lighter edge frame.
    let r = .81 + clip( grain * .55 + local * .12, -.045, .045 );
    let h = micro * .0013 + grain * .0009 - pore * .00016;
    if ( state === 'stained' ) {
      mark = smooth( .016, .075, -local ) * interior;
      r = mix( r, .39 + clip( grain * .18, -.02, .02 ), mark );
      reliefScale = 1 - mark * .58;
    } else if ( state === 'cracked' ) {
      const roi = 1 - smooth( .012, .030, distance( u, v ) );
      const darkFissure = 1 - smooth( .10, .18, s.lum[ i ] );
      mark = smooth( .025, .085, s.fine[ i ] - s.lum[ i ] ) * darkFissure * roi * interior;
      r = mix( r, .91, mark ); h -= mark * .0009;
    } else if ( state === 'patched' ) {
      const dx = Math.abs( ( u - .565 ) / .345 ), dy = Math.abs( ( v - .53 ) / .25 );
      const roi = 1 - smooth( .85, 1.12, Math.pow( Math.pow( dx, 7 ) + Math.pow( dy, 7 ), 1 / 7 ) );
      mark = smooth( .013, .065, -local ) * roi * interior;
      r = mix( r, .655 + clip( grain * .28, -.03, .03 ), mark );
      reliefScale = 1 - mark * .28; // finer compaction, no height step
    }
    primary[ i ] = mark;
    const commonMicro = shared.lum[ i ] - shared.fine[ i ], commonGrain = shared.fine[ i ] - shared.soft[ i ];
    const commonPore = smooth( .035, .12, shared.fine[ i ] - shared.lum[ i ] );
    const commonH = commonMicro * .0013 + commonGrain * .0009 - commonPore * .00016;
    h = mix( commonH, h * reliefScale, own );
    metres[ i ] = clip( h, -.0011, .00055 ); height[ i ] = .5 + metres[ i ] / .005;
    const commonR = .81 + clip( commonGrain * .55 + ( shared.soft[ i ] - shared.baseline ) * .12, -.045, .045 );
    roughness[ i ] = clip( mix( commonR, r, own ), .34, .94 );
    ao[ i ] = clip( 1 - mix( commonPore, pore, own ) * .07 - ( state === 'cracked' ? mark * .18 : 0 ), .68, 1 );
    for ( let k = 0; k < 3; k++ ) {
      // Preserve genuine diffuse condition shapes but suppress the raw scan's
      // over-bright mineral speckles. No fake highlight or shadow is authored.
      const detail = ( s.rgb[ i * 3 + k ] - s.pigment[ k ] ) * .68 - micro * 255 * .35;
      const commonDetail = ( shared.rgb[ i * 3 + k ] - shared.pigment[ k ] ) * .68 - commonMicro * 255 * .35;
      base[ i * 3 + k ] = Math.round( clip( target[ k ] + mix( commonDetail, detail, own ), 0, 255 ) );
    }
  }
  closeEdges( base, 3 ); closeEdges( roughness ); closeEdges( metres ); closeEdges( height ); closeEdges( ao ); closeEdges( primary );
  const normal = new Uint8Array( COUNT * 3 );
  for ( let y = 0; y < N; y++ ) for ( let x = 0; x < N; x++ ) {
    const i = y * N + x, dx = ( metres[ y * N + ( x + 1 ) % N ] - metres[ y * N + ( x - 1 + N ) % N ] ) / ( 4 / N );
    const dy = ( metres[ ( y + 1 ) % N * N + x ] - metres[ ( y - 1 + N ) % N * N + x ] ) / ( 4 / N );
    const inverse = 1 / Math.hypot( dx, dy, 1 ); normal[ i * 3 ] = Math.round( ( -dx * inverse * .5 + .5 ) * 255 ); normal[ i * 3 + 1 ] = Math.round( ( dy * inverse * .5 + .5 ) * 255 ); normal[ i * 3 + 2 ] = Math.round( ( inverse * .5 + .5 ) * 255 );
  }
  closeEdges( normal, 3 );
  // Averaging opposite-edge normals can shorten vectors even when their
  // tangents wrap. Renormalize after closing, retaining identical edge bytes.
  for ( let i = 0; i < COUNT; i++ ) {
    const x = normal[ i * 3 ] / 127.5 - 1, y = normal[ i * 3 + 1 ] / 127.5 - 1, z = normal[ i * 3 + 2 ] / 127.5 - 1;
    const inverse = 1 / Math.hypot( x, y, z );
    normal[ i * 3 ] = Math.round( ( x * inverse * .5 + .5 ) * 255 );
    normal[ i * 3 + 1 ] = Math.round( ( y * inverse * .5 + .5 ) * 255 );
    normal[ i * 3 + 2 ] = Math.round( ( z * inverse * .5 + .5 ) * 255 );
  }
  const dir = path.join( stage, 'prepared', state ); fs.mkdirSync( dir, { recursive: true } );
  const sourceMaps = {};
  for ( const [ channel, values ] of Object.entries( { basecolor: base, normal, roughness, metallic, height, ao } ) ) {
    const file = path.join( dir, `${channel}.png` ); await png( file, values, [ 'basecolor', 'normal' ].includes( channel ) ? 3 : 1 ); sourceMaps[ channel ] = file;
  }
  const masks = path.join( stage, 'masks' ); fs.mkdirSync( masks, { recursive: true } ); await png( path.join( masks, `${state}-condition.png` ), primary );
  const variantId = `asphalt-${state}-1`;
  const request = { key, variantId, alignment: 'tile', tiling: { worldSize: WORLD }, resolution: [ N, N ],
    description: `Fine dense asphalt, ${state} condition; distinct generated photographic source and coordinated response, joint-free continuous edges; isolated candidate`,
    physical: { roughnessFactor: 1, metallicFactor: 0 }, layout: { family: 'continuous', origin: [ 0, 0 ], orientation: 'isotropic' }, sourceMaps,
    append: fs.existsSync( path.join( themes, 'cyberpunk/theme.json' ) ), overwrite: true };
  const file = path.join( stage, `${state}-request.json` ); fs.writeFileSync( file, JSON.stringify( request, null, 2 ) + '\n' );
  const args = [ path.join( root, 'dist/cli/pbrforge.js' ), 'create', file, '--native', '--themes', themes ];
  const made = spawnSync( process.execPath, args, { cwd: root, encoding: 'utf8' } );
  report.commands.push( { command: [ process.execPath, ...args ], exitCode: made.status, stdout: made.stdout, stderr: made.stderr } );
  if ( made.status !== 0 ) { fs.writeFileSync( path.join( stage, 'author-report.json' ), JSON.stringify( report, null, 2 ) ); throw Error( made.stdout + made.stderr ); }
  const found = spawnSync( process.execPath, [ path.join( root, 'dist/cli/pbrforge.js' ), 'resolve', key, '--themes', themes ], { encoding: 'utf8' } );
  assert.equal( found.status, 0, found.stdout + found.stderr );
  report.variants.push( { id: variantId, state, sourceSize: s.rawDimensions, maps: sourceMaps, sourcePigmentMedian: s.pigment,
    roughnessMean: mean( roughness ), conditionCoverageAboveQuarter: primary.filter( p => p > .25 ).length / COUNT,
    resolvedVariant: JSON.parse( found.stdout ).data.entry.variants.find( v => v.id === variantId ) } );
  console.log( `${variantId}: native import and resolve passed` );
}
fs.writeFileSync( path.join( stage, 'author-report.json' ), JSON.stringify( report, null, 2 ) + '\n' );
