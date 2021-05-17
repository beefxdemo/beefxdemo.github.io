/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {BeeFX, onWaapiReady} from '../beeproxy-esm.js'

onWaapiReady.then(waCtx => {
  const {connectArr, registerFxType, dB2Gain} = BeeFX(waCtx)
  
  const createAmpControl = ({skipUi = false, name}) => { //8#48d ------- ampControl -------
    const ampFx = {
      def: {
        hi: {defVal: 0, min: -25, max: 25, unit: 'dB'},
        hiCutOffFreq: {defVal: 2400, min: 800, max: 4800, unit: 'Hz', subType: 'exp', skipUi},
        lo: {defVal: 0, min: -25, max: 25, unit: 'dB'},
        loCutOffFreq: {defVal: 600, min: 200, max: 1200, unit: 'Hz', subType: 'exp', skipUi},
        pan: {defVal: 0, min: -.5, max: .5},
        vol: {defVal: 0, min: -24, max: 6, unit: 'dB'}, //: pan&vol could be graph'd too
        multiGraph: {type: 'graph', subType: 'multi'}
      },
      midi: {pars: ['hi,lo', skipUi ? '' : 'hiCutOffFreq,loCutOffFreq', 'pan,vol']},
      name,
      graphs: {
        multiGraph: [{ //: this is a double graph, ie two graphs on the same canvas
          graphType: 'freq',
          filter: 'loNode',
          minDb: -27,
          maxDb: 33,
          diynamic: .8,
          customRenderer: {
            pre: ({fx, cc, ccext, freq}) => { //: vol/pan visual in the bg
              const mid = ccext.width / 2
              const {height} = ccext
              const [y1, hi] = [height / 5 + 5,  height * 2 / 3]
              const panPt = (fx.atm.pan + .5) * 100
              const volPt = dB2Gain(fx.atm.vol) * 50
              const right = Math.min(50, panPt) * volPt / 100
              const left = Math.min(50, 100 - panPt) * volPt / 100
              const leftx = mid - left * 8
              const rightx = mid + right * 8
              const gradientLeft = cc.createLinearGradient(leftx, 0, mid, 0)
              gradientLeft.addColorStop(0, `hsla(200,75%,50%,.25)`)
              gradientLeft.addColorStop(1, `hsla(200,75%,50%,.5)`)
              const gradientRight = cc.createLinearGradient(mid, 0, rightx, 0)
              gradientRight.addColorStop(0, `hsla(0,75%,50%,.5)`)
              gradientRight.addColorStop(1, `hsla(0,75%,50%,.25)`)
              
              cc.fillStyle = gradientLeft
              cc.fillRect(leftx, y1, mid - leftx, hi)
              cc.fillStyle = gradientRight
              cc.fillRect(mid, y1, rightx - mid, hi)
            }
          },
          phaseCurveColor: `hsla(120, 99%, 80%, .5)`,
          curveColor: ({xpt}) => `hsla(120, 90%, 55%, ${transExp(xpt)})`
        }, {
          graphType: 'freq',
          filter: 'hiNode',
          renderSet: {doClear: false, doGrid: false, doGraph: true},
          minDb: -27,
          maxDb: 33,
          diynamic: .8,
          phaseCurveColor: `hsla(20, 99%, 80%, .5)`,
          curveColor: ({xpt}) => `hsla(20, 99%, 65%, ${transExp(1 - xpt)})`
        }]
      }
    }

    const transExp = xpt => (1 - Math.pow(1 * xpt, 3)).toFixed(2)
    
    ampFx.setValue = (fx, key, value) => ({
      pan: _ => fx.setAt('panNode', 'pan', value),
      hi: _ => fx.setAt('hiNode', 'gain', value),
      lo: _ => fx.setAt('loNode', 'gain', value),
      hiCutOffFreq: _ => fx.setAt('hiNode', 'frequency', value),
      loCutOffFreq: _ => fx.setAt('loNode', 'frequency', value),
      vol: _ => fx.setAt('volNode', 'gain', dB2Gain(value))
    }[key])
    
    ampFx.construct = (fx, pars, {int} = fx) => {
      int.loNode = waCtx.createBiquadFilter()
      int.loNode.type = 'lowshelf'
      int.hiNode = waCtx.createBiquadFilter()
      int.hiNode.type = 'highshelf'
      int.panNode = waCtx.createStereoPanner()
      int.volNode = waCtx.createGain()
      connectArr(fx.start, int.volNode, int.panNode, int.hiNode, int.loNode, fx.output)
    }
    return ampFx
  }
  registerFxType('fx_amp', createAmpControl({name: 'Amp controls', skipUi: true}))
  registerFxType('fx_ampExt', createAmpControl({name: 'Amp controls (extended)'}))
})
