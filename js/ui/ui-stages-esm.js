/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra} from '../improxy-esm.js'

const {weject} = Corelib.Debug
const {div$, set$, iAttr, canvas$} = DOMplusUltra

//8#49f -------------------------- Stages ui --------------------------

export const extendUi = ui => { //: input: ui.sourceStrip$ (empty)
  const {pg} = ui
  const {sources} = pg

  const stageHash = {} 
  const stageLetterHash = {} 
    
  ui.iterateStageObjects = callback => {
    for (const stageIx in stageHash) {
      const stageObj = stageHash[stageIx]
      stageObj && callback(stageObj)
    }
  }
  ui.getStageObj = stageIx => 
    stageHash[stageIx] || console.warn(`Invalid stage index: ${stageIx}`)
  
  ui.addStage = (stage, parent$ = ui.mid$, pars = {}) => { //: no optional parent~
    const {stageIx, letter, isStandardStage, hasEndSpectrum, isSourceStage, endRatio} = stage
    isSourceStage && (parent$ = ui.getSourceUi(stage.sourceStageIx).stage$)
    
    const stageObj = {
      stage,
      letter,
      stageIx,             //: stage index
      isEndRatio: !!endRatio,
      isStandardStage,
      fxPanelObjArr: [],    //:fx panel objects in the stage
      ...pars
    }
    
    const cc = 'bfx-stage bfx-st' + (stageIx + 1) + ' bfx-st-' + letter + (hasEndSpectrum ? '' : ' noendspectrum') + (isSourceStage ? ' sourcestage' : '')
            
    set$(parent$, {}, 
      stageObj.frame$ = div$({class: cc}, [
        stageObj.inputSelector$ = isStandardStage && div$({class: 'input-selector'}),
        stageObj.ramas$ = div$({class: 'bfx-ramas'}),
        stageObj.bottomFrame$ = isStandardStage && div$({class: 'st-bottomframe'}, [
          stageObj.endRatio$ = div$({class: 'bfx-rama isEndRatio'}),
          stageObj.spectrama$ = hasEndSpectrum && div$({class: 'st-spectrum huerot'},
            stageObj.spectcanv$ = canvas$())
        ])   
      ]))
    return stageHash[stageIx] = stageLetterHash[letter] = stageObj //eslint-disable-line no-return-assign
  }

  ui.resetStage = stageIx => { //:nothing to do? NOT USED
  }
  
  ui.createInputDispatchers = sourceIxArr => ui.iterateStageObjects(stageObj => {
    const {stageIx, isStandardStage} = stageObj
    if (isStandardStage) {
      const chg = sourceIx => _ => sources.changeStageSourceIndex(stageIx, sourceIx)
      set$(stageObj.inputSelector$, {class: 'blue'}, [
        div$({class: 'input-selbg huerot'}),
        div$({class: 'input-label', text: 'Input:'}),
        ...stageObj.inputCmd$$ = [0, ...sourceIxArr].map(sourceIx => div$({
          class: 'input-cmd bee-cmd', 
          text: sourceIx > 0 ? 'In ' + sourceIx : 'M',
          attr: {sourceIx, state: sourceIx > -1 ? 'off' : 'on'}, 
          click: chg(sourceIx)
        }))
      ])
    }
  })

  ui.setStageInputState = (stageIx, sourceIx) => {
    const stageObj = ui.getStageObj(stageIx)
    for (const inCmd$ of stageObj.inputCmd$$ || []) {
      const inputSourceIx = iAttr(inCmd$, 'sourceIx')
      if (sources.getSource(inputSourceIx) || inputSourceIx < 1) {
        set$(inCmd$, {attr: {state: sourceIx === inputSourceIx ? 'active' : 'on'}})
      } else {
        weject(sourceIx === inputSourceIx)
        set$(inCmd$,{attr: {state: 'off'}})
      }
    }
  }
      
  const init = _ => {
  }
  
  init()
}
