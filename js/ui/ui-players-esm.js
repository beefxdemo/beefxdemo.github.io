/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
/* eslint-disable no-unused-vars */   
   
import {Corelib, DOMplusUltra, Observer, Redact} from '../improxy-esm.js'

const {undef, isObj} = Corelib
const {wassert, weject, wejectNaN} = Corelib.Debug
const {adelay} = Corelib.Tardis
const {secToString} = Corelib.DateHumanizer
const {div$, set$, state$} = DOMplusUltra
const {round} = Math

//8#49f -------------------------- Players ui --------------------------

export const extendUi = async ui => { //: Extends the sourceUi object with player functionality
  const {pg} = ui
  const {sources, stageMan, beeFx} = pg // eslint-disable-line no-unused-vars
  const {createMediaObserver} = Observer
  const R = await Redact
  const {React, ReactDOM, X: RX} = R // .isReady
  
  const logOn = false
  const logBPM = true
  const clog = (...args) => logOn && console.log(...args) // eslint-disable-line
  const ilog = (...args) => logBPM && console.log(...args) //
  
  ui.recreateSourcePlayer = sourceUi => {
    const {sourceIx} = sourceUi
    const source = sources.getSource(sourceIx)
    sourceUi.bpmFx = sources.getSourceStage(sourceIx).bpmFx
    
    //: Build/destroy helpers for recall (source change)

    const createBpmDetector = _ => {
      weject(sourceUi.bpmDetector)
      sourceUi.bpmInput = sources.getSourceNode(sourceIx)
      sourceUi.bpmDetector = beeFx.newFx('fx_bpm')
      sourceUi.bpmInput.connect(sourceUi.bpmDetector)
    }
    const destroyBpmDetector = _ => {
      if (sourceUi.bpmDetector) {
        sourceUi.bpmDetector.deactivate()
        delete sourceUi.bpmDetector
        sourceUi.inBpm = false
      }
    }
    destroyBpmDetector()
    
    void sourceUi.mediaObserver?.destroy()
    const _observer = sourceUi.mediaObserver = createMediaObserver(sourceUi)

    const getState = _ => _observer.getState() //: This is the first and last time we use _observer.

    sourceUi.master = undef //: sync - not used
    sourceUi.slave = undef
    
    //8#3ae Low level (unsynced) control methods
    
    sourceUi._pause = _ => {
      void sourceUi.ytPlayer?.pauseVideo?.()
      void sourceUi.audio$?.pause()
      void sourceUi.video$?.pause()
    }
    sourceUi._play = _ => {
      sourceUi.isMocked && void sourceUi.ytPlayer?.mute?.()
      
      void sourceUi.ytPlayer?.playVideo?.() //: playVideo is not valid if pressed too early
      void sourceUi.audio$?.play()
      void sourceUi.video$?.play()
    }
    sourceUi._async_play = async _ => {
      sourceUi.isMocked && void sourceUi.ytPlayer?.mute?.()
      
      await void sourceUi.ytPlayer?.playVideo?.() //: playVideo is not valid if pressed too early
      await void sourceUi.audio$?.play()
      await void sourceUi.video$?.play()
    }
    sourceUi._seek = sec => {
      void sourceUi.ytPlayer?.seekTo?.(sec, true) //: on youtube this will be doubled with video$
      sourceUi.audio$ && (sourceUi.audio$.currentTime = sec)
      sourceUi.video$ && (sourceUi.video$.currentTime = sec)
    }
    sourceUi._seekRel = relSec => sourceUi._seek(getState().currentTime + relSec)

    sourceUi._setPlaybackRate = pbr => {//+ check this out
      void sourceUi.ytPlayer?.setPlaybackRate?.(pbr)
      sourceUi.audio$ && (sourceUi.audio$.playbackRate = pbr)
      sourceUi.video$ && (sourceUi.video$.playbackRate = pbr)
    }
    sourceUi._toggleMute = _ => {
      sourceUi.audio$ && (sourceUi.audio$.muted = !sourceUi.audio$.muted)
      sourceUi.video$ && (sourceUi.video$.muted = !sourceUi.video$.muted)
    }
    sourceUi._setPitchToBpm = bpm => sourceUi.bpmFx.setPitchToBpm(bpm)
    sourceUi.hasControls = true
    
    const forcedSyncedControl = (funKey, ...args) =>
      ui.iterateSourceUis(sourceUi => sourceUi[funKey]?.(...args)) 
      
    const syncedControl = (funKey, ...args) => ui.getFlag('syncSources')
      ? forcedSyncedControl(funKey, ...args)
      : sourceUi[funKey](...args)
      
    //8#67f ---------- High level (synced) control methods ----------
    
    sourceUi.stop = _ => syncedControl('_pause')
    sourceUi.pause = _ => syncedControl('_pause')
    sourceUi.play = _ => syncedControl('_play')
    sourceUi.async_play = _ => syncedControl('_async_play')
    sourceUi.seek = sec => syncedControl('_seek', sec)
    sourceUi.speed = pbr => syncedControl('_setPlaybackRate', wejectNaN(pbr))
    sourceUi.seekRel = sec => syncedControl('_seekRel', sec)
    sourceUi.toggleMute = _ => syncedControl('_toggleMute')
    
    sourceUi.seekPt = pt => {
      const duration = getState().duration //: this could be slow with youtube master video...
      if (!duration) {
        return console.warn('sourceUi.seekPt failure: no duration', {pt, sourceUi})
      }
      sourceUi.seek(duration * pt / 100)
    }
    
    //8#c7c ---------- Calculate BPM ----------
    
    sourceUi.doBpm = async (calcSec = 15) => {
      if (sourceUi.inBpm) {
        return
      }
      sourceUi.inBpm = true
      const bpmKey = 'bpm' + calcSec
      bpmChanged({[bpmKey + 'state']: 'calc'})
      sourceUi.bpmFx.setValue('pitch', 100)  //: reset to standard speed for detection
      calcSec = [0, 10, 20][calcSec] || calcSec
      const {paused: wasPaused} = getState()
      if (wasPaused) {
        ilog('BPM have to start video') //: BPM detection is still buggy -> logs
        const sec = (getState().duration || 100) / 3
        sourceUi.seek(sec)
        ilog('BPM starts waiting for play')
        await sourceUi.async_play()
        ilog('BPM awaited play, waiting .5s')
        await adelay(500)
        ilog('BPM awaited .5s')
      } else {
        ilog('BPM found video already playing')
      }
      createBpmDetector()
      ilog('BPM calls bpmDetector.privilegedReq', sourceUi, getState().title)
      sourceUi.bpmDetector.startPrivilegedBpmRequest(calcSec)
        .then(bpm => {
          sources.bpmInChanged(sourceIx, bpm)
          bpmChanged({[bpmKey + 'css']: {'--bt': 30 / bpm + 's'}})
          bpmChanged({bpmXtext: 'syncBPM', bpmXstate: 'on'})
        })
        .catch(msg => {
          ilog(`🥵Player BPM detection failed:`, msg)
          bpmChanged({bpmXtext: '-Error-', bpmXstate: 'err'})
        })
        .finally(_ => {
          wasPaused && sourceUi.pause()
          destroyBpmDetector()
          bpmChanged({[bpmKey + 'state']: 'done'})
        })
    }
    sourceUi.syncBpm = _ => forcedSyncedControl('_setPitchToBpm', sourceUi.bpmFx.int.bpmOut)

    const domState = { //: Direct references to certain nodes. DOM changes are cached here (state$).
      info: state$(sourceUi.info$),
      masterThumb: sourceUi.masterThumb$ ? state$(sourceUi.masterThumb$) : null
    }
    const lastDOM = {}
    
    sourceUi.onStateChanged = state => {
      const {title, duration, muted, paused, videoId} = getState()
      title && domState.info.set({text: title})
      playerDragChanged({durText: secToString(duration)})
      playerCtrlChanged({
        mutedState: muted ? 'alert' : 'off',
        playState: paused ? 'on' : 'off',
        stopState: paused ? 'off' : 'on'
      })
      if (videoId !== lastDOM.videoId && videoId?.length === 11 && sourceUi.masterThumb$) {
        lastDOM.videoId = videoId
        const backgroundImage = `url('//img.youtube.com/vi/${videoId}/mqdefault.jpg')`
        void domState.masterThumb?.set({css: {backgroundImage}})
      }
      sourceUi.onTimeChanged()
    }
    
    sourceUi.onTimeChanged = _ => {
      const {currentTime, duration} = getState()
      if (clip.loopOn && clip.outPt > 0 && clip.outPt < currentTime) {
        sourceUi.seek(clip.inPt)
      } else {
        playerDragChanged({
          currText: secToString(currentTime),
          progCss: {'--prog': 100 * currentTime / (duration || 1) + '%'}
        })
      }
    }
    
    const mergeStateWith = (target, changes) => { //+neide
      for (const key in changes) {
        target[key] = changes[key]
      }
    }
    const ref2state = (ref, target) => {
      for (const key in ref) {
        target[key] = state$(ref[key].current)
      }
    }
    
    //: NOT USED- just for reference
    R.BeeCmdRef = React.forwardRef(({cc, text, attr = {}, st, click, css}, ref) => {
      console.log({cc, ref})
      st && (attr.state = st)
      for (const key in attr) {
        typeof attr[key] === 'boolean' && (attr[key] += '') //: REAKT :-(
      }
      const cmdProps = {className: 'bee-cmd ' + cc, style: css, ...attr, ref, onClick: click}
      return R.div(cmdProps, text)
    }).render
    
    const BeeCmd = ({cc, text, attr = {}, st, click: onClick, onRef, css: style, re}) => RX(_ => {
      st && (attr.state = st)
      const className = 'bee-cmd ' + (cc || '')
      for (const key in attr) {
        typeof attr[key] === 'boolean' && (attr[key] += '') //: REAKT :-(
      }
      const ref = React.createRef()
      const onMouseEnter = _ => onRef?.(ref?.current)
      
      return R.div({className, style, ...attr, ref, re, onMouseEnter, onClick}, text)
    })
    
    //: ReduceUpdate transforms a state object adding an externlly callable custom hook.
    //: So onXXXchange methods can signal for the component when there is a state change.
    //: (The state is always outside the component in our case.)
    
    const reduceUpdate = obj => {
      obj.update = _ => console.warn('Updater not used', obj)
      obj.useUpdate = _ => {
        const [curr, update] = React.useState(0)
        obj.update = _ => update(curr + 1)
        return {curr, update}
      }
      return obj
    }  

    const playerControls = reduceUpdate({ //8#b802 -----Player controls ------
      playState: 'off',
      stopState: 'off',
      mutedState: 'off',
      re: { //: re is ~ref, but we won't want to mix up with React refs.
        play: {},
        stop: {},
        muted: {}
      }
    })
    const playerCtrlChanged = ctrlChange => {
      mergeStateWith(playerControls, ctrlChange)
      if (R.useReact) {
        playerControls.update()
      } else {
        domState.muted.set({attr: {state: playerControls.mutedState}})
        domState.play.set({attr: {state: playerControls.playState}})
        domState.stop.set({attr: {state: playerControls.stopState}})
      }
    }
    const PlayerCtrlBar = props => RX(_ => {
      const {bpm1state, bpm1css, bpm2state, bpm2css, bpmXtext, bpmXstate, re: br} = props.bpm
      const {playState, stopState, mutedState, re: pr} = props.playerControls
      
      const onRef = node => ilog(`PlayerCtrlBar hover:`, node?.className) //: test
      playerControls.useUpdate()
      bpm.useUpdate() //: This component depends on two external states, hence the two updater.
      
      return R.div({className: 'ctrlbar'}, 
        BeeCmd({cc: 'bpm-cmd bpm1', onRef, re: br.bpm1, text: 'BPM', css: bpm1css, st: bpm1state,
          click: _ => sourceUi.doBpm(1)}),
        BeeCmd({cc: 'bpm-cmd bpm2', onRef, re: br.bpm2, text: 'BPM.X', css: bpm2css, st: bpm2state,
          click: _ => sourceUi.doBpm(2)}),
        BeeCmd({cc: '', re: br.bpmX, text: bpmXtext, st: bpmXstate, click: sourceUi.syncBpm}),
        BeeCmd({cc: 'cc-play', re: pr.play, text: 'Play', st: playState, click: sourceUi.play}),
        BeeCmd({cc: 'cc-stop', re: pr.stop, text: 'Stop', st: stopState, click: sourceUi.stop}),
        BeeCmd({cc: 'cc-mute', re: pr.muted, text: 'Mute', st: mutedState, click: sourceUi.toggleMute}),
        BeeCmd({cc: 'cc-flood', text: 'Flood', click: _ => sources.floodStages(sourceUi)})
      )
    })
    const drag = reduceUpdate({ //8#2b2 ----- DragBar ------
      currText: '',
      durText: '',
      progCss: {},
      loopCss: {},  
      css: {},
      re: {
        dragBar: {},
        current: {},
        duration: {}
      }
    })
    const playerDragChanged = navChange => {
      mergeStateWith(drag, navChange)
      drag.css = {...drag.progCss, ...drag.loopCss}
      if (R.useReact) {
        drag.update()
      } else {
        domState.dragBar.set({css: drag.css})
        domState.current.set({text: drag.currText})
        domState.duration.set({text: drag.durText})
      }
    }
    const onDrag = event => {
      if (event.type === 'click' || event.buttons & 1) {
        const {offsetX = event.nativeEvent.offsetX} = event
        sourceUi.seekPt(round(1000 * offsetX / event.target.clientWidth) / 10)
      }
    }
    const PlayerDragBar = props => RX(_ => {
      const {re, durText, currText, css} = props
      drag.useUpdate()
      
      return R.div({className: 'nav-drag'},
        R.div({className: 'drag-bar', style: css, re: re.dragBar, onMouseMove: onDrag, onClick: onDrag},
          R.div({className: 'curr time', re: re.current}, currText),
          R.div({className: 'dur time', re: re.duration}, durText)
        )
      )
    })
    const bpm = reduceUpdate({ //8#7a8 ----- BPM ------
      bpm1state: '',
      bpm2state: '',
      bpm1css: {},
      bpm2css: {},
      bpmXtext: 'syncBPM',
      bpmXstate: '',
      re: {
        bpm1: {},
        bpm2: {},
        bpmX: {}
      }
    })
    const bpmChanged = bpmChange => {
      mergeStateWith(bpm, bpmChange)
      if (R.useReact) {
        bpm.update()
      } else {
        domState.bpm1.set({attr: {state: bpm.bpm1state}, css: bpm.bpm1css})
        domState.bpm2.set({attr: {state: bpm.bpm2state}, css: bpm.bpm2css})
        domState.bpmX.set({attr: {state: bpm.bpmXstate}, text: bpm.bpmXtext})
      }
    } 
    const clip = reduceUpdate({ //8#79e ----- Loop ------
      inPt: 0,
      outPt: 0,
      loopOn: false,
      re: {
        inPt: {},
        outPt: {},
        loopOn: {}
      }    
    })
    const loopChanged = clipChange => {
      mergeStateWith(clip, clipChange)
      const {duration} = getState()
      playerDragChanged({loopCss: {
        '--in': 100 * clip.inPt / (duration || 1) + '%',
        '--inout': 100 * (clip.outPt - clip.inPt) / (duration || 1) + '%',
        '--loop': clip.loopOn ? '#e22' : '#e92'
      }})
      if (R.useReact) {
        clip.update()
      } else {
        domState.inPt.set({text: '➜' + secToFix1(clip.inPt)})
        domState.outPt.set({text: '➜' + secToFix1(clip.outPt)})
        domState.loopOn.set({attr: {loopon: clip.loopOn}})
      }
    }
    const setIn = _ => loopChanged({inPt: getState().currentTime})
    const setOut = _ => loopChanged({outPt: getState().currentTime})
    const toggleLoop = _ => loopChanged({loopOn: !clip.loopOn})
    const gotoIn = _ => sourceUi.seek(clip.inPt)
    const gotoOut = _ => sourceUi.seek(clip.outPt)

    const PlayerLoopBar = props => RX(_ => {
      const {inPt, outPt, loopOn: loopon, re} = props
      clip.useUpdate()
      
      return R.div({className: 'loopbar'}, 
        BeeCmd({cc: 'n-incmd', text: 'In', click: setIn}),
        BeeCmd({cc: 'n-indisp emoji', re: re.inPt, text: '➜' + secToFix1(inPt), click: gotoIn}),
        BeeCmd({cc: 'n-loop', re: re.loopOn, text: 'Loop', attr: {loopon}, click: toggleLoop}),
        BeeCmd({cc: 'n-outcmd rt', text: 'Out', click: setOut}),
        BeeCmd({cc: 'n-outdisp rt emoji', re: re.outPt, text: '➜' + secToFix1(outPt), click: gotoOut})
      )
    })
     //8#a55 ----- NavBar ------
     
    const absSeekS = sec => _ => sourceUi.seek(sec)
    const relSeekS = sec => _ => sourceUi.seekRel(sec)
    const relSeekB = bt => _ => source.beatTimeIn && sourceUi.seekRel(bt * source.beatTimeIn)  
    const secToFix1 = sec => round(10 * sec) / 10
    
    const PlayerNavBar = props => RX(_ => {
      const {absSeekS, relSeekS, relSeekB} = props
      
      return R.div({className: 'navbar'}, 
        BeeCmd({cc: 'n-start', text: 'Start', click: absSeekS(0)}),
        BeeCmd({cc: 'n-m30s', text: '-30s', click: relSeekS(-30)}),
        BeeCmd({cc: 'n-m10s', text: '-10s', click: relSeekS(-10)}),
        BeeCmd({cc: 'n-m2b', text: '-2b', click: relSeekB(-2)}),
        BeeCmd({cc: 'n-m1b', text: '-1b', click: relSeekB(-1)}),
        BeeCmd({cc: 'n-p1b', text: '+1b', click: relSeekB(1)}),
        BeeCmd({cc: 'n-p2b', text: '+2b', click: relSeekB(2)}),
        BeeCmd({cc: 'n-p10s', text: '+10s', click: relSeekS(10)}),
        BeeCmd({cc: 'n-p30s', text: '+30s', click: relSeekS(30)})
      )
    })
     //8#755 ----------- The Player ------------
    
    const playerState = {clip, bpm, playerControls, drag}
    
    const Player = _ => { //: called only once
      try {
        const player = RX(_ => R.Frag({},
          PlayerLoopBar(playerState.clip),
          PlayerNavBar({absSeekS, relSeekS, relSeekB}),
          PlayerCtrlBar(playerState),
          PlayerDragBar(playerState.drag)
        ))
        if (!R.useReact) {
          ref2state(clip.re, domState)
          ref2state(playerControls.re, domState)
          ref2state(bpm.re, domState)
          ref2state(drag.re, domState)
        }
        return player
      } catch (err) {
        console.error(err)
        debugger
      }
    }
      
    const buildUi = _ => {
      if (R.useReact) {
        set$(sourceUi.ctrl$, {html: ``}, sourceUi.rxRoot$ = div$({class: 'rx-root'}))
        ReactDOM.render(Player(playerState), sourceUi.rxRoot$)
      } else {
        set$(sourceUi.ctrl$, {html: ``}, div$({class: ''}, Player()))
      }
    }
    buildUi()
  }
}
