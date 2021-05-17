/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   standard/no-callback-literal, object-curly-newline */
   
import * as pgIm from './improxy-esm.js'

const {Corelib, BeeFX, Sources, StateManager, StageManager, createUI} = pgIm
const {undef, getRnd, isStr} = Corelib
const {schedule, adelay} = Corelib.Tardis
const {wassert} = Corelib.Debug

const createPlayground = async root => {
  const {waCtx, ui} = root
  const beeFx = root.beeFx = BeeFX(waCtx)
  const {namesDb, onReady: onBeeReady, getFxType} = beeFx
  await onBeeReady()
  
  ui.configNames(namesDb)
  
  const output = waCtx.createGain() //: This needs a gain and could be a global mute.
  
  const stageMan = StageManager.createStageManager(root)
  const {getStage} = stageMan

  const pg = {
    beeFx,
    stageMan,      //: this should be added to root instead
    //: Sync with remote window - turned off now
    lastSentAt: 0,
    lastReceivedAt: 0,
    senderStage: undef,   //: the stage object (not used now)
    listenerStage: undef, //: the stage object (not used now)
    meState: {},
    meStateHash: '',
    //: end of sync part
    fingerPrint: getRnd(100000, 999999),
    getFxType
  }
  
  pg.sources = Sources.createSources(pg, root)
  //pg.players = Players.extendWithPlayers(pg, root) // no sync!
  //const {radio} = pg.players
  
  //8#a66 ----------- Change core playground Fxs -----------
    
  //pg.changeFx = (stageId, ix, type) => stageMan.changeFx({stageId, ix, type})
  
  pg.addFx = (stageId, name) => stageMan.addFx(stageId, name)
  
  //8#46f ------------- Sync control: Master/slave stage settings -------------
  
  const activateMaster = stageId => {
    pg.senderStage = getStage(stageId)
    pg.isMaster = true
    pg.senderStage.fpoEndRatio.panel.set('send', {class: 'active'}) 
  }
  const activateSlave = stageId => {
    pg.listenerStage = getStage(stageId)
    pg.isSlave = true
    pg.listenerStage.fpoEndRatio.panel.set('listen', {class: 'active'}) 
  }
  const inactivateMaster = _ => {
    void pg.senderStage?.fpoEndRatio.panel.set('send', {declass: 'active'}) 
    delete pg.senderStage
    pg.isMaster = false
  }
  const inactivateSlave = _ => {
    void pg.listenerStage?.fpoEndRatio.panel.set('listen', {declass: 'active'}) 
    delete pg.listenerStage
    pg.isSlave = false
  }
  const clearSendersListeners = _ => {
    inactivateMaster()
    inactivateSlave()
  }
  pg.setSenderStage = (stageId = -1) => {
    stageId === -1 && (stageId = 0) //: or getStageGroup's last Index
    const newSenderStage = getStage(stageId)
    clearSendersListeners()
    activateMaster(newSenderStage)
  }
  pg.setListenerStage = stageId => {
    const newListenerStage = getStage(stageId)
    clearSendersListeners()
    activateSlave(newListenerStage)
  } 
  
  //8#59c  ---------------- Stage init / change ----------------
  
  pg.addStage = letter => {
    const stPars = {hasEndSpectrum: root.config.showEndSpectrums, hasEndRatio: true, hasUi: true}
    const stage = stageMan.createStage({letter}, stPars)
    const {stageIx} = stage
    stage.changeFx({ix: 0, type: 'fx_gain', params: {isFixed: true, hasStageMark: true}})
    stage.output.connect(output)
    return stageIx
  }
  
  pg.destroyLastBlanks = _ => stageMan.iterateStandardStages(stage => stage.destroyLastBlanks())
  
  pg.rebuildStage = stageId => getStage(stageId)?.rebuild() //: re ui regen click - not imp

  pg.activateStage = (stageId, on) => getStage(stageId)?.activate(on)
  
  //8#c78 --------- Entry point / init --------- 
  
  const init = _ => {
    console.log(BeeFX(waCtx).fxHash)
    output.connect(waCtx.destination)
    //: no sync:
    //pg.players.init()
    //pg.players.initRadioListeners()
  }
  
  pg.changeDestination = newDestination => { //: not used, but it could redirect the final output
    output.disconnect()
    output.connect(newDestination)
  }
    
  pg.loadPreset = actPreset => { //: startup mode 1: preset
    const stageNames = []
    
    for (const key in actPreset) {
      stageNames.includes(key) || stageNames.push(key)
    }
    stageNames.sort()

    for (const stageName of stageNames) {
      pg.addStage(stageName)
    }      
    for (const key in actPreset) {
      const arr = actPreset[key]
      for (const fx of arr) {
        fx && pg.addFx(key, fx[2] === '_' ? fx : ('fx_' + fx)) 
      }
    }
  }
  
  pg.loadProjectOnStart = async projName => { //: startup mode 2: project
    console.log('pg: project load START') //: still needed for testing async timings
    const project = root.stateManager.loadProject(projName)
    if (project) {
      const {stageLetters, stages, sourceRequests = [], flags = {}} = project
      
      for (const key in flags) {
        key.slice(-2) === 'On' || ui.setFlag(key, flags[key])
      }
      for (const {method, sourceIx, par} of sourceRequests) {
        void ui[method]?.(sourceIx, par)
      }
      for (const stageName of stageLetters) {
        pg.addStage(stageName)
        const {state, sourceIx} = stages[stageName]
        const stage = stageMan.getStage(stageName)
        stage.loadState(state)
        while (sourceIx > 0 && !pg.sources.sourceArr[sourceIx]) { // eslint-disable-line
          //: sometimes youtube iframes die why loading, this is the reason of this check:
          console.log('pg.loadProjectOnStart is waiting for source', sourceIx)
          await adelay(1000)
        }
      }
      schedule(0).then(_ => { //: wait for the ui to finalize in this cycle, so push this a bit
        for (const stageName of stageLetters) {
          const {sourceIx} = stages[stageName]
          sourceIx !== -1 && pg.sources.changeStageSourceIndex(stageName, sourceIx)
        }
      })
    } else {
      console.warn(`No such project in storage:`, projName)
    }
    console.log('pg: project load END')
  }
  
  pg.reloadWithProject = projName => { //: just set a new project in localStorage and RELOAD
    root.stateManager.setActProject(projName)
    window.location.href = window.location.href // eslint-disable-line no-self-assign
  }
  
  pg.saveProject = (projName, projDesc = '') => {
    const stageLetters = []
    const stages = {}
    stageMan.iterateStandardStages(stage => {
      stageLetters.push(stage.letter)
      stages[stage.letter] = {state: stage.saveState(), sourceIx: stage.sourceIx}
    })
    const sourceRequests = []
    ui.iterateSourceUis(sourceUi => {
      sourceUi.request && sourceRequests.push(sourceUi.request)
    })
    const {flags} = root
    const project = {projDesc, stageLetters, stages, sourceRequests, flags}
    root.stateManager.saveProject(project, projName)    
  }
  
  pg.createNewProject = projDesc => {
    const stageLetters = []
    stageMan.iterateStandardStages(stage => {
      stageLetters.push(stage.letter)
    })
    const projName = stageLetters.join('') + getRnd(100, 999) //: tmp: we have a projectname
    pg.saveProject(projName, projDesc)
  }

  init()
  
  return pg
}

//8#b39 All app entry points are here (beeFxPlayground site, CromBee, Patashnik)

const extendRoot = async root => {
  root.flags = {
    autoplay: false,
    autostop: false,
    syncSources: false, //: synced play/stop/speed of all sources
    redresh: false      //: redresh=reduced refesh, I'm apologizing. 
    //: ..too many more to enumerate here, they will be added anyway with the ui toggle defs.
  }

  root.setFlag = (name, on) => {
    wassert(isStr(name))
    root.flags[name] = on
    if (name === 'redresh' && root.beeFx) {
      root.beeFx.beeState.redreshOn = root.flags.redresh
      void root.vis?.reduceRefresh(root.flags.redresh)
    }
    return on
  }
  
  root.ui = createUI(root)
  root.midi = pgIm.TestMidi?.createTestMidi(root.ui) //: MIDI test
  
  root.pg = root.playground = await createPlayground(root)
  await root.ui.start(root.playground)
}

export const runPlaygroundWithin = async (waCtx, options) => { //: no mediaE, ABSNs will be added
  const config = {
    maxSources: 8,
    ...options
  }
  const root = {
    config,
    waCtx,
    mediaElement: null,
    ...options
  }
  await extendRoot(root)
  return {root, playground: root.playground}
}

export const runPlayground = async root => { //: we may have a mediaElement in root
  await extendRoot(root)
  const {ui, playground} = root

  const setupName = root.onYoutube 
    ? root.killEmAll ? 'youtubeFull' : 'youtubeDefault'
    : 'last' //: = auto reload of last preset set
  
  const parent$ = root.config.presetDisplayOn ? document.body : undef
  
  root.stateManager = StateManager.create(root)
  
  root.stateManager.getActualPreset({name: setupName, parent$})
    .then(async ({actPreset, actProject}) => {
      actPreset && playground.loadPreset(actPreset) //: a name minek?
      actProject && await playground.loadProjectOnStart(actProject)

      ui.finalize()

      //: this should work delayed too (no video on non-watch youtbe pages in the first 10 sec)
      root.onYoutube
        ? root.mediaElement && ui.changeVideoElementSource(1, root.mediaElement)
        : playground.sources.getValidSourcesCnt() || ui.setFlag('sourceList', true)
    })
}
