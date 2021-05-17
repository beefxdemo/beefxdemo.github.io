/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {createPerfTimer, startEndThrottle} = Corelib.Tardis
const {fetch} = window

onWaapiReady.then(waCtx => {
  const {registerFxType, connectArr, getPresetPath} = BeeFX(waCtx)
  
  const logOn = false
  const clog = (...args) => logOn && console.log(...args)

  const convPresets = [ //: https://www.voxengo.com/impulses/
    ['tuna/impulse_guitar', '1. Default'],
    ['tuna/impulse_rev', '2. Default reverse'],
    ['cw/cardiod-rear-levelled', '3. Cardiod Rear Levelled'],
    'Vocal Duo',
    'Trig Room',
    'St Nicolaes Church',
    'Small Drum Room',
    'Small Prehistoric Cave',
    'Scala Milan Opera Hall',
    'Ruby Room',
    'Right Glass Triangle',
    'Rays',
    'Parking Garage',
    'On a Star',
    'Nice Drum Room',
    'Narrow Bumpy Space',
    'Musikvereinsaal',
    'Masonic Lodge',
    'Large Wide Echo Hall',
    'Large Long Echo Hall',
    'Large Bottle Hall',
    ['Highly Damped Large Room', 'Highly Damped Lrg Rm'],
    'In The Silo',
    'Greek 7 Echo Hall',
    'Going Home',
    'Five Columns',
    'Five Columns Long',
    ['French 18th Century Salon', 'French 18th Cent. Salon'],
    'Direct Cabinet N4',
    'Direct Cabinet N3',
    'Direct Cabinet N2',
    'Direct Cabinet N1',
    'Bottle Hall',
    'Derlon Sanctuary',
    'Deep Space',
    'Conic Long Echo Hall',
    ['Chateau de Logne, Outside', 'Chateau de Logne, Out.'],
    'Block Inside',
    'Cement Blocks 1',
    'Cement Blocks 2',
    'In The Silo Revised'
  ].map(a => a.map ? a : [a, a]).sort((a, b) => a[1] > b[1] ? 1 : -1)
  
  const convPrefix = getPresetPath('impulses/imodeler/')
  
  const getFullConvImpulsePath = conv => convPrefix + conv + '.wav'
  
  const loadImpRespFromSample = (value, {onBufferReady}) => fetch(getFullConvImpulsePath(value))
    .then(response => {
       if (!response.ok) {
         throw new Error("HTTP error, status = " + response.status)
       }
       return response.arrayBuffer()
     })
     .then(buffer => waCtx.decodeAudioData(buffer, decodedData => onBufferReady(decodedData)))

   const loadGeneratedImpResp = ({impDuration, impDecay, impReverse}, {onBufferReady}) => {
     const timer = createPerfTimer()
     
     const {sampleRate} = waCtx
     const length = sampleRate * impDuration
     const impulse = waCtx.createBuffer(2, length, sampleRate)
     const impulseL = impulse.getChannelData(0)
     const impulseR = impulse.getChannelData(1)

     for (let i = 0; i < length; i++) {
       const n = impReverse ? length - i : i
       impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, impDecay)
       impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, impDecay)
     }
     clog(`loadGenImpResp spent`, timer.sum().summary, {impDuration, impDecay, impReverse})
     onBufferReady(impulse)
   }
  
  const createConvolverVariation = variation => { //8#86c ---- Convolvers (Tuna & Chris Wilson) ----
    const isGenImp = variation === 'genimpulse'
    
    const convolverFx = {
      def: {
        ...(isGenImp ? {
          impDuration: {defVal: 2.5, min: .1, max: 6, subType: 'exp'},
          impDecay: {defVal: 2., min: 1, max: 3},
          impReverse: {defVal: false, type: 'boolean'}
        } : { 
          buffer: {defVal: convPresets[0][0], type: 'strings', size: 6, subType: convPresets}
        }),
        sampleGraph: {type: 'graph'}  ,
        highCut: {defVal: 22050, min: 20, max: 22050, subType: 'exp'},
        lowCut: {defVal: 20, min: 20, max: 22050, subType: 'exp'},
        Q: {defVal: 1, min: .0001, max: 40, subType: 'exp'},
        freqGraph: {type: 'graph'},
        dryLevel: {defVal: .5, min: 0, max: 1},
        wetLevel: {defVal: 1, min: 0, max: 1}
      },
      midi: {pars: ['highCut,lowCut,Q', 'dryLevel,wetLevel', isGenImp ? 'impDuration,impDecay' : '']},
      name: isGenImp ? 'Convolver (generated impulse)' : 'Convolver (from sample)',
      fxNamesDb: {convPresets},
      graphs: {
        freqGraph: [{
          graphType: 'freq',
          filter: 'filterLow',
          minDb: -43,
          maxDb: 16,
          magCurveColor: `hsla(120, 99%, 55%)`,
          diynamic: .8
        }, {
          graphType: 'freq',
          filter: 'filterHigh',
          renderSet: {doClear: false, doGrid: false, doGraph: true},
          minDb: -43,
          maxDb: 16,
          magCurveColor: `hsla(20, 99%, 65%)`,
          diynamic: .8
        }],
        sampleGraph: {
          graphType: 'audioBuffer',
          bufferHost: 'convolver',
          triggerKeys: ['sampleGraph']
        }
      }
    }

    convolverFx.setValue = (fx, key, value, {int} = fx) => ({
      buffer: _ => loadImpRespFromSample(value, int),
      impDuration: _ => fx.regenImpulseBuffer(),
      impDecay: _ => fx.regenImpulseBuffer(),
      impReverse: _ => fx.regenImpulseBuffer(),
      highCut: _ => fx.setAt('filterHigh', 'frequency', value),
      lowCut: _ => fx.setAt('filterLow', 'frequency', value),
      Q: _ => {
        int.filterLow.Q.value = value
        int.filterHigh.Q.value = value
      },
      dryLevel: _ => fx.setAt('dry', 'gain', value),
      wetLevel: _ => fx.setAt('wet', 'gain', value)
    }[key])
    
    convolverFx.construct = (fx, {initial}, {int, atm} = fx) => {
      int.onBufferReady = buffer => {
        int.convolver.buffer = buffer
        fx.valueChanged('sampleGraph')
      }
      if (isGenImp) {
        fx.regenImpulseBuffer = startEndThrottle(_ => loadGeneratedImpResp(atm, int), 50)
      }
      int.convolver = waCtx.createConvolver()
      int.dry = waCtx.createGain()
      int.filterLow = waCtx.createBiquadFilter()
      int.filterLow.type = 'highpass'
      int.filterHigh = waCtx.createBiquadFilter()
      int.filterHigh.type = 'lowpass'
      int.wet = waCtx.createGain()
      
      connectArr(fx.start, int.filterLow, int.filterHigh, int.convolver, int.wet, fx.output)
      connectArr(fx.start, int.dry, fx.output)
    }
    return convolverFx
  }
  
  registerFxType('fx_convolver', createConvolverVariation('classic'))
  registerFxType('fx_convolverGen', createConvolverVariation('genimpulse'))
})
