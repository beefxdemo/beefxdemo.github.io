/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra, createGraphBase} from '../improxy-esm.js'

const {Ø, isNum, isFun, clamp} = Corelib
const {wassert} = Corelib.Debug
const {startEndThrottle, schedule, createPerfTimer} = Corelib.Tardis
const {div$, leaf$, set$, setClass$, canvas$} = DOMplusUltra
const {round} = Math
  
export const createFxParControls = ui => {
  const logOn = false
  const clog = (...args) => logOn && console.log(...args)
  
  const graphBase = createGraphBase(ui.root.waCtx)
  const CANVAS_SIZE = 300
    
  //8#79c Utilities, primitives, config
  
  const addPiano = (parO, callback, val, {keepDown = true}) => {
    const onClick = note => event => callback(note)
    const whites = 'Ca-Dc-Ee-Ff-Gh-Aj-Bl-Cm-Do-Eq-Fr-Gt-Av-Bx-Cy'.split('-')
    const blacks = 'Cb-Dd-..-Fg-Gi-Ak-..-Cn-Dp-..-Fs-Gu-Aw..'.split('-')
    const attrOf = note => ({note, disp: note[0]})
    
    parO.control$ = div$({class: 'piano-kb'}, [
      div$({class: 'whites'}, 
        whites.map(note => div$({class: 'key', attr: attrOf(note), click: onClick(note)}))),
      div$({class: 'blacks'}, 
        blacks.map(note => div$({class: 'key', attr: attrOf(note), click: onClick(note)})))
    ])
    parO.keys$$ = [...parO.control$.children[0].children, ...parO.control$.children[1].children]
  }
  
  const addRange = (parO, name, callback, value, min, max, step = .001) => 
    parO.control$ = div$({class: 'beectrl ranger', attr: {name}}, 
      parO.input$ = leaf$('input', {attr: {type: 'range', min, max, step, value}, on: {
        input: event => callback(parseFloat(event.target.value))}}))

  const addCheckbox = (parO, name, callback) => 
    parO.control$ = div$({class: 'beectrl checker', attr: {name}}, 
      parO.input$ = leaf$('input', {attr: {type: 'checkbox'}, on: {
        change: event => callback(event.target.checked)}}))   
        
  const addListSelector = (parO, name, act, list, callback) =>
    parO.control$ = div$({class: 'beectrl selektor sel-' + name, attr: {name}}, 
      parO.input$ = leaf$('select', {on: {change: event => callback(event.target.value)}},
        list.map(([value, name]) => 
          leaf$('option', {text: name, attr: {value, ...(name === act ? {selected: ''} : {})}}))))
          
  const addBox = (parO, width, cc) => 
    parO.control$ = div$({class: 'bee-box ' + cc, css: {width}})

  const addBoxWithLed = (parO, width, cc) => 
    parO.control$ = div$({class: 'bee-box wled ' + cc, text: ' ', css: {width}},
      parO.led$ = div$({class: 'led-fx'}))
    
  const addCmd = (parO, name, callback, cc) => 
    parO.control$ = div$({class: 'bee-cmd ' + cc, text: name, click: _ => callback('fire')})
                     
  const addCmdWithLed = (parO, name, callback, color = 0, cc = '') => 
    parO.control$ = div$({class: 'bee-cmd wled ' + cc, text: name, click: _ => callback('fire')},
      div$({class: 'led-fx fix-on', css: {__ledhue: color}}))

  const num2str = (num, maxwi = 4) => {
    if (!maxwi) {
      return round(num) + ''
    }
    maxwi = clamp(maxwi, 2, 4) // 2 3 4 maxwi is valid
    const absval = Math.abs(num)
    wassert(typeof num !== Ø)
    wassert(isFun(num.toFixed))
    return absval >= 100 // 309 11000
      ? num.toFixed(0) : absval >= 10 // 99.78 (2)
        ? num.toFixed(maxwi - 2) : absval >= 1 // 5.437 0.939 (3)
          ? num.toFixed(maxwi - 1) : num.toFixed(maxwi - 1)
  }

  //8#a2aRendering graphs
  
  const renderPanelGraphs = (fxPanelObj, triggerKey, delay = 20) => schedule(delay).then(_ => {
    for (const graphName in fxPanelObj.panel.graphs) {
      renderPanelGraph(fxPanelObj, graphName, triggerKey) //: delayed as filters can have a 10ms lag
    }
  })
  
  const renderPanelGraph = (fxPanelObj, graphName, key) => {
    const {panel} = fxPanelObj
    const panelGraph = wassert(panel.graphs[graphName])
    const {graph} = panelGraph
    if (!graph.triggerKeys || !key || graph.triggerKeys.includes(key)) { //: optimize redraw
      panelGraph.graphInstance.render()
    } else {
      clog('Graph wont redraw', key)
    }
  }
  
  const addPanelGraph = (fxPanelObj, graphName) => {
    const {panel, fx} = fxPanelObj
    const graphObj = wassert(fx.exo.graphs[graphName])
    const graphArr = graphObj.map ? graphObj : [graphObj]
    const {width = CANVAS_SIZE * 2, height = CANVAS_SIZE, css = {}} = graphArr[0] 
    const cclass = 'graph-canvas gr-' + graphName
    const canv$ = canvas$(panel.parsFrame$, {class: cclass, attr: {width, height}, css})

    const timer = createPerfTimer()
    for (let ix = 0; ix < graphArr.length; ix++) {
      const graph = graphArr[ix]
      const panelGraph = {canvas$: canv$, width, height, graph, fx}
      panelGraph.graphInstance = graphBase.createGraph(graph, panelGraph)
      panel.graphs[graphName + ix] = panelGraph
      renderPanelGraph(fxPanelObj, graphName + ix)
    }
    set$(panel.parsFrame$, {class: 'graph gt-' + fx.exo.fxName})
    clog(`📈Graph added for ${fx.zholger} with ${graphArr.length} items.`, timer.summary())
  }
  
  //8#2aaRendering pars
  
  const dbg = {
    mismatchCnt: 0
  }
  
  const refreshDisplay = (fxPanelObj, key, assertFx) => {
    if (assertFx !== fxPanelObj.fx) {
      dbg.mismatchCnt++ < 50 && 
        console.warn(`refreshDisplay: fx/fxPanelObj differs, skip!`, key, assertFx, fxPanelObj.fx)
      return
    }
    const {pars, fx} = fxPanelObj
    const parO = pars[key]
    const {parDef} = parO
    const {type, subType} = parDef
    const dispVal = fx.getValue(key) //: minmaxnak is lehet dispvalja
    
    const updaters = {
      float: _ => {
        const isInt = subType === 'int'
        const {prec = 4} = parDef
        const {val} = fx.getLinearValues(key)
        if (val !== parseFloat(parO.input$.value)) {
          parO.input$.value = val
        }
        clog('refreshDisplay', {key, dispVal, type: typeof dispVal})
        set$(parO.control$, {attr: {val: num2str(dispVal, isInt ? 0 : prec)}})
      },
      piano: _ => {
        for (const key$ of parO.keys$$) {
          setClass$(key$, key$.getAttribute('note') === dispVal, 'act') 
        }
      },
      boolean: _ => {
        const checked = ''
        set$(parO.input$, dispVal ? {attr: {checked}} : {deattr: {checked}})//:no val at creating
        parO.input$.checked = dispVal
      },
      box: _ => {
        const [text, longState = '', led = ''] = dispVal.split?.('#') ?? [dispVal]
        const [state, ledstate] = longState.split('.')
        if (parDef.subType === 'led') {
          wassert(parO.control$.childNodes[0])
          parO.control$.childNodes[0].nodeValue = text
          set$(parO.control$, {attr: {state, ledstate}})
          if (led) {
            const [__ledhue = 0, __pulseperiod] = led.split(',')
            set$(parO.led$, {css: {__ledhue}})
            __pulseperiod && set$(parO.led$, {css: {__pulseperiod}})
            setClass$(parO.control$, !__pulseperiod, 'fix-on')
          }
        } else {
          set$(parO.control$, {text, attr: {state}})
        }
      },
      cmd: _ => {
        if (dispVal !== 'fire') {
          const [state, ledstate = ''] = dispVal.split('.')
          set$(parO.control$, {attr: {state, ledstate}})
        }
      },
      strings: _ => { 
        for (const child$ of parO.input$.children) {
          child$.selected = child$.value === dispVal
        } 
      },
      graph: _ => renderPanelGraphs(fxPanelObj, key, 0),
      html: _ => set$(parO.control$, {html: dispVal}),
      info: _ => set$(parO.control$, {html: dispVal})
    }
    const paramUpdater = updaters[type]
    paramUpdater
      ? paramUpdater()
      : console.warn('no paramUpdater for', {type, parO})
      
    renderPanelGraphs(fxPanelObj, key)
  } 
  
  //8#9c0 Rebuilding the parameter-specific parts of the fx panel

  const createParsInPanel = (fxPanelObj) => {
    const {fx, pars, panel} = fxPanelObj
    const {def} = fx.exo
    
    const onValChanged = key => val => fx.setLinearValue(key, val)
    
    for (const key in def) {
      const {type, size, short, subType, skipUi, unit, color, readOnly, cc = ''} = def[key]
      if (skipUi) {
        continue
      }
      const parO = pars[key] = {type, parDef: def[key]}
      const constructors = {
        float: _ => {   //8#88e ------- float --> input range -------
          const dispName = short
          const {val, min, max} = fx.getLinearValues(key)
          const step = subType === 'int' ? 1 : .001
          addRange(parO, dispName, startEndThrottle(onValChanged(key), 30), val, min, max, step)
          isNum(color) && set$(parO.input$, {attr: {color}, css: {__color: color}})
          unit && set$(parO.input$, {attr: {unit}})
        },
        piano: _ => {
          addPiano(parO, onValChanged(key), 0, {keepDown: true})
        },
        boolean: _ => { //8#9c7 ------- boolean --> input checkbox -------
          addCheckbox(parO, short, onValChanged(key))
        },
        box: _ => {    //8#b8a7 ------- box --> non-input, output, plain div cmd -------
          subType === 'led'
            ? addBoxWithLed(parO, (parO.parDef.width || 40) + 'px', cc)
            : addBox(parO, (parO.parDef.width || 40) + 'px', cc)
        },
        cmd: _ => {    //8#b8c7 ------- cmd --> non-input, plain div cmd -------
          subType === 'led'
            ? addCmdWithLed(parO, short, onValChanged(key), parO.parDef.color, cc)
            : addCmd(parO, short, onValChanged(key), cc)
        },
        strings: _ => { //8#ea7 ------- strings --> select box -------
          addListSelector(parO, short, '', subType, onValChanged(key))
          size && set$(parO.input$, {attr: {size}})
        },
        graph: _ => {   //8#3ca ------- graph -> addscene -------
          addPanelGraph(fxPanelObj, key)
        },
        html: _ => {    //8#7ae ------- html --> html -------
          parO.control$ = div$({class: 'html', html: fx.getValue(key)})  
        },
        info: _ => {    //8#8be ------- info --> html -------
          parO.control$ = div$({class: 'info', html: fx.getValue(key)})  
        }
      }
      const paramConstructor = constructors[type]
      if (paramConstructor) {
        paramConstructor()
      } else { 
        console.warn('no paramConstructor for', {type, subType})
        continue
      }
      readOnly && set$(parO.input$ || parO.control$, {attr: {disabled: ''}})
      div$(panel.parsFrame$, {class: 'fxr-parval fxt-' + type}, parO.control$)
      refreshDisplay(fxPanelObj, key, fx) //: initial display
      fx.onValueChange(key, _ => refreshDisplay(fxPanelObj, key, fx))
    }

    void ui.root.midi?.addFpo(fxPanelObj)
  }
  
  return {createParsInPanel, addListSelector}
}
