/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop} = Corelib
const {schedule} = Corelib.Tardis
const {min, max, round} = Math

onWaapiReady.then(waCtx => {
  const {connectArr, registerFxType, nowa, radioDef, createRadioCmds} = BeeFX(waCtx)
  
  const beatDelayFx = { //8#96e ------- Perfect beat delay -------
    def: {
      bpmLabel: {defVal: 'BPM:#label', type: 'box', width: 26},
      bpm: {defVal: 333, min: 40, max: 240, skipUi: true},
      bpmDisp: {defVal: '50#set', type: 'box', width: 24},
      beatTime: {defVal: 60 / 333, min: .25, max: 2, skipUi: true},
      beatTimeDisp: {defVal: '500ms#set', type: 'box', width: 40},
      delayLabel: {defVal: 'Delay:#label', type: 'box', width: 28},
      delayDisp: {defVal: '0 beats / 0ms#set', type: 'box', width: 67},
      wait: {defVal: 'on.ledoff', type: 'cmd', subType: 'led', color: 10, name: 'Wait'},
      noDelay: {defVal: 'on', type: 'cmd', name: 'No delay'},
      decDelay: {defVal: 'on', type: 'cmd', name: '-1 beat'},
      incDelay: {defVal: 'on', type: 'cmd', name: '+1 beat'},
      halfBeat: {defVal: 'off', type: 'cmd', subType: 'led', color: 190, name: '/2 beat'},
      delayBeats: {defVal: 0, min: 0, max: 16, subType: 'int', skipUi: true},
      delayTime: {defVal: 0, min: 0, max: 16, unit: 's', readOnly: true, skipUi: true},
      reset: {skipUi: true},
      onChange: {skipUi: true}
    },
    state: {
      disableStandardState: false,
      save: fx => fx.int.extract('half'),
      restore: (fx, state) => state.half && fx.setValue('halfBeat', 'fire')
    },
    name: 'Perfect Beat Delay',
    listen: ['source.bpm:bpm', 'source.chg:onChange']
  }
  beatDelayFx.setValue = (fx, key, value, {atm, int, exo} = fx) => ({
    wait: nop,
    onChange: _ => fx.setBusy(),
    reset: _ => {
      if (value) {
        fx.setValue('bpm', exo.def.bpm.defVal)
        fx.setValue('beatTime', exo.def.beatTime.defVal)
      }
    },
    bpmLabel: nop,
    bpm: _ => {
      const defBpm = exo.def.bpm.defVal
      const hasBpm = fx.past.bpm !== defBpm && fx.past.bpm > 0
      atm.bpm !== defBpm || !hasBpm
        ? fx.recalc()
        : atm.bpm = fx.past.bpm //: don't set back to default, rather remember the last good one
    },
    bpmDisp: nop,
    beatTime: nop,
    beatTimeDisp: nop,
    delayLabel: nop,
    delayDisp: nop,
    halfBeat: _ => {
      if (value === 'fire') {
        int.half = !int.half
        fx.setValue('halfBeat', int.half ? 'active.ledon' : 'off.ledoff')
        fx.recalc()
      }
    },
    noDelay: _ => fx.setValue('delayBeats', 0),
    decDelay: _ => fx.setValue('delayBeats', max(0, atm.delayBeats - 1)),
    incDelay: _ => fx.setValue('delayBeats', min(16, atm.delayBeats + 1)),
    delayBeats: _ => fx.recalc(),
    delayTime: _ => fx.setDelayTime('delay', atm.delayTime) //: much better than the setter
  }[key])

  beatDelayFx.construct = (fx, pars, {int, atm, exo} = fx) => {
    int.delay = waCtx.createDelay(10)
    connectArr(fx.start, int.delay, fx.output)
    int.half = false
    
    const checkBusy = _ => {
      if (int.isBusy) {
        if (int.endBusy < nowa()) {
          int.isBusy = false
          fx.setValue('wait', 'on.ledoff')
        } else {
          schedule(30).then(checkBusy)
        }
      }
    }
    
    fx.setBusy = _ => {
      int.endBusy = nowa() + atm.delayTime
      if (!int.isBusy) {
        int.isBusy = true
        fx.setValue('wait', 'on.ledon')
        checkBusy()
      }
    }
    
    fx.recalc = _ => { //: in: bpm, delayBeats, out: beatTimeDisp, bpmDisp, delayTime
      fx.setValue('beatTime', 60 / atm.bpm)
      const beatTimeStr = round(atm.beatTime * 1000) + 'ms'
      const [mod1, mod2] = ~~atm.bpm === exo.def.bpm.defVal ? ['#def', '#def'] : ['#set', '#mod']
      const halfer = int.half ? 2 : 1
      fx.setValue('beatTimeDisp', beatTimeStr + mod1)
      fx.setValue('bpmDisp', atm.bpm + mod1)
      fx.setValue('delayTime', atm.beatTime * atm.delayBeats / halfer)
      const delayTimeStr = round(atm.delayTime * 1000) + 'ms'
      fx.setValue('delayDisp', atm.delayBeats / halfer + ' / ' + delayTimeStr + mod2)
      fx.setBusy()
    }
  }
  registerFxType('fx_beatDelay', beatDelayFx)

  const delayExFx = { //8#05e ------- Delay extended (Oskar Eriksson / Tuna) -------
    def: {
      delayTime: {defVal: 100, min: 20, max: 1000, unit: 'ms'},
      feedback: {defVal: .45, min: .0, max: .99},
      cutOff: {defVal: 20000, min: 20, max: 20000, unit: 'Hz', subType: 'exp'},
      wetLevel: {defVal: .5, min: 0, max: 1},
      dryLevel: {defVal: 1, min: 0, max: 1},
      freqGraph: {type: 'graph'}
    },
    midi: {pars: ['delayTime,feedback,cutOff', 'wetLevel,dryLevel']},
    name: 'Delay (extended)',
    graphs: {}
  }
  delayExFx.graphs.freqGraph = {
    graphType: 'freq',
    filter: 'filter',
    minDb: -43,
    maxDb: 10,
    diynamic: .5
  }
  delayExFx.setValue = (fx, key, value, {int, atm} = fx) => ({
    delayTime: _ => fx.setDelayTime('delay', value / 1000),
    feedback: _ => fx.setAt('feedback', 'gain', value),
    cutOff: _ => fx.setAt('filter', 'frequency', value),
    wetLevel: _ => fx.setAt('wet', 'gain', value),
    dryLevel: _ => fx.setAt('dry', 'gain', value)
  }[key])
  
  delayExFx.construct = (fx, pars, {int} = fx) => {
    int.dry = waCtx.createGain()
    int.wet = waCtx.createGain()
    int.filter = waCtx.createBiquadFilter()
    int.filter.type = 'lowpass'
    int.delay = waCtx.createDelay(10)
    int.feedback = waCtx.createGain()

    connectArr(fx.start, int.delay, int.filter, int.feedback, int.wet, fx.output)
    int.feedback.connect(int.delay)
    connectArr(fx.start, int.dry, fx.output)
  }

  registerFxType('fx_delayExt', delayExFx)
  
  const pingPongDelayAFx = { //8#0ac -------pingPongDelayA (Chris Wilson) -------
    def: {
      delayLeft: {defVal: 200, min: 0, max: 4000, unit: 'ms'},
      delayRight: {defVal: 400, min: 0, max: 4000, unit: 'ms'},
      feedbackLeft: {defVal: .5, min: .01, max: 1.0},
      feedbackRight: {defVal: .5, min: .01, max: 1.0, name: 'feedbkRight'}
    },
    midi: {pars: ['delayLeft,feedbackLeft', 'delayRight,feedbackRight']},
    name: 'Ping Pong Delay A'
  }
  pingPongDelayAFx.setValue = (fx, key, value) => ({
    delayLeft: _ => fx.int.leftDelay.delayTime.value = value / 1000, //: setAt makes this worse
    delayRight: _ => fx.setDelayTime('rightDelay', value / 1000),    //: that's 100%, this is ramp
    feedbackLeft: _ => fx.setAt('leftFeedback', 'gain', value),
    feedbackRight: _ => fx.setAt('rightFeedback', 'gain', value)
  }[key])
  
  pingPongDelayAFx.construct = (fx, pars, {int} = fx) => {
    int.merger = waCtx.createChannelMerger(2)
    int.leftDelay = waCtx.createDelay(10)
    int.rightDelay = waCtx.createDelay(10)
    int.leftFeedback = waCtx.createGain()
    int.rightFeedback = waCtx.createGain()
    int.splitter = waCtx.createChannelSplitter(2)

    int.splitter.connect(int.leftDelay, 0)
    int.splitter.connect(int.rightDelay, 1)
    connectArr(int.leftDelay, int.leftFeedback, int.rightDelay, int.rightFeedback, int.leftDelay)
    int.leftFeedback.connect(int.merger, 0, 0)
    int.rightFeedback.connect(int.merger, 0, 1)
    fx.start.connect(int.splitter)
    int.merger.connect(fx.output)
  }

  registerFxType('fx_pingPongDelayA', pingPongDelayAFx)
  
  const beatCmdsDef = {
    beatQ: radioDef('off', 'Bt /4', 1 / 4),
    beatH: radioDef('off', 'Bt /2', 1 / 2),
    beat1: radioDef('active', 'Beat', 1),
    beat2: radioDef('off', 'Bt *2', 2),
    beat4: radioDef('off', 'Bt *4', 4)
  }
  
  const pingPongBeatDelayFx = { //8#0ac -------pingPongDelayC (syncable beat delay) -------
    def: {
      bpm: {defVal: 333, skipUi: true}, //: internal, from listening to the source
      beatTime: {defVal: 60 / 333, skipUi: true}, //: internal, from bpm
      beatTimeMod: {defVal: 1, skipUi: true},
      bpmDisp: {defVal: '333 / 180ms#def', type: 'box', width: 66},
      ...beatCmdsDef,
      delayFactLeft: {defVal: 0, min: 0, max: 24, subType: 'int', unit: '/12', name: 'Factor L'},
      delayFactRight: {defVal: 0, min: 0, max: 24, subType: 'int', unit: '/12', name: 'Factor R'},
      delayDispLeft: {defVal: 'Left: 180ms#set', type: 'box', width: 70},
      delayDispRight: {defVal: 'Right: 180ms#set', type: 'box', width: 70},
      feedbackLeft: {defVal: .5, min: .01, max: 1.0, name: 'Feedback L'},
      feedbackRight: {defVal: .5, min: .01, max: 1.0, name: 'Feedback R'}
    },
    midi: {pars: ['delayFactLeft,feedbackLeft', 'delayFactRight,feedbackRight']},
    listen: ['source.bpm:bpm'],
    name: 'Ping Pong Beat Delay'
  }
  pingPongBeatDelayFx.setValue = (fx, key, value) => ({
    bpm: _ => fx.setValue('beatTime', 60 / (value || 333)),
    beatTime: _ => fx.delayChanged(),
    beatTimeMod: _ => fx.delayChanged(),
    bpmDisp: nop,
    delayDispLeft: nop,
    delayDispRight: nop,
    delayFactLeft: _ => fx.delayChanged(), //: setAt makes this worse
    delayFactRight: _ => fx.delayChanged() ,    //: that's 100%, this is ramp
    feedbackLeft: _ => fx.setAt('leftFeedback', 'gain', value),
    feedbackRight: _ => fx.setAt('rightFeedback', 'gain', value)
  }[key] || (_ => fx.cmdProc(value, key)))
  
  pingPongBeatDelayFx.construct = (fx, pars, {int, atm, exo} = fx) => {
    int.merger = waCtx.createChannelMerger(2)
    int.leftDelay = waCtx.createDelay(10)
    int.rightDelay = waCtx.createDelay(10)
    int.leftFeedback = waCtx.createGain()
    int.rightFeedback = waCtx.createGain()
    int.splitter = waCtx.createChannelSplitter(2)

    int.splitter.connect(int.leftDelay, 0)
    int.splitter.connect(int.rightDelay, 1)
    connectArr(int.leftDelay, int.leftFeedback, int.rightDelay, int.rightFeedback, int.leftDelay)
    int.leftFeedback.connect(int.merger, 0, 0)
    int.rightFeedback.connect(int.merger, 0, 1)
    fx.start.connect(int.splitter)
    int.merger.connect(fx.output)
    
    const beatTimeDef = exo.def.beatTime.defVal
    const beatTimeModDef = exo.def.beatTimeMod.defVal
    const factLeftDef = exo.def.delayFactLeft.defVal
    const factRightDef = exo.def.delayFactRight.defVal
    
    fx.delayChanged = _ => {
      int.delayLeft = atm.beatTime * atm.beatTimeMod * atm.delayFactLeft / 12
      int.delayRight = atm.beatTime * atm.beatTimeMod * atm.delayFactRight / 12
      fx.int.leftDelay.delayTime.value = int.delayLeft
      fx.int.rightDelay.delayTime.value = int.delayRight
      const defChanged  = atm.beatTime !== beatTimeDef || atm.beatTimeMod !== beatTimeModDef
      fx.setValue('bpmDisp', `${atm.bpm} /${round(atm.beatTime * 1000)}ms` + (atm.beatTime !== beatTimeDef ? '#set' : '#def'))
      const leftMod = atm.delayFactLeft !== factLeftDef ? '#mod' : defChanged ? '#set' : '#def'
      const rightMod = atm.delayFactRight !== factRightDef ? '#mod' : defChanged ? '#set' : '#def'
      fx.setValue('delayDispLeft', `Left: ${round(int.delayLeft * 1000)}ms` + leftMod)
      fx.setValue('delayDispRight', `Right: ${round(int.delayRight * 1000)}ms` + rightMod)
    }
    
    const beatCmds = createRadioCmds(fx, beatCmdsDef, {onVal: 'active'})
    
    fx.cmdProc = (fire, mode) => {
      if (fire === 'fire') {
        beatCmds.check(mode, val => fx.setValue('beatTimeMod', val))
      }
    }
  }
  registerFxType('fx_pingPongBeatDelay', pingPongBeatDelayFx)
  
  const pingPongDelayBFx = { //8#0b8 -------pingPongDelayB (Tuna) -------
    def: {
      delayLeft: {defVal: 200, min: 0, max: 4000, unit: 'ms'},
      delayRight: {defVal: 400, min: 0, max: 4000, unit: 'ms'},
      feedback: {defVal: .5, min: .01, max: 1.0},
      wetLevel: {defVal: .5, min: .01, max: 1.0}
    },
    midi: {pars: ['delayLeft,feedback', 'delayRight,wetLevel']},
    name: 'Ping Pong Delay B'
  }
  
  pingPongDelayBFx.setValue = (fx, key, value) => ({
    delayLeft: _ => fx.int.leftDelay.delayTime.value = value / 1000, //: no setAt, this is better
    delayRight: _ => fx.int.rightDelay.delayTime.value = value / 1000,
    feedback: _ => fx.setAt('feedbackLevel', 'gain', value),
    wetLevel: _ => fx.setAt('wet', 'gain', value)
  }[key])

  pingPongDelayBFx.construct = (fx, pars, {int} = fx) => {
    int.wet = waCtx.createGain()
    int.stereoToMonoMix = waCtx.createGain()
    int.stereoToMonoMix.gain.value = .5
    int.feedbackLevel = waCtx.createGain()
    int.leftDelay = waCtx.createDelay(10)
    int.rightDelay = waCtx.createDelay(10)
    int.splitter = waCtx.createChannelSplitter(2)
    int.merger = waCtx.createChannelMerger(2)

    fx.start.connect(int.splitter)
    int.splitter.connect(int.stereoToMonoMix, 0, 0)
    int.splitter.connect(int.stereoToMonoMix, 1, 0)
    connectArr(int.stereoToMonoMix, int.wet, int.leftDelay, int.rightDelay, int.feedbackLevel)
    int.feedbackLevel.connect(int.wet)
    int.leftDelay.connect(int.merger, 0, 0)
    int.rightDelay.connect(int.merger, 0, 1)
    int.merger.connect(fx.output)
    fx.start.connect(fx.output) //:dry
  }
  registerFxType('fx_pingPongDelayB', pingPongDelayBFx)
})
