/** Supplements v1 without changing its files or any root catalog/binding. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const v1 = path.join(root, 'out/red-authoring'), stage = path.join(v1, 'revision-2');
fs.mkdirSync(stage, {recursive:true});
fs.cpSync(path.join(root, 'sources/street-variants/red/revision-2/raw'), path.join(stage, 'raw'), {recursive:true});
if (!fs.existsSync(path.join(v1, 'prepared/clean/basecolor.png'))) {
 const prepared=spawnSync(process.execPath, [path.join(root, 'scripts/author-red-coated-variants.mjs')], {cwd:root, encoding:'utf8'});
 if(prepared.status!==0) throw Error(prepared.stdout+prepared.stderr);
}
const themes = path.join( stage, 'themes' ), key = 'cyberpunk/street-coated/mid';
assert( themes.endsWith( '/out/red-authoring/revision-2/themes' ) );
const N = 1024, COUNT = N * N, WORLD = [ 2, 2 ], pigmentTarget = [ 154, 65, 50 ], substrateTarget = [ 123, 128, 126 ];
const specs = [
  { id: 'red-worn-edge-1', source: 'worn-edge', kind: 'exposed', rotation: 0, paintRoughness: .315 },
  { id: 'red-worn-edge-2', source: 'worn-edge', kind: 'exposed', rotation: 180, paintRoughness: .315 },
  { id: 'red-stained-2', source: 'stained-2', kind: 'stained', rotation: 0, paintRoughness: .345 },
  { id: 'red-patched-2', source: 'edge-repair', kind: 'repair', rotation: 0, paintRoughness: .350 }
];
const clip = ( x, a = 0, b = 1 ) => Math.max( a, Math.min( b, x ) );
const smooth = ( a, b, x ) => { const t = clip( ( x - a ) / ( b - a ) ); return t * t * ( 3 - 2 * t ); };
const mix = ( a, b, t ) => a + ( b - a ) * t;
const field = x => new Float32Array( COUNT ).fill( x );
const median = values => values.sort( ( a, b ) => a - b )[ Math.floor( values.length / 2 ) ];
function blur( input, r ) {
  const tmp = field( 0 ), out = field( 0 ), d = 2 * r + 1;
  for ( let y = 0; y < N; y++ ) {
    let sum = 0; for ( let j = -r; j <= r; j++ ) sum += input[ y * N + ( j + N ) % N ];
    for ( let x = 0; x < N; x++ ) { tmp[ y * N + x ] = sum / d; sum += input[ y * N + ( x + r + 1 ) % N ] - input[ y * N + ( x - r + N ) % N ]; }
  }
  for ( let x = 0; x < N; x++ ) {
    let sum = 0; for ( let j = -r; j <= r; j++ ) sum += tmp[ ( j + N ) % N * N + x ];
    for ( let y = 0; y < N; y++ ) { out[ y * N + x ] = sum / d; sum += tmp[ ( y + r + 1 ) % N * N + x ] - tmp[ ( y - r + N ) % N * N + x ]; }
  }
  return out;
}
function structure( x, y ) {
  const u = x / ( N - 1 ), v = y / ( N - 1 ), edge = Math.min( u, v, 1 - u, 1 - v ) * 2;
  let anchorDistance = Infinity;
  for ( const ax of [ .018, .042, .958, .982 ] ) anchorDistance = Math.min( anchorDistance, Math.hypot( ( u - ax ) * 2, ( v - .06 ) * 2 ) );
  return { edge, anchorDistance, protected: edge < .004 || anchorDistance < .012 };
}
const old = {};
for ( const c of [ 'basecolor', 'normal', 'roughness', 'metallic', 'height', 'ao' ] ) {
  const input = sharp( path.join( v1, 'prepared/clean', `${c}.png` ) ).removeAlpha();
  old[ c ] = await ( [ 'basecolor', 'normal' ].includes( c ) ? input : input.greyscale() ).raw().toBuffer();
}
async function readSource( spec ) {
  const file = path.join( stage, 'raw', `${spec.source}.png` ), m = await sharp( file ).metadata();
  assert( m.width >= N && m.height >= N && m.width === m.height );
  const rgb = await sharp( file ).removeAlpha().rotate( spec.rotation ).resize( N, N, { kernel: 'lanczos3' } ).raw().toBuffer();
  const lum = field( 0 ), chroma = field( 0 ), paint = [ [], [], [] ], greys = [];
  for ( let y = 0; y < N; y++ ) for ( let x = 0; x < N; x++ ) {
    const i = y * N + x, r = rgb[ i * 3 ], g = rgb[ i * 3 + 1 ], b = rgb[ i * 3 + 2 ];
    lum[ i ] = ( r * .2126 + g * .7152 + b * .0722 ) / 255; chroma[ i ] = ( r - ( g + b ) / 2 ) / 255;
    if ( chroma[ i ] > .29 && x > N * .25 && x < N * .75 && y > N * .15 && y < N * .65 && x % 3 === 0 && y % 3 === 0 ) for ( let k = 0; k < 3; k++ ) paint[ k ].push( rgb[ i * 3 + k ] );
    if ( chroma[ i ] < .10 ) greys.push( lum[ i ] * 255 );
  }
  const pigment = paint.map( median );
  return { rgb, lum, chroma, soft: blur( blur( lum, 5 ), 5 ), smoothChroma: blur( blur( chroma, 4 ), 4 ), fine: blur( lum, 2 ), pigment,
    baselineLuma: ( pigment[ 0 ] * .2126 + pigment[ 1 ] * .7152 + pigment[ 2 ] * .0722 ) / 255,
    baselineChroma: ( pigment[ 0 ] - ( pigment[ 1 ] + pigment[ 2 ] ) / 2 ) / 255, greyMedian: greys.length ? median( greys ) : 155,
    rawDimensions: [ m.width, m.height ] };
}
async function save( file, values, channels = 1 ) {
  const bytes = channels === 1 ? Buffer.alloc( values.length ) : Buffer.from( values );
  if ( channels === 1 ) for ( let i = 0; i < values.length; i++ ) bytes[ i ] = Math.round( clip( values[ i ] ) * 255 );
  await sharp( bytes, { raw: { width: N, height: N, channels } } ).png().toFile( file );
}
const report = { authoredAt: new Date().toISOString(), key, database: themes, supplements: path.join( v1, 'themes' ),
  purpose: 'Connected edge substrate exposure, second off-centre stain and angular edge repair; preserve confirmed v1 sheen/pigment baseline.',
  pigmentTarget, substrateTarget, worldSize: WORLD, resolution: [ N, N ], heightEncoding: { zero: .5, metresPerUnit: .008 },
  unchanged: [ 'v1 catalog and maps', 'root catalog and bindings', 'gutter/lane UVs', 'block finish assignment' ],
  structure: 'v1 clean map bytes retained at seam-core and every anchor footprint; source/condition can turn without rotating this frame.',
  variants: [], commands: [], visualAcceptance: false };
for ( const spec of specs ) {
  const s = await readSource( spec );
  const base = new Uint8Array( COUNT * 3 ), roughness = field( 0 ), metres = field( 0 ), height = field( .5 ), metallic = field( 0 ), ao = field( 1 );
  const exposure = field( 0 ), scuff = field( 0 ), repair = field( 0 ), protectedPixels = new Uint8Array( COUNT );
  for ( let y = 0; y < N; y++ ) for ( let x = 0; x < N; x++ ) {
    const i = y * N + x, u = x / ( N - 1 ), v = y / ( N - 1 ), frame = structure( x, y );
    const grain = s.lum[ i ] - s.fine[ i ];
    let loss = spec.kind === 'stained' ? 0 : 1 - smooth( .12, .26, s.chroma[ i ] );
    let rub = 0, oil = 0, patch = 0;
    if ( spec.kind === 'stained' ) {
      rub = smooth( .008, .044, s.baselineChroma - s.smoothChroma[ i ] );
      const upperRight = smooth( .50, .70, u ) * ( 1 - smooth( .30, .50, v ) );
      oil = smooth( .01, .045, s.baselineLuma - s.soft[ i ] ) * upperRight;
    } else if ( spec.kind === 'repair' ) {
      const region = Math.max( smooth( .78 - u * .10, .87 - u * .10, v ), smooth( .83, .96, u ) * smooth( .32, .60, v ) );
      patch = smooth( .006, .029, s.smoothChroma[ i ] - s.baselineChroma ) * region * ( 1 - loss );
      rub = smooth( .015, .05, s.baselineChroma - s.smoothChroma[ i ] ) * region * ( 1 - loss );
    }
    const anchorKeep = smooth( .012, .020, frame.anchorDistance ), seamKeep = smooth( .004, .008, frame.edge );
    const condition = anchorKeep * seamKeep;
    loss *= condition; rub *= condition; oil *= condition; patch *= condition;
    exposure[ i ] = loss; scuff[ i ] = rub; repair[ i ] = patch;
    let r = spec.paintRoughness + clip( ( s.soft[ i ] - s.baselineLuma ) * .16, -.018, .018 );
    r = mix( r, .61, rub ); r = mix( r, .22, oil * .75 );
    r = mix( r, .265, patch );
    const greyRoughness = clip( .73 + ( s.lum[ i ] * 255 - s.greyMedian ) * .001, .64, .82 );
    r = mix( r, greyRoughness, loss );
    roughness[ i ] = clip( r, .16, .92 );
    let physical = grain * mix( .00032, .00085, loss ) - loss * .00018 + patch * .00010;
    const oldHeight = ( old.height[ i ] / 255 - .5 ) * .008;
    if ( frame.protected ) {
      protectedPixels[ i ] = 1; physical = oldHeight; roughness[ i ] = old.roughness[ i ] / 255;
      ao[ i ] = old.ao[ i ] / 255; metallic[ i ] = old.metallic[ i ] / 255;
    } else {
      ao[ i ] = 1 - loss * smooth( .02, .10, s.fine[ i ] - s.lum[ i ] ) * .065;
    }
    metres[ i ] = physical; height[ i ] = clip( .5 + physical / .008 );
    for ( let k = 0; k < 3; k++ ) {
      const paint = pigmentTarget[ k ] + ( s.rgb[ i * 3 + k ] - s.pigment[ k ] ) - grain * 255 * .28;
      const concrete = substrateTarget[ k ] + ( s.lum[ i ] * 255 - s.greyMedian ) * .45;
      base[ i * 3 + k ] = frame.protected ? old.basecolor[ i * 3 + k ] : Math.round( clip( mix( paint, concrete, loss ), 0, 255 ) );
    }
  }
  const normal = new Uint8Array( COUNT * 3 );
  for ( let y = 0; y < N; y++ ) for ( let x = 0; x < N; x++ ) {
    const i = y * N + x;
    if ( protectedPixels[ i ] ) { normal.set( old.normal.subarray( i * 3, i * 3 + 3 ), i * 3 ); continue; }
    const dx = ( metres[ y * N + ( x + 1 ) % N ] - metres[ y * N + ( x - 1 + N ) % N ] ) / ( 4 / N );
    const dy = ( metres[ ( y + 1 ) % N * N + x ] - metres[ ( y - 1 + N ) % N * N + x ] ) / ( 4 / N );
    const inverse = 1 / Math.hypot( dx, dy, 1 );
    normal[ i * 3 ] = Math.round( ( -dx * inverse * .5 + .5 ) * 255 ); normal[ i * 3 + 1 ] = Math.round( ( dy * inverse * .5 + .5 ) * 255 ); normal[ i * 3 + 2 ] = Math.round( ( inverse * .5 + .5 ) * 255 );
  }
  const dir = path.join( stage, 'prepared', spec.id ); fs.mkdirSync( dir, { recursive: true } );
  const maps = {};
  for ( const [ channel, values ] of Object.entries( { basecolor: base, normal, roughness, metallic, height, ao } ) ) {
    const file = path.join( dir, `${channel}.png` ); await save( file, values, [ 'basecolor', 'normal' ].includes( channel ) ? 3 : 1 ); maps[ channel ] = file;
  }
  const maskDir = path.join( stage, 'masks', spec.id ); fs.mkdirSync( maskDir, { recursive: true } );
  for ( const [ name, values ] of Object.entries( { exposure, scuff, repair } ) ) await save( path.join( maskDir, `${name}.png` ), values );
  await save( path.join( maskDir, 'protected.png' ), Float32Array.from( protectedPixels ) );
  const request = { key, variantId: spec.id, alignment: 'tile', tiling: { worldSize: WORLD }, resolution: [ N, N ],
    description: `Red coating revision2 ${spec.id}: source-driven ${spec.kind}, fixed original panel construction, original paint sheen/pigment baseline; isolated candidate`,
    sourceMaps: maps, physical: { roughnessFactor: 1, metallicFactor: 0 }, layout: { family: 'panel', moduleSize: WORLD, jointWidth: .006, origin: [ 0, 0 ], orientation: 'horizontal' },
    append: fs.existsSync( path.join( themes, 'cyberpunk/theme.json' ) ), overwrite: true };
  const file = path.join( stage, `${spec.id}-request.json` ); fs.writeFileSync( file, JSON.stringify( request, null, 2 ) + '\n' );
  const args = [ path.join( root, 'dist/cli/pbrforge.js' ), 'create', file, '--native', '--themes', themes ];
  const made = spawnSync( process.execPath, args, { cwd: root, encoding: 'utf8' } );
  report.commands.push( { command: [ process.execPath, ...args ], exitCode: made.status, stdout: made.stdout, stderr: made.stderr } );
  if ( made.status !== 0 ) { fs.writeFileSync( path.join( stage, 'author-report.json' ), JSON.stringify( report, null, 2 ) ); throw Error( made.stdout + made.stderr ); }
  const found = spawnSync( process.execPath, [ path.join( root, 'dist/cli/pbrforge.js' ), 'resolve', key, '--themes', themes ], { encoding: 'utf8' } );
  assert.equal( found.status, 0, found.stdout + found.stderr );
  report.variants.push( { ...spec, sourcePixels: s.rawDimensions, sourcePigmentMedian: s.pigment, sourceGreyMedian: s.greyMedian, maps,
    exposedAreaAboveHalf: exposure.filter( x => x > .5 ).length / COUNT, scuffedAreaAboveHalf: scuff.filter( x => x > .5 ).length / COUNT,
    repairedAreaAboveHalf: repair.filter( x => x > .5 ).length / COUNT,
    resolvedVariant: JSON.parse( found.stdout ).data.entry.variants.find( v => v.id === spec.id ) } );
  console.log( `${spec.id}: native import and resolve passed` );
}
fs.writeFileSync( path.join( stage, 'author-report.json' ), JSON.stringify( report, null, 2 ) + '\n' );
