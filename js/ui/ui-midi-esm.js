/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {DOMplusUltra, Midi} from '../improxy-esm.js'

const {set$} = DOMplusUltra
  /*
  This is a very rudimental and limited Midi interface (for testing).
  If the mouse is over an fx panel, the sliders can be set by theMIDI controller.
  (In this case there is a mark on the sliders displaying the mapping.)
  Currently it only supports the the AKAI MIDI MIX.
  */
  
export const createTestMidi = ui => {
  const midi = {
    activeFpo: null,
    midiMap: {},
    isReady: false
  }
    
  const onMidi = (track, controller, value) => {
    if (controller === 'vol') {
      const stage = ui.pg.stageMan.checkStageByLetter(String.fromCharCode(64 + track))
      //void stage?.endRatio?.setValue('gain', value / 127) 
      void stage?.fxArr[0]?.setValue('gain', Math.max(.0001, 2.0 * value / 127))
    }
    if (midi.activeFpo) {
      const {fx} = midi.activeFpo
      const key = midi.midiMap[controller + track]
      if (key) {
        const {min, max} = fx.getLinearValues(key)
        const midiValue = value / 127 * (max - min) + min
        fx.setLinearValue(key, midiValue)
      }
    }
  }
  
  Midi.createInterface(onMidi).init().then(_ => midi.isReady = true)
  
  const activateFpo = fpo => {
    if (!midi.isReady) {
      return
    }
    midi.midiMap = {}
    for (const node$ of midi.midifiedNodes || []) {
      set$(node$, {deattr: {midified: ''}})
    }
    midi.midifiedNodes = []
    if (fpo) {
      const {fx} = fpo
      const {pars: midipars, arrays: midiarrays} = fx.exo.midi || {}
      
      if (midipars) {
        for (let ix = 0; ix < midipars.length; ix++) { 
          const fill = (ctrl, key) => {
            if (key) {
              const track = ix + 1
              midi.midiMap[ctrl + track] = key
              midi.midifiedNodes.push(fpo.pars[key].input$)
              set$(fpo.pars[key].input$, {attr: {midified: ctrl + '.' + track}})
            }
          }
          const [hi, mid, lo] = midipars[ix].split(',')
          fill('hi', hi)
          fill('mid', mid)
          fill('lo', lo)
        }
      }
      if (midiarrays) {
        const fill = (ctrl, key) => {
          if (key) {
            const [min, max] = fx.exo.def[key].arrayIx
            for (let ix = min; ix <= max; ix++) {
              const track = ix + 1
              const realKey = `${key}[${ix}]`
              midi.midiMap[ctrl + track] = realKey
              midi.midifiedNodes.push(fpo.pars[realKey].input$)
              set$(fpo.pars[realKey].input$, {attr: {midified: ctrl + '.' + track}})
            }
          }
        }
        const [hi, mid, lo] = midiarrays.split(',')
        fill('hi', hi)
        fill('mid', mid)
        fill('lo', lo)
      }
      //console.table(midi.midiMap)
    } else {
    }
    midi.activeFpo = fpo
  }
  
  midi.addFpo = fxPanelObj => set$(fxPanelObj.fxrama$, {on: {
    mouseenter: _ => activateFpo(fxPanelObj),
    mouseleave: _ => activateFpo(null)
  }})
  
  return midi
}
