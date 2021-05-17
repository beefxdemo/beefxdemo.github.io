/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, Visualizer} from './improxy-esm.js'

const {undef, isStr} = Corelib
const {wassert, weject} = Corelib.Debug
const {startEndThrottle, post} = Corelib.Tardis
void post
  /*
  StageManager can have many stages of different types (normal, source, internal, headless, etc).
  A Stage is a sequential chain of beeFxs (or beeExts) + scaffolding.
  Scaffolding has fixed (input, source, mayday) and optional (endRatio, vis) parts.
  A stage doesn't know anything about it's source, whether it's media or not.
  Stages with endRatio forms a group and these stages are linked (and can be requested as a list).
  This is stageGroup. (Accessible with iterateStandradStages.)
  Stages can have ui assigned to them (uiStage), but they work without ui too.
  Activating/deactivating a stage means deactivating all fxs in it (+ endRatio if there is one).
  Stages have indexes (indices!) (auto or manual). 
  These cannot be freely mixed - no empty slots. (Allocating 0 3 1 2 is ok, but 0 3 2 is not.)
  Indexes are assigned internally as allocating slots in the array.
  Allocating through the playground with letters is the optimal way (playground takes care of this).
  Stages have letters assigned to them. This is the main identifier for a stage.
  - A-P are normal (standard) stages (ABCD EFGH IJKL [MNOP - not yet]).
  - S1..S8..S? are player/source control stages for sources.
  - LOC, REM, FAD, MIX are reserved for special stage types.
  Access is possible by both (indexes and letters).
  Most methods can recognize both type of reference (see stageId as param name).
  */
export const createStageManager = root => {
  const {waCtx, beeFx} = root
  const {newFx} = beeFx 
  
  //8#c89 -------- Helpers --------
  
  const connectArrayDest = (array, dest) => {
    for (let ix = 0; ix < array.length; ix++) {
      array[ix].connect(array[ix + 1] || dest)
    }
  }
  
  //8#c84 -------- StageMan start --------
  
  const stages = []
  const stageLetterHash = {}
    
  window.stages = stages //: debug only
  
  const iterateStages = callback => {
    for (const stage of stages) {
      stage && callback(stage)
    }
  }
  const iterateStandardStages = callback => {
    for (const stage of stages) {
      stage?.isStandardStage && callback(stage)
    }
  }
  const getStageArr = _ => stages.filter(stage => stage)
  
  const getFilteredStages = filter => getStageArr().filter(stage => filter(stage))
  
  const getStageByIx = stageIx => wassert(stages[stageIx])
  
  const getStageByLetter = letter => wassert(stageLetterHash[letter])
  
  const getStageById = stageId => isStr(stageId) ? getStageByLetter(stageId) : getStageByIx(stageId)

  const checkStageByLetter = letter => stageLetterHash[letter]
  
  const getStageGroup = _ => stages.filter(stage => stage.endRatio)
  
  const getEndRatios = _ => getStageGroup().map(stage => stage.endRatio)
  
  const stageMan = {
    iterateStages, 
    iterateStandardStages,
    getStage: getStageById,
    checkStageByLetter,
    getStageGroup,
    getEndRatios,
    getFilteredStages,
    stages
  }
  
  stageMan.dump = startEndThrottle(_ => {
    console.table(stages)
  }, 500)

  stageMan.changeFx = ({stageId, ix, type}) => {
    const stage = getStageById(stageId)
    if (stage) {
      stage.changeFx({ix, type})
    } else {
      console.warn(`stageMan.changeFx: no stage (${stage.stageIx})`, {ix, type, stages})
    }
  }
  stageMan.insertFxBefore = ({stageId, ix, type}) => {
    const stage = getStageById(stageId)
    if (stage) {
      stage.insertFxBefore({ix, type})
    } else {
      console.warn(`stageMan.insertFxBeforeFx: no stage (${stage.stageIx})`, {ix, type, stages})
    }
  }
  
  stageMan.addFx = (stageId, type) => getStageById(stageId).changeFx({type})

  stageMan.getFxById = (stageId, ix) => getStageById(stageId).fxArr[ix]
  
  stageMan.onGlobalCommand = par => iterateStandardStages(stage => stage.onGlobalCommand(par))

  //8#76e -------- Stage factory --------
  
  stageMan.createStage = ({letter, nuIx = stages.length}, params) => {
    const defaultParams = {
      hasEndSpectrum: false,
      hasEndRatio: false,
      hasUi: true,
      isSourceStage: false,
      sourceStageIx: 0 //: not 0 if sourceStage, tmp
    }
    const stageParams = {
      ...defaultParams,
      ...params
    }
    //8#b58  -------- Init of one stage --------
    
    const stageIx = nuIx
    const fxArr = []
    const endRatio = stageParams.hasEndRatio ? newFx('fx_ratio') : undef //: cannot be false (?.)
    if (endRatio) {
      beeFx.debug.addStage(endRatio, letter + ':')
      beeFx.debug.markNode(endRatio, `stages[${nuIx}]-endRatio`)
    }
    const output = endRatio || waCtx.createGain()
      
    void endRatio?.chain(...getEndRatios()) //: only the other chain elements' stage is needed
    
    const stage = {
      nuIx,
      ix: nuIx,
      stageIx,
      letter,
      isStandardStage: letter.length === 1, //: very rudimental
      input: waCtx.createGain(), //: this is fix
      endRatio,
      output,
      sourceIx: -1,              //: Sources module reads/writes this directly
      analyser: undef,
      vis: undef,
      fxArr,
      uiStage: undef,            //: If the stage has an ui, also it's a flag for this
      ...stageParams
    }
    beeFx.debug.markNode(stage.input, `stages[${nuIx}].input`)
    
    if (stage.hasEndSpectrum) {
      stage.analyser = waCtx.createAnalyser()
      stage.output.connect(stage.analyser)
    }
        
    stages.push(stage)
    weject(stageLetterHash[letter])
    stageLetterHash[letter] = stage
    
    if (stage.hasUi) {
      const parent$ = stage.isSourceStage ? undef : undef
      stage.uiStage = root.ui.addStage(stage, parent$)
      
      if (stage.analyser) {
        const {spectcanv$, levelMeter$} = stage.uiStage
        stage.vis = spectcanv$ && Visualizer
          .createSpectrumVisualizer(stage.analyser, spectcanv$, levelMeter$, nuIx, stage.mayday)
        root.vis = root.vis || stage.vis //: to have at least one remembered (redresh!)
      }
      stage.fpoEndRatio = endRatio && root.ui.rebuildStageEndPanel(stage, endRatio)
    }
  
    stage.mayday = data => { //: spectrum visualizer will call this if the sound is BAD
      stage.deactivate()     //: this is quite lousy protection as visualizers are optional...
      for (const fx of fxArr) {
        void fx.mayday?.(data)
      }
      console.warn(`❗️❗️❗️ Overload in stage ${stageIx}, turning off. ❗️❗️❗️`)
    }
    
    stage.activate = (on = true) => { //: only the endRatio will be changed!
      void endRatio?.activate(on)     //: so it's not possible to inactivate one without endRatio
      stage.fpoEndRatio && root.ui.refreshFxPanelActiveState(stage.fpoEndRatio)
      void stage.vis?.setActive(on)   //: turn it off just for performance gain
    }
    
    stage.deactivate = _ => stage.activate(false)
    
    stage.decompose = _ => { //: endRatio/output not affected!
      stage.input.disconnect()
      for (const fx of fxArr) {
        void fx?.disconnect()
      }
    }
    stage.compose = _ => {
      stage.input.connect(fxArr[0] || stage.output)
      if (fxArr[0]) {
        connectArrayDest(fxArr, stage.output)
      }
    }
    
    //8#974 stage global state listeners
    
    //: (sourceIx changes should be listened here too - now muting won't change the bpm - bad)
    
    const globalStageState = {}   //: store of last emitted values (for late arrivals)
      
    stage.onGlobalCommand = ({cmd, par = 'fire'}) => {
      for (const fx of fxArr) {
        for (const [propRequest, local] of fx.meta.listeners) {
          if (propRequest === cmd) {
            fx.setValue(local, par)
          }
        }
      }
    }
      
    stage.onGlobalChange = (prop, value) => { //: event in -> store & check all existing fxs
      globalStageState[prop] = value
      if (value) { //: 0 or undef -> no info
        for (const fx of fxArr) {
          for (const [propRequest, local] of fx.meta.listeners) {
            if (propRequest === prop) {
              fx.setValue(local, value)
            }
          }
        }
      }
    }
    const checkGlobalsForFx = fx => { //: new fx with listeners => check all processed globals
      for (const [prop, local] of fx.meta.listeners) {
        if (globalStageState[prop]) {
          fx.setValue(local, globalStageState[prop])
        }
      }
    }
    const addFxMeta = (fx,  metaObj) => {
      fx.meta = fx.meta || {}
      for (const key in metaObj) {
        fx.meta[key] = metaObj[key]
      }  
    }
    
    //8#7a4 Single point of normal Fx creation in playground
    //8#9c6 (almost, apart from endRatios, Fx internals & bpm in players)
    
    const changeFxLow = ({ix = fxArr.length, type, params = {}}) => {
      void fxArr[ix]?.deactivate()
      
      fxArr[ix] = newFx(type)
      beeFx.debug.addStage(fxArr[ix], letter + ix)
      addFxMeta(fxArr[ix], {stageId: letter})
      addFxMeta(fxArr[ix], {listeners: fxArr[ix].exo.listen?.map(lstn => lstn.split(':')) || []})
      checkGlobalsForFx(fxArr[ix])
      
      if (fxArr[ix]) { //: create ui for the fx if the stage has one
        stage.uiStage && root.ui.rebuildStageFxPanel(stage.ix, ix, fxArr[ix], params)
      } else {
        console.error(`Bad Fx type:`, type)
      }
      return fxArr[ix]
    }

    stage.changeFx = ({ix = fxArr.length, type, params = {}}) => {
      wassert(ix <= fxArr.length) //: the array can't have a gap
      stage.decompose()
      const fx = changeFxLow({ix, type, params})
      stage.compose()
      return fx
    }
    
    stage.insertFxBefore = ({ix = fxArr.length, type, params = {}}) => {
      wassert(ix <= fxArr.length) //: the array can't have a gap
      stage.decompose()
      for (let iix = fxArr.length; iix > ix; iix--) {
        fxArr[iix] = fxArr[iix - 1]
      }
      fxArr[ix] = undef
      const fx = changeFxLow({ix, type, params})
      const state = stage.saveState()
      stage.loadState(state)
      return fx
    }
    
    stage.saveState = _ => fxArr.map(fx => fx.getFullState())
    
    const destroyLastFx = _ => {
      wassert(fxArr.length)
      const fx = fxArr.pop() //: we need a destroy ui fpo here
      stage.uiStage && root.ui.destroyStageLastFxPanel(stage.uiStage, fx)
    }

    const destroyLastFxsAfter = newLen => {
      while (newLen < fxArr.length) {
        destroyLastFx()
      }
    }
    
    stage.destroyLastBlanks = _ => {
      while (fxArr.length > 1) {
        const lastIx = fxArr.length - 1
        if (fxArr[lastIx].getName() === 'Blank') {
          destroyLastFx()
          continue
        }
        break
      }
    }
    stage.reset = _ => {
      while (fxArr.length > 1) {
        destroyLastFx()
      }
    }
      
    stage.loadState = async fxStates => {
      stage.decompose()
      destroyLastFxsAfter(fxStates.length)
      
      for (let ix = 0; ix < fxStates.length; ix++) {
        const fxState = fxStates[ix]
        const type = wassert(fxState.fxName)
        fxArr[ix]?.isFixed || void changeFxLow({ix, type})?.restoreFullState(fxState)
        stage.uiStage.fxPanelObjArr[ix].isActive = fxArr[ix].isActive
        root.ui.refreshFxPanelActiveStateByStageIx(nuIx, ix)
      }
      stage.compose()
    }
    
    stage.rebuild = _ => { //: What is this for?
      const state = stage.saveState().filter(fxstate => fxstate.fxName !== 'fx_blank')
      console.log(state)
      stage.loadState(state)
    }
        
    stage.clone = _ => {
      const state = stage.saveState()
      iterateStandardStages(istage => {
        if (istage !== stage) { //: This condition isn't really needed. It can clone to itself too.
          istage.loadState(state)
        }
      })
    }
    
    stageMan.dump()
    
    return stage 
  }
  return stageMan
}
