/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady, Chebyshev} from '../beeproxy-esm.js'

const {nop} = Corelib
const {wassert} = Corelib.Debug
const {startEndThrottle, post} = Corelib.Tardis
const {chebyDsp, isFilterStable} = Chebyshev

onWaapiReady.then(waCtx => {
  const {registerFxType, connectArr} = BeeFX(waCtx)

  const iirPresets = [
    ['MDN_200Hz', {
      frequency: 200,
      feedforward: [0.00020298, 0.0004059599, 0.00020298],
      feedback: [1.0126964558, -1.9991880801, 0.9873035442]
    }],
    ['MDN_500Hz', {
      frequency: 500,
      feedforward: [0.0012681742, 0.0025363483, 0.0012681742],
      feedback: [1.0317185917, -1.9949273033, 0.9682814083]
    }],
    ['MDN_1kHz', {
      frequency: 1000,
      feedforward: [0.0050662636, 0.0101325272, 0.0050662636],
      feedback: [1.0632762845, -1.9797349456, 0.9367237155]
    }],
    ['MDN_5kHz', {
      frequency: 5000,
      feedforward: [0.1215955842, 0.2431911684, 0.1215955842],
      feedback: [1.2912769759, -1.5136176632, 0.7087230241]
    }],
    ['ChebyshevLow015', {
      frequency: 1000,
      feedforward: [.8070778, -.3087918],
      feedback: [1, .1254285, .2508570, .1254285]
    }],
    ['BlumishevLow025', {
      frequency: 1000,
      feedforward: [-0, -1.796421256907539, -2.8279936073965226, -2.7817789336544676, -2.062039021733585, -1.0223969430939144, -0.313152942379077],
      feedback: [1, 0.009415444341457245, -0.05649266604874347, 0.14123166512185867, -0.1883088868291449, 0.14123166512185867, -0.05649266604874347, 0.009415444341457245]
    }],
    ['rtoy440-880', {
      frequency: 440,
      feedforward: [0.015258276134058446,0.015258276134058446],
      feedback: [1,-0.9694834477318831]
    }],
    ['rtoy-peaking', {
      frequency: 440,
      feedforward: [1, -1.987759247748441, 0.989847231541518],
      feedback: [1.0013144048769818, -1.987759247748441, 0.9885328266645363]
    }],
    ['etc', {
      frequency: 440,
      feedforward: [0.015258276134058446,0.015258276134058446],
      feedback: [1,-0.9694834477318831]
    }]
  ]
  const iirPresetNames = iirPresets.map(a => [a[0], a[0]])
  const iirPresetHash = {}
  iirPresets.map(a => iirPresetHash[a[0]] = a)
  
  const coeffStr = arr => arr
    .map(a => Math.abs(a) < .001 
      ? Math.abs(a) < .000001
        ? Math.abs(a) < .000000001
          ? (a * 1000000000).toFixed(3) + 'E-9' 
          : (a * 1000000).toFixed(3) + 'E-6' 
        : (a * 1000).toFixed(3) + 'E-3' 
      : Math.abs(a) > 10 
        ? a.toFixed(2)
        : a.toFixed(3))
    .map(f => f.split('0E').join('E').split('0E').join('E').split('000').join('0'))
    .map(f => f[0] === '0' ? f.substr(1) : f).join(' / ')
  
  const mergeModsWithChebyshev = (baseArr, modArr) => {
    const retArr = []
    for (let ix = 0; ix < baseArr.length; ix++) {
      const base = baseArr[ix] || 0
      const mod = modArr[ix] || 100
      retArr.push(base * mod / 100)
    }
    return retArr
  }
  
  const [coeffMinA, coeffMaxA] = [-2, 1]
  const [coeffMinB, coeffMaxB] = [-3, 2]
  
  const createIIRVariation = (name, variant, coeffCnt, poles) => {
    const filterTypeNames = [
      ['lowpass', 'lowpass'],
      ['highpass', 'highpass']
    ]
    const iirWarn = `☠️Warning!☢️ This is an experimental filter.<br>It can harm your audio and your ear.<br> Turn down your volume before tweaking it!`
    
    const IIR = {
      def: {
        warning: {defVal: iirWarn, type: 'html'},
        ...(variant === 'manual' ? {
          preset: {defVal: iirPresetNames[0][1], type: 'strings', subType: iirPresetNames},
          a: {defVal: .99, min: coeffMinA, max: coeffMaxA, arrayIx: [0, coeffCnt - 1], unit: '🔸', color: 95},
          b: {defVal: .01, min: coeffMinB, max: coeffMaxB, arrayIx: [0, coeffCnt - 1], unit: '🔹'}
        } : {
          filterType: {defVal: 'lowpass', type: 'strings', subType: filterTypeNames},
          cutOffFreq: {defVal: .025, min: 0, max: .5}, //.025 -> 500hz
          ripplePt: {defVal: 5, min: .1, max: 49},
          aMod: {defVal: 100, min: 1, max: 200, arrayIx: [0, coeffCnt - 2], unit: '🔸%', color: 180},
          bMod: {defVal: 100, min: 1, max: 200, arrayIx: [0, coeffCnt - 1], unit: '🔹%'}
        }),
        log: {defVal: '-', type: 'info'},
        previewGraph: {type: 'graph'},
        autoGen: {defVal: 'off', type: 'cmd', subType: 'led', color: 325, dontSave: true},
        reGenerate: {defVal: 'off', type: 'cmd'}, // go live!
        exTerminate: {defVal: 'off', type: 'cmd'}, // omg, kill it fast!
        liveGraph: {type: 'graph'}
      },
      midi: {arrays: variant === 'manual' ? 'a,b' : 'aMod,bMod'},
      name,
      graphs: {}
    }
    IIR.graphs.previewGraph = {
      graphType: 'freq',
      filter: 'IIR',
      minDb: -36,
      maxDb: 40,
      diynamic: .5,
      curveColor: ({fx}) => fx.int.isPreviewStable ? '#de0' : '#f90',
      postRender: ({fx, ccext}) => {
        ccext.drawText('Preview', 'yellow', 'left', '28px', 70, -14)
        fx.int.isPreviewStable || ccext.drawText('Unstable!', 'orange', 'left', '28px', 70, -54)
      }
    }
    IIR.graphs.liveGraph = {
      graphType: 'freq',
      filter: 'IIRLive',
      minDb: -36,
      maxDb: 40,
      diynamic: .5,
      curveColor: ({fx}) => fx.int.isLiveStable ? '#4e4' : fx.int.isLiveDead ? '#f44' : '#d80',
      postRender: ({ccext}) => ccext.drawText('Live', '#9e4', 'left', '28px', 70, -14)
    }

    IIR.setValue = (fx, key, value, {int} = fx) => ({
      //: common iir
      warning: nop,
      log: nop,
      autoGen: _ => value === 'fire' && fx.toggleAutoGen(),
      reGenerate: _ => {
        console.log(`regenerate called with `, value)
        value === 'fire' && fx.regenerateLive() //: regen even if not stable
      },
      exTerminate: _ => {
        console.log(`exTerminate called with`, value)
        value === 'fire' && fx.terminateLive()//: switch it off NOW (manual)
      },
      //: chebyshev:
      aMod: _ => fx.coeffModsChanged(),
      bMod: _ => fx.coeffModsChanged(),
      filterType: _ => fx.chebyshevParsChanged(),
      cutOffFreq: _ => fx.chebyshevParsChanged(),
      ripplePt: _ => fx.chebyshevParsChanged(),
      
      //: manual:
      preset: _ => fx.loadFromPreset(value),
      a: _ => fx.coeffsChanged(),
      b: _ => fx.coeffsChanged()
    }[key])
    
    IIR.construct = (fx, {initial}, {int, atm} = fx) => {
      int.isPreviewStable = false
      int.isliveStable = false
      int.isLiveDead = false
      int.isAutoGenOn = false
      int.feedforward = []
      int.feedback = []
      
      if (variant === 'chebyshev') {
        int.lastCheby = {}
        int.feedforwardMods = []
        int.feedbackMods = []
        int.feedforwardChebyshev = []
        int.feedbackChebyshev = []
      }
      
      fx.regeneratePreview = startEndThrottle(_ => {
        if (int.feedforward.length) {
          fx.updateLog()
          int.isPreviewStable = isFilterStable(int.feedback)
          console.log(`generating preview, predicted: ${int.isPreviewStable ? '😀' : '🤬'}`, coeffStr(int.feedback))
          int.IIR = waCtx.createIIRFilter(int.feedforward, int.feedback)
          fx.setValue('reGenerate', int.isPreviewStable ? 'active' : 'alert')
          //: also will enforce graph refresh as side effect
          if (int.isAutoGenOn) {
            fx.regenerateLiveIfStable() //: will turn off reGenerate cmd on success
          }
        } else {
          console.warn(`chebyshev: empty feedforward!`)
        }
      }, 100)
      
      fx.regenerateLive = _ => {
        if (!int.feedforward.length) {
          return console.warn(`IIR cannot regenerate with empty coeff arrays`)
        }
        console.log('⚡️ IIR going live! ⚡️')
        fx.terminateLive()
        int.isLiveStable = int.isPreviewStable
        int.IIRLive = waCtx.createIIRFilter(int.feedforward, int.feedback)
        connectArr(fx.start, int.IIRLive, fx.output)
        //: no need to redraw the graph  as we are inside of setvalue (redraw will follow anyway)
        fx.setValue('exTerminate', int.isLiveStable ? 'active' : 'alert')
        fx.setValue('reGenerate', 'off')
      }
      
      fx.regenerateLiveIfStable = _ => int.isPreviewStable && fx.regenerateLive()
      
      fx.toggleAutoGen = _ => {
        int.isAutoGenOn = !int.isAutoGenOn
        console.log('toggle sets autogen to', int.isAutoGenOn ? 'active' : 'off')
        fx.setValue('autoGen', int.isAutoGenOn ? 'active.ledon' : 'off')
        int.isAutoGenOn && fx.regenerateLiveIfStable()
      }
      
      fx.terminateLive = _ => {
        fx.start.disconnect()
        void int.IIRLive?.disconnect()
      }
      
      fx.mayday = data => {
        int.isLiveStable = false
        int.isLiveDead = true
        fx.setValue('exTerminate', 'off')
        console.log('IIR mayday')
      }
      
      fx.updateLog = _ => {
        fx.setValue('log', [
          `${coeffStr(int.feedback).split(' / ').join('<em></em>')} 🔸`,
          `${coeffStr(int.feedforward).split(' / ').join('<em></em>')} 🔹`
        ].join('<br>'))
      }
      
      if (variant === 'manual') {
        fx.coeffsChanged = _ => {
          int.feedback = fx.getValueArray('a')
          int.feedforward = fx.getValueArray('b')
          fx.regeneratePreview()
        }
        
        fx.loadFromPreset = name => {
          fx.regeneratePreview()
          const iirPreset = wassert(iirPresetHash[name])
          const {feedforward, feedback} = iirPreset[1]
          fx.setValueArray('a', feedback)
          fx.setValueArray('b', feedforward)
          fx.coeffsChanged()
        }
        post(_ => fx.loadFromPreset(initial.preset))
      } else {
        //: chebyshev
        fx.regenCoeffs = _ => {
          int.feedforward = mergeModsWithChebyshev(int.feedforwardChebyshev, int.feedforwardMods)
          int.feedback = mergeModsWithChebyshev(int.feedbackChebyshev, int.feedbackMods)
          fx.regeneratePreview()
        }
        
        fx.coeffModsChanged = _ => {
          int.feedbackMods = fx.getValueArray('aMod') //+ megcserelni mod nem modot
          int.feedforwardMods = fx.getValueArray('bMod')
          fx.regenCoeffs()
        }
    
        fx.chebyshevParsChanged = _ => {
          if (atm.cutOffFreq && atm.filterType && atm.ripplePt) {
            //: this a b exchange is weird... somewhere I mixed up the arrays
            const {a: b, b: a} = chebyDsp(atm.cutOffFreq, atm.filterType, atm.ripplePt, poles)
            int.feedforwardChebyshev = b.filter(b => b)
            int.feedbackChebyshev = a.slice(1).filter(a => a)
            //console.log('regenChebyBase', atm.cutOffFreq, atm.filterType, atm.ripplePt, {a, b})
          }
          fx.regenCoeffs()
        }  
      }
    }
    return IIR
  }
  registerFxType('fx_IIRmanual2', createIIRVariation('IIR (manual 2-pole)', 'manual', 3, 2))
  registerFxType('fx_IIRmanual4', createIIRVariation('IIR (manual 4-pole)', 'manual', 5, 4))
  registerFxType('fx_IIRmanual6', createIIRVariation('IIR (manual 6-pole)', 'manual', 7, 6))
  registerFxType('fx_IIRmanual8', createIIRVariation('IIR (manual 8-pole)', 'manual', 9, 8))
  registerFxType('fx_IIRcheb2', createIIRVariation('IIR (Chebyshev 2-pole)', 'chebyshev', 3, 2))
  registerFxType('fx_IIRcheb4', createIIRVariation('IIR (Chebyshev 4-pole)', 'chebyshev', 5, 4))
  registerFxType('fx_IIRcheb6', createIIRVariation('IIR (Chebyshev 6-pole)', 'chebyshev', 7, 6))
  registerFxType('fx_IIRcheb8', createIIRVariation('IIR (Chebyshev 8-pole)', 'chebyshev', 9, 8))
})
