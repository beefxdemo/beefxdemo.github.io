/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra, Store} from './improxy-esm.js'

const {undef} = Corelib
const {wassert} = Corelib.Debug
const {dateToHumanDateTime} = Corelib.DateHumanizer
const {schedule} = Corelib.Tardis
const {div$, set$} = DOMplusUltra

const store = Store.createStore('beeFX')

const fxMap = {
  g: 'gain', 
  a: 'amp',
  ax: 'ampExt',
  b: 'blank', 
  bi: 'biquad',
  scope: 'oscilloscope',
  waveGen: 'waveGenerator',
  cheb: 'chebyshevIIR',
  spect: 'spectrum',
  osc: 'oscillator',
  pwmOsc: 'pwmOscillator',
  pitch: 'pitchShifter',
  conv: 'convolver',
  convGen: 'convolverGen',
  phaser: 'phaserLFO',
  comp: 'compressor',
  sampler: 'sampler',
  od: 'overdrive',
  odwac: 'overdriveWAC'
}

const stagePresets = { //: These compressed defs are ugly, but it's easier to overview.
  preset1xb: {A: 'b'},
  preset2xb: {AB: 'b'},
  preset3xb: {ABC: 'b'},
  preset4xb: {ABCD: 'b'},
  preset5xb: {ABCDE: 'b'},
  preset6xb: {ABCDEF: 'b'},
  preset7xb: {ABCDEFG: 'b'},
  preset8xb: {ABCDEFGH: 'b'},
  preset9xb: {ABCDEFGHI: 'b'},
  preset10xb: {ABCDEFGHIJ: 'b'},
  preset11xb: {ABCDEFGHIJK: 'b'},
  preset12xb: {ABCDEFGHIJKL: 'b'},
  preset2sampler: {AB: 'b,sampler,scope'},
  preset4xbScope: {ABCD: 'b,scope'},
  preset3rec: {A: 'osc,sampler,scope', B: 'osc,recorder,scope', C: 'osc,sampler,scope'},
  preset2xpitch: {AB: 'b,pitchShifterNote,scope'},
  presetSix: {
    A: 'bpm,samplerNote',
    B: 'bi,wahWahEF,gain,scope',
    C: 'pingPongBeatDelay,convolver,scope',
    D: 'beatDelay,pitchShifterNote,odwac,scope',
    E: 'beatDelay,pingPongBeatDelay,eqb4,spectrum',
    F: 'beatDelay,wobble,scope'},
  prTakeFive: {
    A: 'g,comp,b',
    B: 'g,bi,b',
    E: 'g,ax,b',
    F: 'g,od,b',
    I: 'g,b,b'},
  presetA: {
    A: 'g,comp,b',
    B: 'g,bi,b',
    C: 'g,ax,b',
    D: 'g,od,b'},
  preset4x4b: {ABCD: 'b,b,b,b'},
  presetZero: {ABCD: 'b'},
  presetDebug: {
    A: 'osc,scope,od,scope',
    B: 'osc,scope,odwac,scope',
    C: 'delayWA,sampler,scope',
    D: 'delayExt,scope'},
  youtubeFull: {
    A: 'scope,bi,od,scope',
    B: 'scope,ax,odwac,b,scope',
    C: 'scope,ax,comp,b,scope',
    D: 'scope,bi,b,b,scope'},
  youtubeDefault: {
    A: 'pitchShifterNote,odwac,scope',
    B: 'conv,bi,scope',
    C: 'dattoroReverb,pingPongBeatDelay,scope',
    D: 'samplerNote,ax,scope'},
  youtubeMinimal: {ABCD: 'g,b,b'},
  presetBigBlank: {ABCD: 'g,bi,b,b,b,b'},
  presetFull: {
    A: 'g,bi,vibrato,b,b',
    B: 'g,bi,pitch,b,b',
    C: 'g,bi,bi,b,b',
    D: 'g,bi,moog,b,b'},
  test: {
    A: 'b,b,b,b,b,b',
    B: 'spect,convGen,scope,pitch,scope,g',
    C: 'spect,convGen,scope,pitch,scope,spect',
    D: 'spect,conv,reverb,spect,b'},
  pwm: {
    A: 'pwmOsc,scope,spect',
    B: 'osc,scope,spect',
    C: 'waveGen,scope,spect',
    D: 'waveTables,scope,pitch,spect'},
  scopeChain: {ABCDEFGHIJKL: 'delayWA,scope,b', E: 'delayWA,scope,spect'},
  cheb: {
    A: 'IIRcheb2,b,scope',
    B: 'IIRcheb4,b,scope',
    C: 'IIRcheb6,b,scope',
    D: 'IIRcheb8,scope'},
  graph: {
    A: 'IIRcheb4,od,scope',
    B: 'IIRmanual4,odwac,scope',
    C: 'eq6,eqb4,bi,scope',
    D: 'comp,delayExt,ax,scope'},
  golem: {
    A: 'IIRcheb4,bi,scope',
    B: 'IIRmanual4,ax,scope',
    C: 'scope,eqb4,vibrato,phaserLFO,bitCrusher,pinking,noiseConvolver,scope',
    D: 'eq10,delayExt,comp,scope',
    E: 'conv,eq6,tremoloLFO,od,scope',
    F: 'scope,autoWah,pingPongDelayA,pingPongDelayB,odwac,scope',
    G: 'chorusOsc,pitch,scope,bi,comp,reverb,scope',
    H: 'chorusLFO,od,ax,,jungle,pitch,scope',
    I: 'waveGen,bi,eq4,scope',
    J: 'IIRcheb8,cabinet,scope',
    K: 'waveGen,scope,convGen,scope,g',
    L: 'IIRmanual8,b,scope'},
  eq: {
    AE: 'scope,eq4,scope',
    BF: 'scope,eq6,scope',
    CG: 'scope,eq10,scope',
    DH: 'scope,eqb4,scope'}
}
export const create = root => {
  const {ui, pg} = root
  const {stageMan} = pg
    
  const stateManager = {
    stagePresets,
    slots: [{}],
    actProject: ''
  }
  const maxSlots = 100

//: name->ret, parent$->menu
  stateManager.getActualPreset = async ({name, parent$}) => new Promise(resolve => {
    const sx = str => str.split(',').map(a => (fxMap[a]) || a)
    
    const compile = obj => {
      const pg = {}
      for (const key in obj) {
        if (key.includes('X')) {
        } else {
          const fxs = sx(obj[key])
          key.split('').map(st => pg[st] = fxs)
        }
      }
      const ret = {}
      pg.propertiesToArr().sort().map(stage => ret[stage] = pg[stage])
      return ret
    }
    const setupHash = {}
    stagePresets.propertiesToArr().map(name => setupHash[name] = compile(stagePresets[name]))
    
    if (parent$) {
      const presets$ = div$(parent$, {class: 'preset-menu'}, 
        setupHash.propertiesToArr().map(presetName => {
          const setupObj = setupHash[presetName]
          const stages = setupObj.propertiesToArr()
          const html = stages.map(stage => stage + ': ' + setupObj[stage].join(' / ')).join('<br>')
          return div$({class: 'preset-item', text: presetName, click: event => {
            store.save('onStartup', {type: 'actPreset', presetName})
            window.location.href = window.location.href // eslint-disable-line no-self-assign
            set$(presets$, {css: {__reload: '" (reload needed!)"'}})
            resolve(setupObj)
          }}, div$({class: 'preset-preview', html}))
      }))
      schedule('2s').then(_ => set$(presets$, {class: 'hidden'}))
    }
    if (name) {
      if (name === 'last') {
        const startup = store.load('onStartup') || {type: 'actPreset', presetName: 'presetSix'}
        if (startup.type === 'actPreset') {
          const lastStored = startup.presetName
          resolve({actPreset: setupHash[lastStored]})
        } else if (startup.type === 'actProject') {
          resolve({actProject: startup.projName})
        }
      } else {
        resolve({actPreset: wassert(setupHash[name])})
      }
    }
  })
  
  //8#a67 Youtube video list
  
  const loadYoutubeVideoList = _ => root.youtubeVideoList = store.load('youtubevideolist') || {}

  root.onYoutube && loadYoutubeVideoList()
    
  stateManager.addToYoutubeVideoList =  videoId => {
    root.youtubeVideoList[videoId] = true
    store.save('youtubevideolist', root.youtubeVideoList)
  }
  stateManager.removeFromYoutubeVideoList =  videoId => {
    delete root.youtubeVideoList[videoId]
    store.save('youtubevideolist', root.youtubeVideoList)
  }
  
  //8#67a Project storage
  
  stateManager.setActProject = (actProject, projDesc = '') => {
    stateManager.actProject = actProject
    ui.set('projActive', {html: `Active: <strong>${projDesc}</strong> (${actProject})`})
    store.save('onStartup', {type: 'actProject', projName: actProject})
  }
  stateManager.getActProject = _ => stateManager.actProject
  
  const readProject = projName => store.load('project#' + projName)
  
  const writeProject = (projName, project) => store.save('project#' + projName, project)
  
  const addProjectRevision = (fullProject, project) => {
    fullProject.revisions = fullProject.revisions || {}
    const timeStamp = dateToHumanDateTime()
    fullProject.revisions[timeStamp] = fullProject.lastSaved = project
    fullProject.lastSavedAt = timeStamp
    console.log(`Project '${fullProject.projName}' rev ${timeStamp} added!`, fullProject)
  }
  
  stateManager.saveProject = (project, projName = stateManager.getActProject()) => {
    wassert(projName)
    const fullProject = readProject(projName) || {projName}
    project.projDesc = project.projDesc || fullProject.lastSaved.projDesc
    addProjectRevision(fullProject, project)
    writeProject(projName, fullProject)
    stateManager.setActProject(projName, project.projDesc)
  }
  stateManager.loadProject = (projName, timeStamp = '') => {
    const fullProject = readProject(projName)
    if (fullProject) {
      stateManager.setActProject(projName, fullProject.lastSaved.projDesc)
      return fullProject.revisions?.[timeStamp] || fullProject.lastSaved
    } else {
      return undef
    }
  }
  stateManager.getProjectTimeStamps = projName => {
    const fullProject = readProject(projName)
    if (fullProject) {
      return fullProject.revisions.propertiesToArr() || []
    } else {
      return []
    }
  }
  stateManager.getProjectList = _ => {
    const ret = []
    store.iterateKeys('project#', projName => ret.push(projName.split('project#')[1]))
    /*
    const dbg = []
    for (const projname of ret) {
      dbg.push([projname, JSON.stringify(readProject(projname)).length])
    }
    console.table(dbg)
    */
    return ret
  }
  stateManager.getProjectListExtended = _ => 
    stateManager.getProjectList().map(projName => {
      const {lastSavedAt = 0, revisions = {}, lastSaved = {}} = readProject(projName) || {}
      const {projDesc = ''} = lastSaved
      const versions = revisions.propertiesToArr().length
      return {projName, projDesc, versions, lastSavedAt}
    }).sort((a, b) => a.lastSavedAt < b.lastSavedAt ? 1 : -1)
  
  //8#4a9 Stage slots storage
  
  const fixSlots = slots => {
    while (slots.length < 5 || (slots.length < maxSlots && slots.slice(-1)[0].fxarr.length)) {
      slots.push({fxarr: []})
    }
    return slots
  }
  
  const loadSlots = _ => stateManager.slots = fixSlots(store.load('slots') || [])
  
  stateManager.onStageToSlotDrop = ({dstSlot, letter}) => {
    const state = stageMan.getStage(letter).saveState()
    stateManager.slots[dstSlot] = {fxarr: state}
    fixSlots(stateManager.slots)
    store.save('slots', stateManager.slots)
  }
  stateManager.onSlotToSlotDrop = ({dstSlot, srcSlot}) => {
    const slotState = stateManager.slots[srcSlot]
    stateManager.slots[dstSlot] = slotState
    fixSlots(stateManager.slots)
    store.save('slots', stateManager.slots)
  }

  stateManager.onSlotToStageDrop = ({dstLetter, slot}) => {
    stageMan.getStage(dstLetter).loadState(stateManager.slots[slot].fxarr)
  }
  stateManager.onStageToStageDrop = ({dstLetter, srcLetter}) => {
    const state = stageMan.getStage(srcLetter).saveState()
    stageMan.getStage(dstLetter).loadState(state)
  }
  
  loadSlots()
  
  return stateManager
}
