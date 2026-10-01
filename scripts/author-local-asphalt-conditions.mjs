/** Local condition deltas on an invariant joint-free asphalt background. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stage = path.join(root, 'out/asphalt-authoring/revision-2'), themes = path.join(stage, 'themes');
fs.mkdirSync(stage,{recursive:true});
for(const d of ['raw','baseline'])fs.cpSync(path.join(root,'sources/street-variants/asphalt/revision-2',d),path.join(stage,d),{recursive:true});
assert( themes.endsWith( '/out/asphalt-authoring/revision-2/themes' ) );
const key = 'cyberpunk/street-asphalt/mid', N = 1024, COUNT = N * N;
const channels = [ 'basecolor', 'normal', 'roughness', 'metallic', 'height', 'ao' ];
const clip = ( v, a = 0, b = 1 ) => Math.max( a, Math.min( b, v ) );
const smooth = ( a, b, v ) => { const t = clip( ( v - a ) / ( b - a ) ); return t * t * ( 3 - 2 * t ); };
const mix = ( a, b, t ) => a + ( b - a ) * t;
const field = () => new Float32Array( COUNT );
function blur( input, radius ) {
  const tmp = field(), out = field(), span = 2 * radius + 1;
  for ( let y = 0; y < N; y++ ) {
    let sum = 0;
    for ( let x = -radius; x <= radius; x++ ) sum += input[ y * N + ( x + N ) % N ];
    for ( let x = 0; x < N; x++ ) {
      tmp[ y * N + x ] = sum / span;
      sum += input[ y * N + ( x + radius + 1 ) % N ] - input[ y * N + ( x - radius + N ) % N ];
    }
  }
  for ( let x = 0; x < N; x++ ) {
    let sum = 0;
    for ( let y = -radius; y <= radius; y++ ) sum += tmp[ ( y + N ) % N * N + x ];
    for ( let y = 0; y < N; y++ ) {
      out[ y * N + x ] = sum / span;
      sum += tmp[ ( y + radius + 1 ) % N * N + x ] - tmp[ ( y - radius + N ) % N * N + x ];
    }
  }
  return out;
}
async function readMap( file, scalar = false ) {
  const image = sharp( file );
  return new Uint8Array( await ( scalar ? image.greyscale() : image.removeAlpha() ).raw().toBuffer() );
}
async function save( file, data, count = 1 ) {
  fs.mkdirSync( path.dirname( file ), { recursive: true } );
  await sharp( Buffer.from( data ), { raw: { width: N, height: N, channels: count } } ).png().toFile( file );
}
async function source( id ) {
  const file = path.join( stage, 'raw', `${id}.png` ), metadata = await sharp( file ).metadata();
  assert.deepEqual( [ metadata.width, metadata.height ], [ 1254, 1254 ] );
  const rgb = new Uint8Array( await sharp( file ).removeAlpha().resize( N, N, { kernel: 'lanczos3' } ).raw().toBuffer() );
  const lum = field();
  for ( let i = 0; i < COUNT; i++ ) lum[ i ] = ( rgb[ 3 * i ] * .2126 + rgb[ 3 * i + 1 ] * .7152 + rgb[ 3 * i + 2 ] * .0722 ) / 255;
  return { rgb, lum, fine: blur( lum, 2 ), soft: blur( blur( lum, 4 ), 4 ), context: blur( blur( lum, 45 ), 45 ) };
}
function ellipse( x, y, cx, cy, rx, ry ) {
  return 1 - smooth( .75, 1, Math.hypot( ( x - cx ) / rx, ( y - cy ) / ry ) );
}
function polygonDistance( x, y, points ) {
  let inside = false, distance = Infinity;
  for ( let j = 0, k = points.length - 1; j < points.length; k = j++ ) {
    const [ ax, ay ] = points[ k ], [ bx, by ] = points[ j ];
    if ( ( ay > y ) !== ( by > y ) && x < ( bx - ax ) * ( y - ay ) / ( by - ay ) + ax ) inside = !inside;
    const dx = bx - ax, dy = by - ay, t = clip( ( ( x - ax ) * dx + ( y - ay ) * dy ) / ( dx * dx + dy * dy ) );
    distance = Math.min( distance, Math.hypot( x - ax - t * dx, y - ay - t * dy ) );
  }
  return inside ? distance : -distance;
}
const repairPolygons = {
  'repair-a': [ [ 148, 1003 ], [ 302, 750 ], [ 338, 748 ], [ 350, 687 ], [ 654, 626 ], [ 643, 1007 ] ],
  'repair-b': [ [ 616, 313 ], [ 899, 233 ], [ 1020, 531 ], [ 807, 584 ], [ 765, 511 ], [ 696, 531 ] ]
};
const baseline = {};
for ( const c of channels ) baseline[ c ] = await readMap( path.join( stage, 'baseline/clean', `${c}.png` ), ![ 'basecolor', 'normal' ].includes( c ) );
const sources = {};
for ( const id of [ 'stain-a', 'stain-b', 'repair-a', 'repair-b' ] ) sources[ id ] = await source( id );
const crack = await readMap( path.join( stage, 'baseline/cracked-condition.png' ), true );
const states = [
  { id: 'asphalt-clean-2', condition: 'clean', source: null, description: 'Unchanged clean control from revision 1' },
  { id: 'asphalt-stained-2', condition: 'stained', source: 'stain-a', description: 'Broken dry traffic rub in the lower-left interior' },
  { id: 'asphalt-stained-3', condition: 'stained', source: 'stain-b', description: 'Separate narrow old oily residue wisps upper-right and small lower-left trace' },
  { id: 'asphalt-cracked-2', condition: 'cracked', source: null, description: 'Localized thin source-derived hairline fissure on intact asphalt' },
  { id: 'asphalt-patched-2', condition: 'patched', source: 'repair-a', description: 'Flush darker angular notched repair, lower-left interior, fine compacted binder' },
  { id: 'asphalt-patched-3', condition: 'patched', source: 'repair-b', description: 'Flush older lighter elongated angular repair, upper-right interior, dry weathered binder' }
];
const report = { authoredAt: new Date().toISOString(), key, database: themes, worldSize: [ 2, 2 ], resolution: [ N, N ],
  method: 'All six channels copy the clean baseline over the entire field. Only localized condition masks modify it. No cell-edge distance blend exists.',
  heightEncoding: { zero: .5, metresPerUnit: .005, repair: 'flush; local fine grain only, no macro displacement' },
  variants: [], commands: [], status: 'Technical candidates; actual repeated-surface PBR review still required' };
for ( const state of states ) {
  const s = sources[ state.source ], maps = Object.fromEntries( channels.map( c => [ c, baseline[ c ].slice() ] ) );
  const mask = new Uint8Array( COUNT ), support = new Uint8Array( COUNT ), deltaHeight = field();
  for ( let y = 0; y < N; y++ ) for ( let x = 0; x < N; x++ ) {
    const i = y * N + x, rawX = x * 1254 / N, rawY = y * 1254 / N;
    let mark = 0;
    if ( state.source === 'stain-a' ) {
      const roi = Math.max( ellipse( rawX, rawY, 400, 860, 285, 285 ), ellipse( rawX, rawY, 550, 780, 155, 155 ) );
      mark = smooth( .009, .053, s.context[ i ] - s.soft[ i ] ) * roi;
    } else if ( state.source === 'stain-b' ) {
      const roi = Math.max( ellipse( rawX, rawY, 855, 438, 255, 245 ), ellipse( rawX, rawY, 280, 845, 130, 120 ) );
      mark = smooth( .010, .049, s.context[ i ] - s.soft[ i ] ) * roi;
    } else if ( state.condition === 'cracked' ) {
      mark = crack[ i ] / 255;
    } else if ( state.condition === 'patched' ) {
      // The actual source's angular outline supplies the footprint. Grain-sized
      // raggedness changes the contact by under 5 mm, without rounding corners.
      const signed = polygonDistance( rawX, rawY, repairPolygons[ state.source ] );
      const ragged = clip( ( s.lum[ i ] - s.fine[ i ] ) * 24, -2.5, 2.5 );
      mark = smooth( -2, 2, signed + ragged );
    }
    mask[ i ] = Math.round( clip( mark ) * 255 );
    mark = mask[ i ] / 255;
    if ( !mark ) continue;
    const bH = ( baseline.height[ i ] / 255 - .5 ) * .005;
    let r = baseline.roughness[ i ] / 255, colourDelta = 0;
    if ( state.condition === 'stained' ) {
      const oil = state.source === 'stain-b';
      r = mix( r, oil ? .50 : .705, mark );
      colourDelta = -( oil ? 18 : 13 ) * mark;
      deltaHeight[ i ] = -bH * mark * ( oil ? .35 : .18 );
    } else if ( state.condition === 'cracked' ) {
      r = mix( r, .91, mark ); colourDelta = -43 * mark;
      deltaHeight[ i ] = -.0009 * mark;
      maps.ao[ i ] = Math.round( baseline.ao[ i ] * ( 1 - .18 * mark ) );
    } else if ( state.condition === 'patched' ) {
      const older = state.source === 'repair-b';
      const grain = clip( ( s.lum[ i ] - s.fine[ i ] ) * .3, -.035, .035 );
      r = mix( r, ( older ? .825 : .77 ) + grain, mark );
      colourDelta = ( ( older ? 5 : -8 ) + clip( ( s.lum[ i ] - s.soft[ i ] ) * 30, -4, 4 ) ) * mark;
      const ownFine = clip( ( s.lum[ i ] - s.fine[ i ] ) * .0012, -.00018, .00018 );
      deltaHeight[ i ] = ( ownFine - bH ) * mark * .3;
    }
    for ( let c = 0; c < 3; c++ ) maps.basecolor[ i * 3 + c ] = Math.round( clip( baseline.basecolor[ i * 3 + c ] + colourDelta, 0, 255 ) );
    maps.roughness[ i ] = Math.round( clip( r ) * 255 );
    maps.height[ i ] = Math.round( clip( baseline.height[ i ] / 255 + deltaHeight[ i ] / .005 ) * 255 );
  }
  for ( let y = 0; y < N; y++ ) for ( let x = 0; x < N; x++ ) {
    const i = y * N + x, left = y * N + ( x - 1 + N ) % N, right = y * N + ( x + 1 ) % N;
    const up = ( y - 1 + N ) % N * N + x, down = ( y + 1 ) % N * N + x;
    if ( mask[ i ] || mask[ left ] || mask[ right ] || mask[ up ] || mask[ down ] ) support[ i ] = 255;
    const dx = ( deltaHeight[ right ] - deltaHeight[ left ] ) / ( 4 / N ), dy = ( deltaHeight[ down ] - deltaHeight[ up ] ) / ( 4 / N );
    if ( !dx && !dy ) continue;
    // Add only the physical height delta gradient to the encoded baseline
    // tangent slope. Recomputing the entire normal would change clean regions.
    const nx = baseline.normal[ i * 3 ] / 127.5 - 1, ny = baseline.normal[ i * 3 + 1 ] / 127.5 - 1, nz = baseline.normal[ i * 3 + 2 ] / 127.5 - 1;
    const vx = nx / nz - dx, vy = ny / nz + dy, inverse = 1 / Math.hypot( vx, vy, 1 );
    maps.normal[ i * 3 ] = Math.round( ( vx * inverse * .5 + .5 ) * 255 );
    maps.normal[ i * 3 + 1 ] = Math.round( ( vy * inverse * .5 + .5 ) * 255 );
    maps.normal[ i * 3 + 2 ] = Math.round( ( inverse * .5 + .5 ) * 255 );
  }
  const dir = path.join( stage, 'prepared', state.id ), sourceMaps = {};
  for ( const c of channels ) {
    const file = path.join( dir, `${c}.png` );
    await save( file, maps[ c ], [ 'basecolor', 'normal' ].includes( c ) ? 3 : 1 ); sourceMaps[ c ] = file;
  }
  await save( path.join( stage, 'masks', `${state.id}-condition.png` ), mask );
  await save( path.join( stage, 'masks', `${state.id}-support.png` ), support );
  const request = { key, variantId: state.id, alignment: 'tile', tiling: { worldSize: [ 2, 2 ] }, resolution: [ N, N ],
    description: `${state.description}; continuous joint-free fine asphalt, localized condition only, invariant clean background, revision 2 candidate`,
    physical: { roughnessFactor: 1, metallicFactor: 0 }, layout: { family: 'continuous', origin: [ 0, 0 ], orientation: 'isotropic' }, sourceMaps,
    append: fs.existsSync( path.join( themes, 'cyberpunk/theme.json' ) ), overwrite: true };
  const requestPath = path.join( stage, 'requests', `${state.id}.json` ); fs.mkdirSync( path.dirname( requestPath ), { recursive: true } );
  fs.writeFileSync( requestPath, JSON.stringify( request, null, 2 ) + '\n' );
  const importPath = path.join( stage, 'import-requests', `${state.id}.json` ); fs.mkdirSync( path.dirname( importPath ), { recursive: true } );
  fs.writeFileSync( importPath, JSON.stringify( { ...request, append: true }, null, 2 ) + '\n' );
  const args = [ path.join( root, 'dist/cli/pbrforge.js' ), 'create', requestPath, '--native', '--themes', themes ];
  const made = spawnSync( process.execPath, args, { cwd: root, encoding: 'utf8' } );
  report.commands.push( { command: [ process.execPath, ...args ], exitCode: made.status, stdout: made.stdout, stderr: made.stderr } );
  if ( made.status !== 0 ) { fs.writeFileSync( path.join( stage, 'author-report.json' ), JSON.stringify( report, null, 2 ) ); throw Error( made.stdout + made.stderr ); }
  const found = spawnSync( process.execPath, [ path.join( root, 'dist/cli/pbrforge.js' ), 'resolve', key, '--themes', themes ], { encoding: 'utf8' } );
  assert.equal( found.status, 0, found.stdout + found.stderr );
  report.variants.push( { ...state, sourceMaps, request: requestPath, conditionFraction: mask.filter( n => n > 64 ).length / COUNT,
    supportFraction: support.filter( n => n > 0 ).length / COUNT,
    resolvedVariant: JSON.parse( found.stdout ).data.entry.variants.find( v => v.id === state.id ) } );
  console.log( `${state.id}: native import and resolve passed` );
}
fs.writeFileSync( path.join( stage, 'author-report.json' ), JSON.stringify( report, null, 2 ) + '\n' );
