/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import * as Im from '../improxy-esm.js'

const {Corelib, DOMplusUltra} = Im
const {Ø, undef, yes, no, isNum, isFun, nop, clamp} = Corelib // eslint-disable-line
const {wassert, brexru} = Corelib.Debug
const {schedule} = Corelib.Tardis
const {div$, leaf$, set$, setClass$, q$$} = DOMplusUltra
  
export const createUI = (root, exroot) => {
  const {body} = document
  
  const earlyCall = doStop => _ => console.warn('Too early call to ui.', doStop && brexru())
  
  const ui = {
    root,
    refreshPlayerControl: earlyCall(false),
    refreshSourcesUi: earlyCall(false),
    bars: {},
    toggleCmds: {},
    cmds: {}
  }
  
  const dbgDumpFlags = msg => { //  eslint-disable-line no-unused-vars
    console.log(msg)
    console.table(root.flags)
  }
  
  //8#79c Utilities, primitives, config
  
  ui.configNames = namesDb => ui.namesDb = namesDb  //: only used for select fx names now

  ui.setHost = host => (key, params) => {
    const node$ = host[key + '$']
    wassert(node$ && node$.nodeType)
    set$(node$, params)
  }
  ui.set = ui.setHost(ui)
  
  ui.insertAudioPlayerInto = (node$, url, title = 'no title') => 
    leaf$('audio', node$, {attr: {src: url, controls: '', title}}) 
  
  //8#393 DOM framework building (cold init, skeleton)
  
  const init = _ => {  
    if (root.killEmAll) {
      set$(body, {html: ``})
      for (const node of [...q$$('script[nonce]'), ...q$$('dom-module')]) {
        node.remove()
      }
      //: more things could be eliminated from youtube's head
    }
    const extracc = (root.onYoutube ? ' u2' : '') + (root.killEmAll ? ' nu2' : '')
    ui.frame$ = div$(body, {class: 'beebody' + extracc}, [
      ui.bigmid$ = div$({class: 'bfx-bigmid off'}, [
        ui.mainmenuBar$ = div$({class: 'bfx-horbar bfx-mainmenu'}),
        ui.auxmenuBar$ = div$({class: 'bfx-horbar bfx-auxmenu off'}),
        ui.projmenuFrame$ = div$({class: 'off'}, [
          ui.projmenuBar$ = div$({class: 'bfx-horbar bfx-projmenu'}),
          ui.projStrip$ = div$({class: 'strip off'})
        ]),
        ui.stageSlotStrip$ = div$({class: 'strip off'}),
        //:sources menu can be put exactly here
        ui.sourceStrip$ = div$({class: 'strip'}),
        
        //: oldies from here (deprecated)
        ui.mixermenuBar$ = div$({class: 'bfx-horbar bfx-mixermenu off'}),
        ui.exauxmenu$ = div$({class: 'bfx-horbar mixer-frame off'}, [
          ui.bpmbar$ = div$({class: 'bfx-bpmbar mbar'}),
          ui.syncbar$ = div$({class: 'bfx-syncbar mbar'})
        ]),
        ui.syncFrame$ = div$({class: 'bfx-horbar sync-frame off'}, [
          ui.syncBar$ = div$({class: 'bfx-syncbar'}, [
            ui.playerLeft$ = div$({class: 'player-frame left-player mixer-inframe'}),
            ui.fader$ = div$({class: 'fader-frame mixer-inframe'}),
            ui.playerRight$ = div$({class: 'player-frame right-player mixer-inframe'})
          ])
        ]),
        //: end of the oldies section
        
        ui.mid$ = div$({class: 'bfx-mid'})
      ]),
      ui.factoryFrame$ = div$({class: 'factory-frame off'})
    ])
  }
  
  //8#37c Warm init: we have playground now
  
  ui.start = async playground => {
    ui.pg = playground
    
    Im.StagesUi.extendUi(ui) //: ui subs won't be stand-alone objects, ui obj will be extended
    Im.FxUi.extendUi(ui)
    await Im.PlayersUi.extendUi(ui)
    await Im.SourcesUi.extendUi(ui)
    Im.StatesUi.extendUi(ui)
    
    populateMenus()
    ui.setFlag('autoplay', true) //: auto project load (if any) will rewrite these as it's later
    ui.setFlag('autostop', true)
    ui.installKeyboardListener()
  }
  
  ui.finalize = _ => {
    ui.finalizeSources() //: createInputDispatchers (->stages)
  }
  
  //8#94f Ui primitives

  const createInput = baseClass => ({cc, onInput = nop} = {}) => {
    const node$ = leaf$('input', {
      class: baseClass + ' ' + cc, 
      attr: {type: 'text'}, 
      on: {
        keyup: event => event.key === 'Enter' && onInput(node$.value)
      }
    })
    return node$
  }
  
  const createToggleCmd = (baseClass, isToggle = true) => (name, text, pars = {}) => {
    const togg = ui.toggleCmds[name] = {name}
    
    const toggle = (on = !togg.on) => {
      if (on !== togg.on) {
        root.setFlag(name, togg.on = on)
        setClass$(togg.node$, on, 'act')
        for (const linked of togg.linkeds) {
          setClass$(ui[linked], !on, 'off')
        }
        on && togg.focus && ui[togg.focus + '$'].focus()
        void togg.onChg?.(on)
        //dbgDumpFlags('toggle ' + name)
      }
    }
    const defOnClick = isToggle ? toggle : nop
        
    const {cc = '', click = defOnClick, onChg = nop, link = '', focus} = pars
    const {on = root.flags[name] ?? false} = pars
    const ccExtra = on ? 'act' : ''
    const cclass = [baseClass, cc, ccExtra].join(' ')
    const nodeKey = name + 'Cmd$'
    const node$ = div$({cclass, text, click: _ => click()})
    ui[nodeKey] = node$ //+ temporary for debug
    const linkeds = link.split(',').filter(a => a).map(link => link + '$')
    togg.capture({node$, nodeKey, on, click, toggle, linkeds, focus, onChg})
    isToggle && toggle(root.setFlag(name, on))
    return ui[nodeKey] = node$
  }
  
  ui.setFlag = (name, on) => ui.toggleCmds[name]
    ? ui.toggleCmds[name].toggle(on)
    : root.setFlag(name, on) //: kind of fallback for flags without toggleCmd (or @load before ui)
    
  ui.getFlag = name => root.flags[name] ?? console.warn('unknown flag', name)
    
  const createBar = (name, node$, pars, items = []) => {
    ui.bars[name] = {node$}
    set$(node$, {}, items)
  }
  
  const populateMenus = _ => {
    const {pg} = ui
    const togg = createToggleCmd('mitem', true)
    const cmd = createToggleCmd('mitem', false)
    const inp = createInput('minput')
    const label = (name, text) => ui[name + '$'] = div$({class: 'mlabel', text})
    createBar('mainmenu', ui.mainmenuBar$, {}, [
      togg('mixer', 'Mixer...', {link: 'mixermenuBar'}),
      togg('sync', 'Sync...', {link: 'syncToolsFrame'}),
      togg('sourceList', 'Sources...', {onChg: ui.onVideoListToggled}),
      togg('proj', 'Projects..', {link: 'projmenuFrame'}),
      togg('fxfactory', 'Factory..', {link: 'factoryFrame', onChg: ui.onFactoryToggled}),
      togg('aux', 'More...', {link: 'auxmenuBar'}),
      togg('grab', 'Grab!', {cc: 'rt', onChg: ui.onGrabToggled}),
      togg('autoplay', 'Autoplay', {cc: 'rt'}),
      togg('autostop', 'Autostop', {cc: 'rt'}),
      togg('syncSources', 'Sync sources', {cc: 'rt'}),
      togg('syncBPM', 'Sync BPM', {cc: 'rt'}),
      togg('showStages', 'Show stages', {cc: 'rt', link: 'mid'})
    ])
    createBar('auxmenu', ui.auxmenuBar$, {}, [
      togg('stageSlots', 'Stage slots...', {link: 'stageSlotStrip', onChg: ui.onStageSlotsToggled}),
      togg('redresh', 'Reduce refresh', {onChg: ui.toggleRefresh}),
      togg('nospectrum', 'No bottom spectrums (reload!)', {onChg: ui.toggleRefresh}),
      togg('invcmd', 'Invert commands)', {onChg: on => setClass$(body, on, 'invertcmd')}),
      cmd('noblanks', 'Remove bottom blanks', {click: pg.destroyLastBlanks}),
      cmd('dump', 'Dump to console', {cc: 'rt', click: _ => pg.beeFx.debug.dump()})
    ])
    createBar('projmenu', ui.projmenuBar$, {}, [
      togg('projCreate','Create new project', {link: 'newProjectInput', focus: 'newProjectInput'}),
      ui.newProjectInput$ = inp({cc: 'off', onInput: txt => {
        pg.createNewProject(txt)
        ui.setFlag('projCreate', false)
      }}),
      togg('projList','List projects...', {link: 'projStrip', onChg: ui.onProjListToggled}),
      label('projActive', 'Active: -'),
      cmd('projSave','Save version', {click: _ => pg.saveProject()}) //: full call: def par!
    ])
    createBar('mixermenu', ui.mixermenuBar$, {}, [
      cmd('mixermaster', 'Master', {click: _ => pg.setSenderStage()})
    ])
    set$(ui.bigmid$, {declass: 'off'})
  }

  ui.installKeyboardListener = _ => document.addEventListener('keyup', event => {
    const {key, ctrlKey, shiftKey} = event
    
    //weject(key === 'F10')
    
    if (key === 'F2') {
      ui.setFlag('fxfactory')
    } else if (key === 'F4') {
    } else if (key === 'F7') {
    } else if (key === 'F9') {
      if (ctrlKey) {
      } else if (shiftKey) {
      } else {
      }
    } else if (key === 'Shift') {
    }
  })
  
  ui.createSideList = cclass => { //: not used atm
    const frame$ = div$(body, {class: 'side-frame ' + cclass})
    
    const refresh = itemArr => {
      set$(frame$, {declass: 'hidden'})
      set$(frame$, {html: ''}, itemArr.map(html => div$({class: 'item', html})))
      schedule('2s').then(_ => set$(frame$, {class: 'hidden'}))
    }
    return {frame$, refresh}
  }

  init()
  
  return ui
}
