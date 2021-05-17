/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra, DragWithDOM, FxUiPars} from '../improxy-esm.js'

const {undef, nop, no, s_a} = Corelib
const {wassert} = Corelib.Debug
const {div$, set$, setClass$, toggleClass$} = DOMplusUltra
const {addDraggable, addDragTarget} = DragWithDOM

//: This module will be refaktored ASAP as things escalated here quickly.
//: So no big changes, just hacks fttb.
//: fxPanelObj will be the main object holding most methods instead of ui.
  
export const extendUi = ui => {
  const {root, pg} = ui

  const logOn = true
  const clog = (...args) => logOn && console.log(...args)
  
  const {createParsInPanel, addListSelector} = FxUiPars.createFxParControls(ui)
  
  //8#c47 fxPanelObj management
  
  const createFxPanelObj = (stageObj, ix, par = {}, {stageIx, stage} = stageObj) => ({
    stageObj, stageIx, stage,//: base object of the stage, if there is one
    ix,                       //:vertical index        
    fxrama$: ix === -1 ? stageObj.endRatio$ : div$(stageObj.ramas$),
                         //: fxrama$ is the most external div of the fx panel
    panel: undef,        //: panel is the pars frame inside fxrama$ (also: del, chgfx, led)
    fx: undef,           //: the linked beeFx fx object (mutable)
    fxname: '',          //: name (type) of fx (mutable)
    isEndRatio: ix === -1,
    isOnOff: true,       //: flag for the bypass led, can be rewritten with pars
    isFixed: false,      //: flag for fx selector and close icon, can be rewritten with pars
    ...par
  })
  
  const iterateAllFxPanelObjs = callback => {
    ui.iterateStageObjects(stageObj => {
      for (const fxPanelObj of stageObj.fxPanelObjArr) {
        fxPanelObj && callback(fxPanelObj)
      }
    })
  }
  const getExistingFxPanelObj = (stageId, ix) => {
    const stageObj = wassert(ui.getStageObj(stageId))
    return stageObj.fxPanelObjArr[ix]
  }
  const getFxPanelObj = (stageIx, ix, par) => {
    const stageObj = wassert(ui.getStageObj(stageIx))
    return stageObj.fxPanelObjArr[ix] = 
      stageObj.fxPanelObjArr[ix] || createFxPanelObj(stageObj, ix, par)
  }
  /* const getNewFxPanelObj = (stageIx, ix, par) => {
    const stageObj = wassert(ui.getStageObj(stageIx))
    return stageObj.fxPanelObjArr[ix] = createFxPanelObj(stageObj, ix, par)
  } */
  
  const reassignFxPanelObjFx = (fxPanelObj, nuFx) => {
    fxPanelObj.fx = nuFx   //: the assignment of the CURRENT fx to the STATIC fxPanelObj
    fxPanelObj.fxname = nuFx.getName()
    set$(fxPanelObj.fxrama$, {attr: {pepper: nuFx.getPepperDebug()}}) //: internal fx id display
  }
  
  const rebuildFxPanel = fxPanelObj => {
    const pars = {}
    const panel = {
      parsFrame$: div$({class: 'fxr-pars'}), //: internal frame of fx panel for parameters only
      scenes: [],
      graphs: {}
    }
    panel.set = ui.setHost(panel)
    fxPanelObj.capture({panel, pars, isActive: true}) //: always active after creation
    createParsInPanel(fxPanelObj)
  }
  
  ui.refreshFxPanelActiveState = ({fxrama$, isActive}) => setClass$(fxrama$, !isActive, 'bypass')
  
  ui.refreshFxPanelActiveStateByStageIx = (stageIx, ix) =>
    ui.refreshFxPanelActiveState(getExistingFxPanelObj(stageIx, ix))

  ui.setFxPanelActiveState = (fxPanelObj, on = !fxPanelObj.fx.isActive) => {
    fxPanelObj.isEndRatio 
      ? fxPanelObj.stage.activate(on)
      : fxPanelObj.fx.activate(on)
    fxPanelObj.isActive = on
    ui.refreshFxPanelActiveState(fxPanelObj)  
  }
  ui.toggleFxPanelActiveState = fxPanelObj => ui.setFxPanelActiveState(fxPanelObj)

  ui.destroyStageLastFxPanel = (stageObj, fx) => {
    const lastFpo = stageObj.fxPanelObjArr.pop()
    wassert(lastFpo.fx === fx)
    void lastFpo.fxrama$?.remove()
  }  
  ui.rebuildStageFxPanel = (stageIx, ix, fx, par = {}) => {
    //: creates fxPanelObj on 1st callonly -> reuse on later calls (like changeFx())
    //: todo: fxPanels must be recreated, not reused!!

    const fxPanelObj = getFxPanelObj(stageIx, ix, par)
    const {stage, hasStageMark, isEndRatio, isFixed, fxrama$, isOnOff} = fxPanelObj
    
    reassignFxPanelObjFx(fxPanelObj, fx)  //: puts fx, fxname into fxPanelObj
    rebuildFxPanel(fxPanelObj)            //: puts panel into fxPanelObj
    const {fxname, panel} = fxPanelObj     //:fxname is in the 'Blank' format (not fx_blank!)
    
    const isBlank = fxname === 'Blank'    //: see?
    const isGain = fxname === 'Gain'
    const isRemoveable = !isFixed && !isBlank
    const isAlterable = !isFixed
    const isFoldable = isRemoveable       //: for now, but it can be different in theory
    const isFolded = isFoldable && (fxname === 'Scope' || fxname === 'Hi-res spectrum')
    fxPanelObj.capture({isBlank, isGain, isRemoveable, isAlterable, isFoldable})

    const truePropsToArr = obj => obj.propertiesToArr().filter(key => obj[key])

    const auxClass = truePropsToArr({isBlank, isGain, isOnOff, isFixed, isRemoveable, isAlterable, isFoldable, hasStageMark, isFolded, isEndRatio}).join(' ')
    
    const fxSelector$ = isAlterable &&
      addListSelector({}, 'selfx', fxname, ui.namesDb.fxNames, 
        nfx => pg.stageMan.changeFx({stageId: stageIx, ix, type: nfx}))
      
    const foldIcon$ = isFoldable &&
      div$({class: 'bfx-foldicon', click: event => {
        const isFolded = toggleClass$(fxrama$, 'isFolded')
        if (event.altKey) { //: do the same with all fxpanels of the same type
          iterateAllFxPanelObjs(fpo => (event.ctrlKey || fpo.fxname === fxname) && 
            fpo.isRemoveable && setClass$(fpo.fxrama$, isFolded, 'isFolded', clog(fpo)))
          //: maybe this should be filtered to normal stages and not fixed fxs
        }
      }})
      
    const remove$ = isRemoveable && div$({class: 'bfx-delete',
      click: _ => pg.stageMan.changeFx({stageId: stageIx, ix, type: 'fx_blank'})})
      
    const bypassLed$ = isOnOff && 
      div$({class: 'led-fx bfxact fix-on', click: _ => ui.toggleFxPanelActiveState(fxPanelObj)})
    
    //: The ratio fx sends events on cmds activated on it's panel.
    //: We will eventually need to use EventEmitter2 or fix this somehow.
    
    if (isEndRatio) {
      fx.setValue('onCmd', ({op, par}) => void {
        activate: _ => ui.setFxPanelActiveState(fxPanelObj, par),
        regen: _ => stage.rebuild(),
        clone: _ => stage.clone(),
        master: _ => _,
        slave: _ => _,
        dbgDeact: _ => stage.deactivate(),
        dbgDecomp: _ => stage.decompose(),
        dbgReset: _ => stage.reset(),
        dbgChg: _ => stage.chg(),
        dbgComp: _ => stage.compose(),
        dbgAct: _ => stage.activate()
      }[op]?.())
    }
    const topmenu$ = no && isEndRatio && div$({class: 'bfx-topmenu'}, [
      div$({class: 'bfx-mitem', text: 'Solo', click: _ => stage.setSolo()}),
      div$({class: 'bfx-mitem', text: 'Regen', click: _ => pg.rebuildStage(stageIx)}),
      div$({class: 'bfx-mitem', text: '===', click: pg.equalRatios}),
      div$({class: 'bfx-mitem', text: 'Save', click: nop}),
      panel.send$ = div$({click: _ => pg.setSenderStage(stageIx), 
        class: 'bfx-mitem wled send', text: 'Master'}, div$({class: 'led-fx fix-on'})),
      panel.listen$ = div$({class: 'bfx-mitem wled listen', text: 'Slave', 
        click: _ => pg.setListenerStage(stageIx)}, div$({class: 'led-fx fix-on'}))
    ])
    
    //: These handlers can be put outside the function as they don't use closure vars - anyway.
    
    const dragDroppedOnEndRatio = dstLetter => (data, mod, event) => {
      const [source, slot] = data.split('.')
      if (source === 'fromSlot') {
        root.stateManager.onSlotToStageDrop({dstLetter, slot})
      } else if (source === 'fromStage') {
        const srcLetter = slot
        root.stateManager.onStageToStageDrop({dstLetter, srcLetter})
      } else if (source === 'fromFactory') {
        clog(`dragDroppedOnStage from factory `, {dstLetter, data, source, slot})
        if (event.altKey) {
          pg.stageMan.iterateStandardStages(stage => pg.addFx(stage.letter, slot))
        } else {
          pg.addFx(stage.letter, slot) //: slot is fxname (type)
        }
      }
    }
    const dragDroppedOnNotFixedFx = (dstLetter, dstIx) => (data, mod, event) => {
      const [source, fxname] = data.split('.') // eslint-disable-line no-unused-vars
      clog(`drag dropped on not fixed fx`, {data, mod, fxPanelObj})
      event.shiftKey
        ? pg.stageMan.insertFxBefore({stageId: dstLetter, ix: dstIx, type: fxname})
        : pg.stageMan.changeFx({stageId: dstLetter, ix: dstIx, type: fxname})
    }
    
    //: we need a better stringifyable reference to the fx panels
    const drid = stage.letter + '.' + fx.zholger
    set$(fxrama$, {attr: {drid}})
    
    const dragger$ = isEndRatio && 
      addDraggable(div$({class: 'fx-dragger', attr: {drid}}), 'fromStage.' + stage.letter)
      
    //: This will add drag listeners again and again to the same fxrama.
    //: Refaktoring will solve this (no reuse of fxrama).
    
    isEndRatio && addDragTarget(fxrama$, dragDroppedOnEndRatio(stage.letter))
    
    !isFixed && addDragTarget(fxrama$, dragDroppedOnNotFixedFx(stage.letter, ix))
    
    fxrama$.className = 'bfx-rama' //: reset
    
    set$(fxrama$, {class: auxClass, attr: {fxname}, html: ''}, [
      bypassLed$,
      fxSelector$,
      topmenu$,
      foldIcon$,
      remove$,
      panel.parsFrame$,
      dragger$
    ])
    
    return fxPanelObj
  }
  
  ui.rebuildStageEndPanel = (stage, ratioFx) => 
    ui.rebuildStageFxPanel(stage.stageIx, -1, ratioFx, {isFixed: true})
    
  //8#a5a Temporary drag and drop factory panel for FXs  
    
  ui.onFactoryToggled = on => {
    set$(ui.factoryFrame$, {html: ''})
    set$(ui.bigmid$, {declass: 'factoryon'})
    const {fxHash} = pg.beeFx
    
    //: The categorization of the FXs is TODO, in the beginning there were a few, now
    //: there are over 60 fxs, some grouping is needed. (Also marking obsolete and internal FXs.) 
    //: For now this is an ugly (tmp) manual categorization for the factory menu.
    
    const fxnames = fxHash.propertiesToArr()
    const cats = {
      basic: {catName: 'Basic', arr: [], cc: 'half', hue: 120},
      filter: {catName: 'Filter', arr: [], cc: 'half', hue: 60},
      equalizer: {catName: 'Equalizer', arr: [], cc: 'half', hue: 200},
      iir: {catName: 'IIR filter', arr: [], cc: 'half', hue: 330},
      delay: {catName: 'Delay', arr: [], cc: 'half', hue: 160},
      convolver: {catName: 'Convolver/Reverb', arr: [], cc: '', hue: 300},
      noise: {catName: 'Noise', arr: [], cc: 'half', hue: 30},
      eflfo: {catName: 'EF/LFO', arr: [], cc: 'half', hue: 120},
      generator: {catName: 'Generator', arr: [], cc: 'half', hue: 45},
      distortion: {catName: 'Distortion', arr: [], cc: 'half', hue: 0},
      complex: {catName: 'Complex', arr: [], cc: 'half', hue: 15},
      device: {catName: 'Device', arr: [], cc: 'half', hue: 240},
      visual: {catName: 'Visual', arr: [], cc: 'half', hue: 300},
      misc: {catName: 'Misc', arr: [], cc: 'half', hue: 90}
    }
    for (const fxname of fxnames) {
      const exo = fxHash[fxname]
      const short = fxname.substr(3).toLowerCase()
      //: this is an ugly, but tmp hack:
      const invalids = s_a('ratio,jungle,bpmtransformer,envelopefollower')
      exo.cc = exo.name.includes('DEPRECATED') || invalids.includes(short) ? ' fade' : ''
      let cat = 'misc'
      const match = (arr, target) => {
        for (const pattern of arr.split(',')) {
          short.includes(pattern) && (cat = target)
        }
      }
      match('pitch,compr', 'complex')
      match('iir', 'iir')
      match('biqu,amp', 'filter')
      match('scope,spectr', 'visual')
      match('blank,gain,ratio', 'basic')
      match('conv,reverb,cabi', 'convolver')
      match('lfo,ef,wah,vibr','eflfo')
      match('ring,over', 'distortion')
      match('dela', 'delay')
      match('wave,oscilla', 'generator')
      match('eq', 'equalizer')
      match('noise,crush,pink', 'noise')
      match('samp,rec,bpm', 'device')
      cats[cat].arr.push(fxname)
    }
    const catArr = cats.propertiesToArr()
    clog(cats)
    
    if (on) {
      set$(ui.bigmid$, {class: 'factoryon'})
      div$(ui.factoryFrame$, {class: 'factory-inner'}, catArr.map(catKey =>
        div$({class: 'fact-fxcat', css: {__hue: cats[catKey].hue}}, [
          div$({class: 'fact-catname ' + cats[catKey].cc, text: cats[catKey].catName}), 
          ...cats[catKey].arr.map(fxname => addDraggable(div$({
            class: 'fact-fx' + fxHash[fxname].cc, 
            attr: {drid: fxname},
            html: `${fxHash[fxname].name}<br><em>${fxname}</em>`
          }), 'fromFactory.' + fxname))
        ])))
    }
  }
}
