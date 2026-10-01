/** Isolated prepared PBR authoring. Root's theme/catalog/bindings are never
 * written. Every import names the staging database explicitly. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const checkout = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stage = path.join(checkout, 'out/red-authoring');
fs.mkdirSync(stage, {recursive:true});
fs.cpSync(path.join(checkout, 'sources/street-variants/red/raw'), path.join(stage, 'raw'), {recursive:true});
const themes = path.join( stage, 'themes' );
assert.equal( path.basename( stage ), 'red-authoring' );
assert( themes.endsWith( '/out/red-authoring/themes' ) );
const N = 1024, count = N * N, WORLD = [ 2, 2 ];
const states = [ 'clean', 'stained', 'cracked', 'patched' ];
const target = [ 154, 65, 50 ];
const clip = ( v, lo = 0, hi = 1 ) => Math.max( lo, Math.min( hi, v ) );
const smooth = ( lo, hi, v ) => { const t = clip( ( v - lo ) / ( hi - lo ) ); return t * t * ( 3 - 2 * t ); };
const mix = ( a, b, t ) => a + ( b - a ) * t;
const hash = bytes => createHash( 'sha256' ).update( bytes ).digest( 'hex' );
const gray = value => new Float32Array( count ).fill( value );
const mean = values => values.reduce( ( sum, value ) => sum + value, 0 ) / values.length;
const median = values => values.sort( ( a, b ) => a - b )[ Math.floor( values.length / 2 ) ];

function blur( values, radius ) {
  // Exact box blur, periodic in both axes. A sliding window keeps processing
  // linear in pixel count rather than depending on brush radius.
  const tmp = gray( 0 ), out = gray( 0 ), divisor = radius * 2 + 1;
  for ( let y = 0; y < N; y++ ) {
    let sum = 0; for ( let dx = -radius; dx <= radius; dx++ ) sum += values[ y * N + ( dx + N ) % N ];
    for ( let x = 0; x < N; x++ ) {
      tmp[ y * N + x ] = sum / divisor;
      sum += values[ y * N + ( x + radius + 1 ) % N ] - values[ y * N + ( x - radius + N ) % N ];
    }
  }
  for ( let x = 0; x < N; x++ ) {
    let sum = 0; for ( let dy = -radius; dy <= radius; dy++ ) sum += tmp[ ( dy + N ) % N * N + x ];
    for ( let y = 0; y < N; y++ ) {
      out[ y * N + x ] = sum / divisor;
      sum += tmp[ ( y + radius + 1 ) % N * N + x ] - tmp[ ( y - radius + N ) % N * N + x ];
    }
  }
  return out;
}

async function read( state ) {
  const file = path.join( stage, 'raw', `${state}.png` ), metadata = await sharp( file ).metadata();
  assert( metadata.width >= N && metadata.height >= N, 'Never upscale generated sources' );
  assert.equal( metadata.width, metadata.height );
  const data = await sharp( file ).removeAlpha().resize( N, N, { fit: 'fill', kernel: 'lanczos3' } ).raw().toBuffer();
  const lum = gray( 0 );
  const border = [ [], [], [] ];
  for ( let y = 0; y < N; y++ ) for ( let x = 0; x < N; x++ ) {
    const i = y * N + x;
    lum[ i ] = ( data[ i * 3 ] * .2126 + data[ i * 3 + 1 ] * .7152 + data[ i * 3 + 2 ] * .0722 ) / 255;
    if ( Math.min( x, y, N - 1 - x, N - 1 - y ) < N * .08 && x % 4 === 0 && y % 4 === 0 ) {
      for ( let k = 0; k < 3; k++ ) border[ k ].push( data[ i * 3 + k ] );
    }
  }
  const pigment = border.map( median );
  return { data, lum, fine: blur( lum, 2 ), soft: blur( blur( lum, 10 ), 10 ), pigment,
    baseline: ( pigment[ 0 ] * .2126 + pigment[ 1 ] * .7152 + pigment[ 2 ] * .0722 ) / 255,
    raw: { file, dimensions: [ metadata.width, metadata.height ], sha256: hash( fs.readFileSync( file ) ) } };
}

function distanceToSegments( u, v, lines ) {
  let distance = Infinity;
  for ( const line of lines ) for ( let j = 1; j < line.length; j++ ) {
    const [ ax, ay ] = line[ j - 1 ], [ bx, by ] = line[ j ];
    const dx = bx - ax, dy = by - ay, t = clip( ( ( u - ax ) * dx + ( v - ay ) * dy ) / ( dx * dx + dy * dy ) );
    distance = Math.min( distance, Math.hypot( u - ax - dx * t, v - ay - dy * t ) );
  }
  return distance;
}
// Conservative feature search around the photographed fissure. This selects
// photographed cracks/primer; it does not draw a second unrelated crack.
const crackLines = [
  [ [ 275, 298 ], [ 358, 365 ], [ 451, 403 ], [ 482, 445 ], [ 537, 473 ], [ 551, 536 ], [ 589, 579 ], [ 649, 623 ], [ 672, 656 ], [ 752, 641 ], [ 838, 616 ], [ 912, 564 ], [ 982, 538 ] ],
  [ [ 672, 656 ], [ 708, 708 ], [ 735, 773 ], [ 791, 876 ] ]
].map( line => line.map( p => p.map( x => x / 1254 ) ) );

function broadWipe( u, v, stateIndex, m ) {
  // Different loose wipe direction/position for every condition. These fields
  // change gloss, never height, and are broken by the source's broad detail.
  const centres = [ [ .38, .64, .31, .16 ], [ .69, .40, .22, .31 ], [ .31, .36, .26, .19 ], [ .27, .63, .17, .29 ] ];
  const [ cx, cy, rx, ry ] = centres[ stateIndex ];
  const dx = ( u - cx + .028 * Math.sin( v * 17 + stateIndex ) ) / rx;
  const dy = ( v - cy + .025 * Math.sin( u * 19 - stateIndex ) ) / ry;
  return Math.exp( -2.1 * ( dx * dx + dy * dy ) ) * clip( .7 + m * 2.5, .35, 1 );
}

function structural( x, y ) {
  const u = x / ( N - 1 ), v = y / ( N - 1 );
  const edgeDistance = Math.min( u, v, 1 - u, 1 - v ) * 2;
  const joint = 1 - smooth( .0015, .004, edgeDistance );
  const rim = 1 - smooth( .004, .035, edgeDistance );
  // Coated recessed anchor heads are consistent across all four states.
  let anchor = 0, lip = 0;
  for ( const ax of [ .018, .042, .958, .982 ] ) {
    const radius = Math.hypot( ( u - ax ) * 2, ( v - .06 ) * 2 );
    anchor = Math.max( anchor, 1 - smooth( .005, .008, radius ) );
    lip = Math.max( lip, smooth( .005, .007, radius ) * ( 1 - smooth( .008, .010, radius ) ) );
  }
  return { joint, rim, anchor, lip, edgeDistance };
}

function closeEdges( values, channels = 1 ) {
  for ( let y = 0; y < N; y++ ) for ( let k = 0; k < channels; k++ ) {
    const a = ( y * N ) * channels + k, b = ( y * N + N - 1 ) * channels + k;
    values[ a ] = values[ b ] = ( values[ a ] + values[ b ] ) / 2;
  }
  for ( let x = 0; x < N; x++ ) for ( let k = 0; k < channels; k++ ) {
    const a = x * channels + k, b = ( ( N - 1 ) * N + x ) * channels + k;
    values[ a ] = values[ b ] = ( values[ a ] + values[ b ] ) / 2;
  }
}

async function png( file, values, channels = 1 ) {
  const bytes = channels === 1 ? Buffer.alloc( values.length ) : Buffer.from( values );
  if ( channels === 1 ) for ( let i = 0; i < values.length; i++ ) bytes[ i ] = Math.round( clip( values[ i ] ) * 255 );
  await sharp( bytes, { raw: { width: N, height: N, channels } } ).png().toFile( file );
}

const source = {};
for ( const state of states ) source[ state ] = await read( state );
const common = source.clean;
const report = { authoredAt: new Date().toISOString(), database: themes, key: 'cyberpunk/street-coated/mid', resolution: [ N, N ], worldSize: WORLD,
  heightEncoding: { zero: .5, metresPerUnit: .008, note: 'Normals derive from physical unquantized height; 8-bit height master encodes +/-4 mm. Broad stains/wipes have no invented bump.' },
  structuralFrame: 'Identical 6 mm seam envelope, coated paired anchor recesses and 14 mm shared boundary region; no lane or gutter layout change.',
  variants: [], commands: [], acceptance: 'technical draft only; root visual/in-game verification pending' };

for ( let stateIndex = 0; stateIndex < states.length; stateIndex++ ) {
  const state = states[ stateIndex ], s = source[ state ];
  const base = new Uint8Array( count * 3 ), roughness = gray( 0 ), heightMetres = gray( 0 ), height = gray( .5 ), metallic = gray( 0 ), ao = gray( 1 );
  const masks = { primary: gray( 0 ), primer: gray( 0 ), wipe: gray( 0 ), structure: gray( 0 ) };
  for ( let y = 0; y < N; y++ ) for ( let x = 0; x < N; x++ ) {
    const i = y * N + x, u = x / ( N - 1 ), v = y / ( N - 1 ), frame = structural( x, y );
    const interior = smooth( .06, .13, Math.min( u, v, 1 - u, 1 - v ) );
    const low = s.soft[ i ] - s.baseline, grain = s.lum[ i ] - s.fine[ i ];
    const wipe = broadWipe( u, v, stateIndex, low ) * interior;
    let primary = 0, primer = 0, rub = 0, physical = grain * .00032;
    let r = [ .285, .345, .315, .350 ][ stateIndex ] + wipe * [ .10, .045, .09, .07 ][ stateIndex ];
    r += clip( low * .24, -.025, .025 );
    if ( state === 'stained' ) {
      primary = smooth( .015, .075, -low ) * interior;
      rub = smooth( .012, .055, low ) * interior;
      r = mix( r, .205, primary * .9 );
      r = mix( r, .60, rub * .9 );
      // Oil film/residue changes appearance without gravel-like relief.
    } else if ( state === 'cracked' ) {
      const roi = 1 - smooth( .016, .045, distanceToSegments( u, v, crackLines ) );
      const colourLoss = 1 - smooth( .105, .265, ( s.data[ i * 3 ] - s.data[ i * 3 + 1 ] ) / 255 );
      primary = smooth( .012, .065, s.fine[ i ] - s.lum[ i ] ) * roi * interior;
      primer = colourLoss * roi * interior * ( 1 - primary );
      r = mix( r, .86, primary ); r = mix( r, .74, primer );
      physical -= primary * .00070 + primer * .00018;
    } else if ( state === 'patched' ) {
      const dx = Math.abs( ( u - .615 ) / .22 ), dy = Math.abs( ( v - .477 ) / .19 );
      const roi = 1 - smooth( .84, 1.10, Math.pow( Math.pow( dx, 7 ) + Math.pow( dy, 7 ), 1 / 7 ) );
      primary = smooth( .010, .045, -low ) * roi * interior;
      r = mix( r, .265 + low * .1, primary );
      physical += primary * .00012;
      rub = smooth( .015, .055, low ) * roi * interior;
      r = mix( r, .56, rub * .6 );
    }
    // Shared boundary values make all variants mutually compatible at their
    // construction edge. Keep authored state differences away from the seam.
    const edgeKeep = smooth( .014, .032, frame.edgeDistance );
    const commonGrain = common.lum[ i ] - common.fine[ i ];
    physical = mix( commonGrain * .00032, physical, edgeKeep );
    r = mix( .32 + commonGrain * .10, r, edgeKeep );
    r = mix( r, .67, frame.rim * .36 );
    r = mix( r, .89, frame.joint );
    r = mix( r, .43, Math.max( frame.anchor, frame.lip ) );
    physical -= frame.joint * .0012 + frame.anchor * .0008;
    physical += frame.lip * .00012;
    roughness[ i ] = clip( r, .16, .92 ); heightMetres[ i ] = physical;
    height[ i ] = clip( .5 + physical / .008 );
    ao[ i ] = clip( 1 - frame.joint * .36 - frame.anchor * .32 - primary * ( state === 'cracked' ? .20 : 0 ), .45, 1 );
    masks.primary[ i ] = primary; masks.primer[ i ] = primer; masks.wipe[ i ] = wipe; masks.structure[ i ] = Math.max( frame.joint, frame.anchor );
    for ( let k = 0; k < 3; k++ ) {
      // Pigment-normalize each generated scan from its quiet outer field.
      // Preserve true condition marks, soften only sub-pixel grain.
      const value = target[ k ] + ( s.data[ i * 3 + k ] - s.pigment[ k ] ) - grain * 255 * .28;
      const shared = target[ k ] + ( common.data[ i * 3 + k ] - common.pigment[ k ] ) - commonGrain * 255 * .28;
      let colour = mix( shared, value, edgeKeep );
      colour *= 1 - frame.rim * .025;
      colour = mix( colour, [ 28, 25, 24 ][ k ], frame.joint * .88 );
      colour = mix( colour, 43, frame.anchor ); colour = mix( colour, 107, frame.lip * .75 );
      base[ i * 3 + k ] = Math.round( clip( colour, 0, 255 ) );
    }
  }
  closeEdges( base, 3 ); closeEdges( roughness ); closeEdges( heightMetres ); closeEdges( height ); closeEdges( ao );
  const normal = new Uint8Array( count * 3 );
  for ( let y = 0; y < N; y++ ) for ( let x = 0; x < N; x++ ) {
    const i = y * N + x;
    const dx = ( heightMetres[ y * N + ( x + 1 ) % N ] - heightMetres[ y * N + ( x - 1 + N ) % N ] ) / ( 2 * WORLD[ 0 ] / N );
    const dy = ( heightMetres[ ( y + 1 ) % N * N + x ] - heightMetres[ ( y - 1 + N ) % N * N + x ] ) / ( 2 * WORLD[ 1 ] / N );
    const inverse = 1 / Math.hypot( dx, dy, 1 );
    normal[ i * 3 ] = Math.round( ( -dx * inverse * .5 + .5 ) * 255 );
    normal[ i * 3 + 1 ] = Math.round( ( dy * inverse * .5 + .5 ) * 255 );
    normal[ i * 3 + 2 ] = Math.round( ( inverse * .5 + .5 ) * 255 );
  }
  closeEdges( normal, 3 );
  const dir = path.join( stage, 'prepared', state ); fs.mkdirSync( dir, { recursive: true } );
  const sourceMaps = {};
  for ( const [ channel, values ] of Object.entries( { basecolor: base, normal, roughness, metallic, height, ao } ) ) {
    const file = path.join( dir, `${channel}.png` ); await png( file, values, [ 'basecolor', 'normal' ].includes( channel ) ? 3 : 1 ); sourceMaps[ channel ] = file;
  }
  const maskDir = path.join( stage, 'masks', state ); fs.mkdirSync( maskDir, { recursive: true } );
  for ( const [ role, values ] of Object.entries( masks ) ) await png( path.join( maskDir, `${role}.png` ), values );
  const variantId = `red-${state}-1`;
  const request = { key: report.key, variantId, alignment: 'tile', tiling: { worldSize: WORLD }, resolution: [ N, N ],
    description: `Smooth sealed red pedestrian coating, ${state} condition; original photographic source, independent physical response; isolated review candidate`,
    sourceMaps, physical: { roughnessFactor: 1, metallicFactor: 0 }, layout: { family: 'panel', moduleSize: WORLD, jointWidth: .006, origin: [ 0, 0 ], orientation: 'horizontal' },
    append: fs.existsSync( path.join( themes, 'cyberpunk/theme.json' ) ), overwrite: true };
  const requestFile = path.join( stage, `${state}-request.json` ); fs.writeFileSync( requestFile, JSON.stringify( request, null, 2 ) + '\n' );
  const args = [ path.join( checkout, 'dist/cli/pbrforge.js' ), 'create', requestFile, '--native', '--themes', themes ];
  const made = spawnSync( process.execPath, args, { cwd: checkout, encoding: 'utf8' } );
  report.commands.push( { command: [ process.execPath, ...args ], status: made.status, stdout: made.stdout, stderr: made.stderr } );
  if ( made.status !== 0 ) { fs.writeFileSync( path.join( stage, 'author-report.json' ), JSON.stringify( report, null, 2 ) ); throw Error( made.stdout + made.stderr ); }
  const resolved = spawnSync( process.execPath, [ path.join( checkout, 'dist/cli/pbrforge.js' ), 'resolve', report.key, '--themes', themes ], { cwd: checkout, encoding: 'utf8' } );
  assert.equal( resolved.status, 0, resolved.stdout + resolved.stderr );
  const entry = JSON.parse( resolved.stdout ).data.entry;
  assert( entry.variants.some( v => v.id === variantId ) );
  report.variants.push( { state, variantId, raw: s.raw, pigmentMedianBeforeNormalization: s.pigment, maps: sourceMaps,
    sourceNormalization: `Outer-field pigment aligned to ${target.join( ',' )}; 28% of fine luminance grain suppressed without changing condition mark boundaries.`,
    roughnessMean: mean( roughness ), featureCoverage: { primaryAboveHalf: masks.primary.filter( v => v > .5 ).length / count, primerAboveHalf: masks.primer.filter( v => v > .5 ).length / count },
    resolvedVariant: entry.variants.find( v => v.id === variantId ) } );
  console.log( `${variantId}: prepared, native import and resolve passed` );
}
fs.writeFileSync( path.join( stage, 'author-report.json' ), JSON.stringify( report, null, 2 ) + '\n' );
