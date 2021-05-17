/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop} = Corelib // eslint-disable-line no-unused-vars
const {startEndThrottle} = Corelib.Tardis
const {log, round} = Math

onWaapiReady.then(waCtx => {
  const {registerFxType, newFx} = BeeFX(waCtx)

  const bpmTransformerFx = { //8#e74 ------- bpmTransformer -------
    def: {
      reset: {defVal: 'on', type: 'cmd', name: 'Rst'},
      xDouble: {defVal: 'on', type: 'cmd', name: 'x2', width: 12},
      xHalf: {defVal: 'on', type: 'cmd', name: '/2', width: 12},
      bpmOriginal: {defVal: '333#def', type: 'box', width: 18}, //: disp only, ->int.bpmIn
      bpmDec: {defVal: '➜#label', type: 'box', width: 11, cc: 'emoji nobord'},
      bpmAdjusted: {defVal: '333#def', type: 'box', width: 26}, //: disp only, ->int.bpmOut
      decBpm: {defVal: 'on', type: 'cmd', name: '-1'},
      incBpm: {defVal: 'on', type: 'cmd', name: '+1'},
      setFromAdj: {defVal: 'on', type: 'cmd', name: '🔅', cc: 'emoji'},
      autoTune: {defVal: 'off', subType: 'led', color: 25, type: 'cmd', name: 'auTune'},
      pitch: {defVal: 100, min: 100 - 16 * 2, max: 100 + 16 * 2, unit: '%', name: 'Pitch Adj.'},
      bpmModifier: {defVal: 0, min: -30, max: 30, readOnly: true, skipUi: true},
      controller: {defVal: null, type: 'object', skipUi: true},
      pitchCorrection: {defVal: false, type: 'boolean', skipUi: true}
    },
    midi: {pars: ['pitch']}
  }
  //: atm:
  //:  - pitch ~100
  //:  - bpmModifier + 3.2
   //: - bpmOriginal (70#set)
   //: - bpmAdjusted (76#mod)
  //: int:
  //:  - controller (media)
  //:  - bpmIn (70)
  //:  - bpmOut (76)
  //:  - offset (pitchshifter)
  //:  - isPitchShifterOn (control flag)
  //:  - pitchShifter (fx)
  
  bpmTransformerFx.setValue = (fx, key, value, {int, atm} = fx) => ({
    xDouble: _ => value === 'fire' && fx.setValue('bpmOriginal', round(int.bpmIn * 2) + '#set'),
    xHalf: _ => value === 'fire' && fx.setValue('bpmOriginal', round(int.bpmIn / 2) + '#set'),
    setFromAdj: _ => {
      if (value === 'fire') {
        fx.setValue('bpmOriginal', round(int.bpmOut))
        fx.setValue('pitch', 100)
      }
    },
    pitch: _ => fx.pitchChanged(value),
    bpmOriginal: _ => fx.bpmOrigChanged(value), // 123#set -> 123
    bpmModifier: _ => fx.bpmModChanged(value),
    autoTune: _ => {
      if (value === 'fire') {
        atm.pitchCorrection = !atm.pitchCorrection
        fx.recalcPitchShift()
        fx.setValue('autoTune', atm.pitchCorrection ? 'active.ledon' : 'off')
      }
    },
    controller: _ => int.controller = value,
    pitchCorrection: _ => fx.recalcPitchShift()
  }[key] || (_ => fx.cmdProc(value, key))) //: all commands sent to cmdProc

  bpmTransformerFx.construct = (fx, pars, {int, atm, exo} = fx) => {
    int.pitchShifter = newFx('fx_pitchShifter') //: def params = no shift
    fx.start.connect(fx.output)
    
    const insertPitchShifter = _ => {
      if (!int.isPitchShifterOn) {
        int.pitchShifter.connect(fx.output)
        fx.start.disconnect()
        fx.start.connect(int.pitchShifter)
        int.isPitchShifterOn = true
      }
    }
    const removePitchShifter = _ => {
      if (int.isPitchShifterOn) {
        fx.start.disconnect()
        fx.start.connect(fx.output)
        int.pitchShifter.disconnect()
        int.isPitchShifterOn = false
      }
    }
    fx.recalcPitchShift = _ => { //: offset: man, bpmmod: do it, pitchCorr: do it
      if (atm.pitchCorrection && atm.pitch !== 100) {
        insertPitchShifter()
        const ratio = log(int.bpmOut) / log(int.bpmIn)
        const newOffset = ratio - 1
        int.pitchShifter.setValue('offset', newOffset)
      } else {
        removePitchShifter()
        int.pitchShifter.setValue('offset', 0)
      }
    }
    const lazySetSpeed = startEndThrottle(_ => int.controller?.speed(atm.pitch / 100), 100)
    
    //: pitch, bpm and bpm mod, they each affect the other two. So the recalc is a bit tricky.
    
    fx.hasBeenSet = _ => ~~atm.bpmOriginal !== exo.def.bpmOriginal.defVal
    
    fx.setAdjustedDisp = _ => 
      fx.setValue('bpmAdjusted', int.bpmOut.toFixed(1) + (fx.hasBeenSet() ? '#mod' : ''))
    
    fx.pitchChanged = pitch => { //: mod remains, bpmOut will change
      int.bpmOut = int.bpmIn * pitch / 100
      atm.bpmModifier = int.bpmOut - int.bpmIn
      //fx.setValue('bpmModifier')
      lazySetSpeed()
      fx.setAdjustedDisp()
      fx.recalcPitchShift()
    }
    fx.bpmOrigChanged = value => { //: pitch remains, bpmMod & bpmOut will change
      const [bpm] = value.split?.('#') ?? [value]
      int.bpmIn = parseInt(bpm)
      int.bpmOut = int.bpmIn * atm.pitch / 100
      fx.setValue('bpmModifier', int.bpmOut - int.bpmIn)
      fx.setAdjustedDisp()
    }
    fx.bpmModChanged = modifier =>  //: bpmIn remains, pitch will change -> then bpmOut
      fx.setValue('pitch', 100 * (modifier + int.bpmIn) / int.bpmIn)

    fx.setPitchToBpm = bpm => {
      console.warn('fix dpm set', bpm, atm.pitch, int.bpmIn, 100 * bpm / int.bpmIn)
      fx.setValue('pitch', 100 * bpm / int.bpmIn)
    }

    fx.cmdProc = (fire, mode) => {
      if (fire === 'fire') {
        const action = {
          incBpm: _ => fx.setValue('bpmModifier', atm.bpmModifier + 1),
          decBpm: _ => fx.setValue('bpmModifier', atm.bpmModifier - 1),
          reset: _ => fx.setValue('bpmModifier', 0)
        }[mode]
        void action?.()
        fx.setValue(mode, 'on')
      }
    }
  }
  registerFxType('fx_bpmTransformer', bpmTransformerFx)
})
