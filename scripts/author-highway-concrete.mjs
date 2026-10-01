/** Three isolated highway concrete candidates; explicit staging --themes on
 * every public write. Structural wear is a separate placement-mask contract. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stage = path.join(root, 'out/highway-authoring');
fs.mkdirSync(stage, {recursive:true});
fs.cpSync(path.join(root, 'sources/highway-concrete/raw'), path.join(stage, 'raw'), {recursive:true});
const themes = path.join( stage, 'themes' ), key = 'cyberpunk/highway-concrete/mid';
assert( themes.endsWith( '/out/highway-authoring/themes' ) );
const N = 1024, TOTAL = N * N, WORLD = [ 2, 2 ];
const variants = [
  { id: 'formed', colour: [ 153, 153, 147 ], roughness: .735, albedoGain: .72, relief: .00125,
    role: 'deck-concrete and barrier-concrete; faint horizontal casting imprint' },
  { id: 'soffit', colour: [ 131, 130, 125 ], roughness: .835, albedoGain: .57, relief: .00090,
    role: 'soffit-concrete; quiet cast finish with modest intrinsic dusty deposit' },
  { id: 'pier', colour: [ 150, 151, 146 ], roughness: .775, albedoGain: .62, relief: .00105,
    role: 'pier-concrete; quiet cast shaft with faint directional forming evidence, no base band' }
];
const clamp = ( x, lo = 0, hi = 1 ) => Math.max( lo, Math.min( hi, x ) );
const smooth = ( lo, hi, x ) => { const t = clamp( ( x - lo ) / ( hi - lo ) ); return t * t * ( 3 - 2 * t ); };
const field = value => new Float32Array( TOTAL ).fill( value );
const average = values => values.reduce( ( a, b ) => a + b, 0 ) / values.length;

function blur( input, rx, ry = rx ) {
  const tmp = field( 0 ), out = field( 0 );
  for ( let y = 0; y < N; y++ ) {
    let sum = 0; for ( let dx = -rx; dx <= rx; dx++ ) sum += input[ y * N + ( dx + N ) % N ];
    for ( let x = 0; x < N; x++ ) {
      tmp[ y * N + x ] = sum / ( rx * 2 + 1 );
      sum += input[ y * N + ( x + rx + 1 ) % N ] - input[ y * N + ( x - rx + N ) % N ];
    }
  }
  for ( let x = 0; x < N; x++ ) {
    let sum = 0; for ( let dy = -ry; dy <= ry; dy++ ) sum += tmp[ ( dy + N ) % N * N + x ];
    for ( let y = 0; y < N; y++ ) {
      out[ y * N + x ] = sum / ( ry * 2 + 1 );
      sum += tmp[ ( y + ry + 1 ) % N * N + x ] - tmp[ ( y - ry + N ) % N * N + x ];
    }
  }
  return out;
}
function closeEdges( data, channels = 1 ) {
  for ( let p = 0; p < N; p++ ) for ( let k = 0; k < channels; k++ ) {
    const a = p * N * channels + k, b = ( p * N + N - 1 ) * channels + k;
    data[ a ] = data[ b ] = ( data[ a ] + data[ b ] ) / 2;
  }
  for ( let p = 0; p < N; p++ ) for ( let k = 0; k < channels; k++ ) {
    const a = p * channels + k, b = ( ( N - 1 ) * N + p ) * channels + k;
    data[ a ] = data[ b ] = ( data[ a ] + data[ b ] ) / 2;
  }
}
function periodic( data, channels ) {
  // Crossfade offset copies at both edges; preserve source proportions. No
  // mirroring, colour stripe or frame is introduced into continuous concrete.
  const band = Math.round( N * .12 );
  for ( let axis = 0; axis < 2; axis++ ) {
    const source = data.slice();
    for ( let y = 0; y < N; y++ ) for ( let x = 0; x < N; x++ ) {
      const q = axis ? y : x, distance = Math.min( q, N - 1 - q );
      if ( distance >= band ) continue;
      const weight = 1 - smooth( 0, band, distance );
      const ox = axis ? x : ( x + N / 2 ) % N, oy = axis ? ( y + N / 2 ) % N : y;
      for ( let k = 0; k < channels; k++ ) {
        const i = ( y * N + x ) * channels + k;
        data[ i ] = source[ i ] * ( 1 - weight ) + source[ ( oy * N + ox ) * channels + k ] * weight;
      }
    }
  }
  closeEdges( data, channels );
}
async function save( file, values, channels = 1 ) {
  const bytes = channels === 1 ? Buffer.alloc( values.length ) : Buffer.from( values );
  if ( channels === 1 ) for ( let i = 0; i < values.length; i++ ) bytes[ i ] = Math.round( clamp( values[ i ] ) * 255 );
  await sharp( bytes, { raw: { width: N, height: N, channels } } ).png().toFile( file );
}
function normalOf( metres ) {
  const normal = new Uint8Array( TOTAL * 3 );
  for ( let y = 0; y < N; y++ ) for ( let x = 0; x < N; x++ ) {
    const i = y * N + x;
    const dx = ( metres[ y * N + ( x + 1 ) % N ] - metres[ y * N + ( x - 1 + N ) % N ] ) / ( 2 * WORLD[ 0 ] / N );
    const dy = ( metres[ ( y + 1 ) % N * N + x ] - metres[ ( y - 1 + N ) % N * N + x ] ) / ( 2 * WORLD[ 1 ] / N );
    const inverse = 1 / Math.hypot( dx, dy, 1 );
    normal[ i * 3 ] = Math.round( ( -dx * inverse * .5 + .5 ) * 255 );
    normal[ i * 3 + 1 ] = Math.round( ( dy * inverse * .5 + .5 ) * 255 );
    normal[ i * 3 + 2 ] = Math.round( ( inverse * .5 + .5 ) * 255 );
  }
  closeEdges( normal, 3 );
  return normal;
}
const report = { authoredAt: new Date().toISOString(), database: themes, key, resolution: [ N, N ], worldSize: WORLD,
  scaleReason: 'All raw sources are square 1254x1254 and are downsampled whole to 1024x1024. A 2x2 m repeat preserves physical aspect; 2.4x2 and 4x2 were suggested review spans, not authority to stretch source pores. Joint stains use actual stations at a larger placement scale.',
  heightEncoding: { zero: .5, metresPerUnit: .003, limitsMetres: [ -.00040, .00040 ], description: 'Shallow pore/casting relief only. Grime/macro deposits do not become height.' },
  variants: [], commands: [], acceptance: 'draft only; actual highway render and mask-consumer check pending' };
for ( const spec of variants ) {
  const raw = path.join( stage, 'raw', `${spec.id}.png` ), metadata = await sharp( raw ).metadata();
  assert( metadata.width >= N && metadata.height >= N && metadata.width === metadata.height );
  const pixels = await sharp( raw ).removeAlpha().resize( N, N, { fit: 'fill', kernel: 'lanczos3' } ).raw().toBuffer();
  const base = new Uint8Array( pixels );
  periodic( base, 3 );
  const lum = field( 0 ), means = [ 0, 0, 0 ];
  for ( let i = 0; i < TOTAL; i++ ) {
    lum[ i ] = ( base[ i * 3 ] * .2126 + base[ i * 3 + 1 ] * .7152 + base[ i * 3 + 2 ] * .0722 ) / 255;
    for ( let k = 0; k < 3; k++ ) means[ k ] += base[ i * 3 + k ] / TOTAL;
  }
  const fine = blur( lum, 2 ), mid = blur( lum, 9 ), broad = blur( blur( lum, 50 ), 50 );
  const broadMean = average( broad );
  const directed = spec.id === 'formed' ? blur( lum, 28, 2 ) : spec.id === 'pier' ? blur( lum, 2, 32 ) : blur( lum, 15, 15 );
  const roughness = field( 0 ), metres = field( 0 ), height = field( .5 ), metallic = field( 0 ), ao = field( 1 ), deposits = field( 0 );
  let minimumHeight = Infinity, maximumHeight = -Infinity;
  for ( let i = 0; i < TOTAL; i++ ) {
    const grain = lum[ i ] - fine[ i ], texture = fine[ i ] - mid[ i ];
    const casting = directed[ i ] - mid[ i ];
    const pores = smooth( .025, .11, fine[ i ] - lum[ i ] );
    const deposit = smooth( -.016, .026, broadMean - broad[ i ] );
    deposits[ i ] = deposit;
    // Formwork/pore detail stays below a millimetre. Low-frequency deposit is
    // absent from this equation, preventing stains becoming large bumps.
    const h = clamp( grain * spec.relief * .30 + texture * spec.relief * .70
      + casting * ( spec.id === 'formed' ? .0014 : spec.id === 'pier' ? .00065 : .0002 ) - pores * .00012, -.0004, .0004 );
    metres[ i ] = h; height[ i ] = .5 + h / .003;
    minimumHeight = Math.min( minimumHeight, h ); maximumHeight = Math.max( maximumHeight, h );
    roughness[ i ] = clamp( spec.roughness + ( deposit - .5 ) * ( spec.id === 'soffit' ? .085 : .065 )
      + texture * .4 + casting * ( spec.id === 'formed' ? .28 : .10 ) + pores * .05, .64, .92 );
    ao[ i ] = 1 - pores * .055;
    for ( let k = 0; k < 3; k++ ) {
      const physicalDetail = ( base[ i * 3 + k ] - means[ k ] ) * spec.albedoGain;
      // Subdue accidental scene-scale illumination drift, not the fine pores.
      const levelling = ( broad[ i ] - broadMean ) * 255 * .25;
      const forming = spec.id === 'pier' ? casting * 255 * .28 : 0;
      base[ i * 3 + k ] = Math.round( clamp( spec.colour[ k ] + physicalDetail - levelling + forming, 0, 255 ) );
    }
  }
  closeEdges( base, 3 ); closeEdges( roughness ); closeEdges( metres ); closeEdges( height ); closeEdges( ao ); closeEdges( deposits );
  const normal = normalOf( metres );
  const dir = path.join( stage, 'prepared', spec.id ); fs.mkdirSync( dir, { recursive: true } );
  const sourceMaps = {};
  for ( const [ channel, values ] of Object.entries( { basecolor: base, normal, roughness, metallic, height, ao } ) ) {
    const file = path.join( dir, `${channel}.png` ); await save( file, values, [ 'basecolor', 'normal' ].includes( channel ) ? 3 : 1 ); sourceMaps[ channel ] = file;
  }
  const maskDir = path.join( stage, 'masks' ); fs.mkdirSync( maskDir, { recursive: true } );
  await save( path.join( maskDir, `${spec.id}-fine-deposit.png` ), deposits );
  const request = { key, variantId: spec.id, alignment: 'tile', tiling: { worldSize: WORLD }, resolution: [ N, N ],
    description: `Highway concrete ${spec.id}; ${spec.role}; generated photographic source with restrained physical response, macro structural weathering applied by placement`,
    physical: { roughnessFactor: 1, metallicFactor: 0 }, sourceMaps,
    layout: { family: 'continuous', origin: [ 0, 0 ], orientation: spec.id === 'formed' ? 'horizontal' : spec.id === 'pier' ? 'vertical' : 'isotropic' },
    append: fs.existsSync( path.join( themes, 'cyberpunk/theme.json' ) ), overwrite: true };
  const file = path.join( stage, `${spec.id}-request.json` ); fs.writeFileSync( file, JSON.stringify( request, null, 2 ) + '\n' );
  const args = [ path.join( root, 'dist/cli/pbrforge.js' ), 'create', file, '--native', '--themes', themes ];
  const made = spawnSync( process.execPath, args, { cwd: root, encoding: 'utf8' } );
  report.commands.push( { command: [ process.execPath, ...args ], exitCode: made.status, stdout: made.stdout, stderr: made.stderr } );
  if ( made.status !== 0 ) { fs.writeFileSync( path.join( stage, 'author-report.json' ), JSON.stringify( report, null, 2 ) ); throw Error( made.stdout + made.stderr ); }
  const resolved = spawnSync( process.execPath, [ path.join( root, 'dist/cli/pbrforge.js' ), 'resolve', key, '--themes', themes ], { cwd: root, encoding: 'utf8' } );
  assert.equal( resolved.status, 0, resolved.stdout + resolved.stderr );
  const entry = JSON.parse( resolved.stdout ).data.entry;
  report.variants.push( { id: spec.id, role: spec.role, source: raw, actualSourceDimensions: [ metadata.width, metadata.height ],
    meanRGBSource: means, targetRGB: spec.colour, roughnessMean: average( roughness ), heightRangeMetres: [ minimumHeight, maximumHeight ],
    maps: sourceMaps, resolvedVariant: entry.variants.find( variant => variant.id === spec.id ) } );
  console.log( `${spec.id}: native import and resolve passed` );
}
fs.writeFileSync( path.join( stage, 'author-report.json' ), JSON.stringify( report, null, 2 ) + '\n' );
