/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra} from '../improxy-esm.js'

const {undef, nop, getIncArray} = Corelib
const {wassert, brexru} = Corelib.Debug
const {post, pinky} = Corelib.Tardis
const {div$, leaf$, set$, q$$, haltEvent, iAttr} = DOMplusUltra

//8#c00 -------------------------- Youtube Interface --------------------------

window.onYouTubeIframeAPIReady = _ => ytApi.resolve()

const ytApi = {players: []}
  
ytApi.isReady = new Promise(resolve => ytApi.resolve = resolve)

void (_ => { //: init the Youtube iframe api asap
  const script = document.createElement('script')
  script.src = 'https://www.youtube.com/iframe_api'
  document.head.insertAdjacentElement('afterbegin', script)
  
  void (async _ => { //: youtube iframe api ready state test
    await ytApi.isReady
    console.log('🔴Youtube API is ready.')
  })()
})()

//8#49f -------------------------- Sources ui --------------------------

export const extendUi = async ui => { //: input: ui.sourceStrip$ (empty)
  const {root, pg} = ui
  const {stageMan, sources} = pg
  const {getStage, iterateStages} = stageMan
  
  const logOn = false
  const clog = (...args) => logOn && console.log(...args)
  
  const {maxSources = 8} = root.config
  const sourceIxArr = getIncArray(1, maxSources)
  
  const sourceUis = [{}, ...sourceIxArr.map(ix => ({
    ix,
    sourceIx: ix,
    frame$: undef,
    media$: undef,
    ctrl$: undef,
    stage$: undef,
    dragBar$: undef, 
    info$: undef,
    ui$: undef,
    mock$: undef,
    ytPlayer: undef,
    isMocked: false
  }))]
  
  const init = _ => {
    set$(ui.sourceStrip$, {class: 'bfx-horbar source-strip'}, [
      ui.syncToolsFrame$ = div$({class: 'source-frame synctools-frame off'}, [
        ui.syncPhase = div$({class: 'bee-cmd', attr: {state: 'on'}, text: 'Sync LFO phases',
          click: _ => stageMan.onGlobalCommand({cmd: 'global.syncPhase'})}),
        ui.syncLoopStart = div$({class: 'bee-cmd', attr: {state: 'on'}, text: 'Sync start loops',
          click: _ => stageMan.onGlobalCommand({cmd: 'global.syncStartLoop'})}),
        ui.syncLoopEnd = div$({class: 'bee-cmd', attr: {state: 'on'}, text: 'Sync stop loops', click: _ => stageMan.onGlobalCommand({cmd: 'global.syncStopLoop'})})
      ]),
      ...sourceIxArr.map(ix => 
        sourceUis[ix].frame$ = div$({class: 'source-frame source-' + ix, attr: {ix}}, [ 
          sourceUis[ix].info$ = div$({class: 'src-info'}),
          sourceUis[ix].media$ = div$({class: 'src-media'}),
          sourceUis[ix].ctrl$ = div$({class: 'src-ctrl'}),
          sourceUis[ix].stage$ = div$({class: 'src-stage'})
      ]))
    ])
  }
  
  init()
  
  ui.getSourceUi = sourceIx => sourceUis[sourceIx]
  
  ui.iterateSourceUis = callback => {
    for (const sourceUi of sourceUis) {
      sourceUi.sourceIx && callback(sourceUi)
    }
  }
  
  ui.finalizeSources = _ => {
    ui.createInputDispatchers(sourceIxArr)
  }
  
  root.videoIds = [
  ].join(',').split(',')
  
  //8#595 Youtube/p3 menu for testing on dev site
  
  root.mp3s = pinky.promise('mp3s')
  
  window.fetch('/au/add-audio-esm.js') //: private files, if not on pub site (->beeFx.getFullPath!)
    .then(resp => resp.ok
      ? import(resp.url)
          .then(mod => pinky.mp3s.resolve(mod.mp3s))
          .catch(err => pinky.mp3s.resolve([]))
      : pinky.mp3s.resolve([])
    )
    .catch(err => pinky.mp3s.resolve([]))
    
  root.mp3s = await root.mp3s

  //8#c95 Youtube mock stuff - if we are not on Youtube, so we have to replace videos with audio
  
  const searchMockAudioForVideoId = videoId => {
    for (const mp3 of root.mp3s) {
      if (mp3.videoId === videoId) {
        return mp3
      }
    }
    return root.mp3s[0] //: the first one is the fallback
  }
  
  const mockVideoInStripWithAudio = (media$, videoId) => {
    const mockMp3 = searchMockAudioForVideoId(videoId)
    clog(`📀Mock mp3 will be used instead of ${videoId}:`, mockMp3)
    return ui.insertAudioPlayerInto(media$, mockMp3.src, mockMp3.title)
  }
  
  const prepareSourceChange = sourceIx => {
    const sourceUi = sourceUis[sourceIx]
    sourceUi.capture({
      isMaster: false,
      isMocked: false,
      isAudio: false,
      isVideo: false,
      isBuffer: false,
      ytPlayer: undef,
      iframe$: undef,
      video$: undef,
      audio$: undef,
      hasControls: false,
      refreshPlayer: nop,
      play: nop,
      pause: nop,
      stop: nop,
      seek: nop
    })
    set$(sourceUi.frame$, {deattr: {type: ''}})
    set$(sourceUi.media$, {html: ''})
      
    return sourceUi
  }
  const finalizeSourceChange = sourceUi => ui.recreateSourcePlayer(sourceUi)
  
  //: This is ugly. We have to post autoplay/autostop as the players are not ready yet.
  //: Why? We connect the sources first, the player is created after that.
  //: The problem is that connectSource calls this (early) - who else?
  //: The ui.changeXXXSource methods could call this too (after src created).
  //: But they can't call it later as they are only used at creation time.
  //: And we need this later too on connect/reconnect actions.
  //: So we'll post the call a bit, it works, but makes the code fragile.
  
  ui.autoPlaySource = sourceIx => ui.getFlag('autoplay') && post(_ => sourceUis[sourceIx].play())
  ui.autoStopSource = sourceIx => ui.getFlag('autostop') && post(_ => sourceUis[sourceIx].pause())
  
  const insertYoutubeIframe = (node$, sourceUi, videoId)  => new Promise(resolve => {
    const YT = wassert(window.YT)
    sourceUi.ytPlayer = new YT.Player(node$, {
      width: '320', height: '180', videoId, events: {onReady: resolve}
    })
  })
  
  //8#7a7 All possible cases for playback media creation (audio, mock, video, buffer, master)
  
  //: STEMs are for testing at the moment, so we don't expect errors and a few things are fixed.
  //: If we select a stem-like audio file for upload, the other stems will be loaded too.
  //: They must be in the /au/stems directory with 'stem*?.mp3' filenames. (?=1..8 or max)
  //: We look for bg images with the same filename (.mp3 -> .png) but that's not important at all.
  //: (Note: if we select the stem*4.mp3 filename, only stems 1-4 will be loaded.)
  
  ui.changeSourcesWithStems = file => { //: stems must be mp3 and in theix fixed dir
    const preFix = pg.beeFx.getRootPath() + `au/stems/`
    const stemName = file.split('.mp3')[0]
    const toSrc = parseInt(stemName.slice(-1)[0])
    const stemRoot = stemName.slice(0, -1)
    ui.setFlag('autoplay', false)
    ui.setFlag('autostop', false)
    ui.setFlag('syncSources', true)
    for (let sourceIx = 1; sourceIx <= toSrc; sourceIx++) {
      const src = preFix + stemRoot + sourceIx + '.mp3'
      const backgroundImage = `url(${src.split('.mp3')[0] + '.png'})`
      ui.changeAudioSource(sourceIx, {src, title: stemRoot + sourceIx, backgroundImage})
      sources.changeStageSourceIndex(sourceIx - 1, sourceIx)
    }
  }
  ui.changeAudioSource = (sourceIx, {src, title, backgroundImage}) => {//8#2b2 [audio]
    const sourceUi = prepareSourceChange(sourceIx)
    sourceUi.request = {method: 'changeAudioSource', sourceIx, par: {src, title, backgroundImage}}
    sourceUi.isAudio = true
    set$(sourceUi.frame$, {attr: {type: 'audio'}})
    set$(sourceUi.info$, {text: title})
    sourceUi.audio$ = ui.insertAudioPlayerInto(sourceUi.media$, src, title)
    sources.changeSource(sourceIx, {audio: sourceUi.audio$})
    finalizeSourceChange(sourceUi)
    //: this is for STEM testing (waveform images):
    backgroundImage && set$(sourceUis[sourceIx].media$, {css: {backgroundImage}})
  }
  ui.changeVideoElementSource = (sourceIx, video$) => {//8#2b2 [master]
    const sourceUi = prepareSourceChange(sourceIx)
    sourceUi.video$ = video$
    sourceUi.isMaster = true
    set$(sourceUi.frame$, {attr: {type: 'master'}})
    set$(sourceUi.info$, {text: 'Master video', attr: {master: true}})
    set$(sourceUi.media$, {}, sourceUi.masterThumb$ = div$({class: 'masterthumb'}))
    sources.changeSource(sourceIx, {video: video$})
    finalizeSourceChange(sourceUi)
  }
  ui.changeVideoSource = (sourceIx, {videoId, title, src}) => {//8#2b2 [mock / video]
    const sourceUi = prepareSourceChange(sourceIx)
    sourceUi.request = {method: 'changeVideoSource', sourceIx, par: {videoId, title, src}}
    const mediaHolder$ = sourceUi.media$
    set$(mediaHolder$, {html: ''}, div$({}))
    set$(sourceUi.frame$, {attr: {type: 'mock'}})
      
    insertYoutubeIframe(mediaHolder$.children[0], sourceUi, videoId)
      .then(_ => {
        clog(`📀ChangeVideoSource: Youtube iframe created and loaded.`, mediaHolder$)
        const iframe$ = mediaHolder$.children[0] //: this child is different from the child above!!
        if (iframe$?.tagName === 'IFRAME') {
          sourceUi.iframe$ = iframe$
          try {
            const idoc = iframe$.contentWindow.document
            const video = idoc.querySelector('video')
            if (video) {
              sourceUi.isVideo = true
              sourceUi.video$ = video
              set$(sourceUi.frame$, {attr: {type: 'video'}}) //: inkabb isvideo isiframe egyszerre
              sources.changeSource(sourceIx, {video})
              finalizeSourceChange(sourceUi)
            } else {
              console.warn(`📀ChangeVideoSource: cannot find video in iframe.`)
            }
          } catch (err) {
            clog(`📀ChangeVideoSource: error accessing video tag:`, err)
            if (!root.onYoutube) {
              clog(`📀ChangeVideoSource: mocking failed video with audio`)
              sourceUi.isMocked = true
              set$(sourceUi.frame$, {attr: {type: 'mock'}})
              set$(sourceUi.info$, {text: title})
              sourceUi.audio$ = mockVideoInStripWithAudio(sourceUi.media$, videoId)
              sources.changeSource(sourceIx, {audio: sourceUi.audio$})
              finalizeSourceChange(sourceUi)
            }
          }
        } else {
          console.warn(`📀ChangeVideoSource: cannot access iframe.contentWindow.document`)
        }
      })
      .catch(err => brexru(console.error(err)))
  }
  
  const changeSourceFromGrab = async event => {
    const thumb = event.target.parentElement
    const videoId = thumb.getAttribute('videoId')
    const src = thumb.getAttribute('src')
    const title = thumb.getAttribute('title')
    const sourceIx = iAttr(event.target, 'srcix') + (event.shiftKey ? 4 : 0)
    haltEvent(event)
    
    if (videoId?.length === 11 && sourceIx) {
      root.onYoutube && (event.altKey
          ? root.stateManager.removeFromYoutubeVideoList(videoId)
          : root.stateManager.addToYoutubeVideoList(videoId))
      ui.changeVideoSource(sourceIx, {videoId, title, src})
    } else if (src && sourceIx) {
      ui.changeAudioSource(sourceIx, {src, title})
    } else {
      console.warn(`ChangeVideoFromGrab error:`, {videoId, sourceIx})
    }
  }
  
  const buildVideoList = on => { //: the videolist works both on Youtube and on the demo site
    void ui.u2list$?.remove()
    const youtubeVideoIds = root.onYoutube ? root.youtubeVideoList.propertiesToArr() : []
    //: load from localstorage with pg-states (todo)
    
    if (on) {
      ui.u2list$ = div$(ui.frame$, {class: 'emu-frame'}, [
        div$({class: 'thumb-head'}, [
          div$({class: 'bee-cmd', attr: {state: 'alert'}, text: 'Close', 
            click: _ => ui.setFlag('sourceList', false)}),
          div$({text: 'Hold shift to add src 5-8!'})  
        ]),
        div$({class: 'thumb-upload'}, [1, 2, 3, 4].map(ix =>
          leaf$('input', {class: 'ss s' + ix, attr: {type: 'file', accept: 'audio/*'}, on: {
            change: event => {
              const file = event.target.files[0]
              if (file.name.beginS('stem.')) {
                ui.changeSourcesWithStems(file.name)
              } else {
                const fileUrl = window.URL.createObjectURL(file)
                ui.changeAudioSource(ix, {src: fileUrl, title: file.name.split('.mp3')[0]})
              }
            }
          }}))
        ),
        ...(root.onYoutube 
          ? youtubeVideoIds.map(videoId => div$({
              class: 'emulated au', 
              attr: {id: 'thumbnail', videoId},
              css: {backgroundImage: `url('//img.youtube.com/vi/${videoId}/mqdefault.jpg')`}
            }))
          : root.mp3s.map(({src, title, videoId}) => {
            const [art, tit] = title.split(' - ') 
            const html = `<em>${art}</em> - ${tit}`
            const backgroundImage = videoId?.length === 11 ? `url('//img.youtube.com/vi/${videoId}/mqdefault.jpg')` : undef
            return div$({
              class: 'emulated au', 
              attr: {id: 'thumbnail', videoId, src, title},
              css: {backgroundImage}
            }, div$({class: 'thtitle', html}))
          })
        )
      ])
    }
  }
  
  ui.onVideoListToggled = on => {
    buildVideoList(on)
    if (on) {
      ui.setFlag('grab', false)
      ui.setFlag('grab', true) //: this will call ui.onGrabToggled() (by chging the cmd state)
    }
  }
  
  ui.onGrabToggled = on => {
    if (on) {
      root.onYoutube || ui.setFlag('sourceList', true)
      const thumbs = []
      if (root.onYoutube) {
        for (const thumb of q$$('a#thumbnail')) {
          const href = thumb.getAttribute('href')
          if (!href?.length) {
            clog(`💿onGrabToggled: no href in youtube thumb`, thumb)
            continue
          }
          const videoId = href.split('?v=')[1].split('&')[0]
          thumbs.push({thumb, videoId})
        }
      }
      for (const thumb of q$$('div#thumbnail.emulated')) {
        const videoId = thumb.getAttribute('videoId')
        const src = thumb.getAttribute('src')
        const title = thumb.getAttribute('title')
        if (!videoId?.length && !src?.length) {
          clog(`💿onGrabToggled: no src in emu thumb`, thumb)
          continue
        }
        thumbs.push({thumb, src, videoId, title})
      }
      for (const {thumb, videoId, src = '', title = ''} of thumbs) {
        if (videoId?.length === 11 || src) {
          div$(thumb, {class: 'bfx-grab-frame', attr: {videoId, title, src}},
            '1234'.split('').map(text =>
              div$({class: 'grabber grab-to-' + text, attr: {srcix: text},
                click: changeSourceFromGrab}, div$({text}))))
        }
      }
    } else {
      for (const grab of q$$('#thumbnail > .bfx-grab-frame')) {
        grab.remove()
      }
    }
  }
  
  ui.setSourceInUseInfo = (ix, info) => set$(sourceUis[ix].frame$, {attr: {info}})
  
  const destStr = source => source.destStageIxArr.map(a => getStage(a).letter).join(', ') || 'Mute'
  
  ui.refreshSourcesUi = _ => {
    const {sourceArr, slog} = sources
    
    //: setting output marks on sources
    sourceArr.map(({destStageIxArr}, sourceIx) => {
      if (sourceIx) {
        ui.setSourceInUseInfo(sourceIx, destStr({destStageIxArr}))
        void sourceUis[sourceIx].sourceChanged?.()
      }
    })
      
    //: setting input marks on stages  
    iterateStages(({stageIx, sourceIx}) => { 
      slog(`💿setting input selectors: stage#${stageIx}] = ${sourceIx}`)
      ui.setStageInputState(stageIx, sourceIx)
    })
  }
  
  await ytApi.isReady
}
