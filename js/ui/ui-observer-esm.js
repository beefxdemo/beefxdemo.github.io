/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
/* eslint-disable no-unused-vars */   
   
import {Corelib, DOMplusUltra} from '../improxy-esm.js'

const {undef, hashOfString, getRndDig, no, isObj} = Corelib
const {wassert, weject, wejectNaN} = Corelib.Debug
const {post, startEndThrottle, schedule, adelay, since, NoW} = Corelib.Tardis
const {secToString} = Corelib.DateHumanizer
const {q$} = DOMplusUltra
const {abs} = Math

//8#49f -------------------------- Players ui --------------------------

const createModule = _ => { //: Extends the sourceUi object with player functionality
  const logOn = false
  const logScrapingOn = false
  const logMediaStateOn = false
  const logSyncOn = true
  const logSyncVerboseOn = false
  const clog = (...args) => logOn && console.log(...args) // eslint-disable-line
  const slog = (...args) => logScrapingOn && console.log(...args) // eslint-disable-line
  const ylog = (...args) => logSyncOn && console.log(...args) //
  const zlog = (...args) => logSyncVerboseOn && console.log(...args) //
  
  //8#49cScraping the youtube DOM for video data
  /* 
  Oddly it's not trivial to find out the currently played video id and title on Youtube.
  If we first load Youtube, we can get them from meta tags of the head, but if we navigate
  inside Youtube, the head won't exactly follow which video is played.
  There is always exactly one video tag (even it's invisible) and this element is persistent
  through the session (even if the video in it or the page changes) but it won't give away
  directly the title and the id. 
  So first we have to find out whether the played video is in the normal or mini player.
  Then we can choose the h1 element containing the title (as both player has one).
  If the video is played in the mini player, there is no direct way to find out the video id.
  We have to iterate through the mini player's playlist and find the item containing the already
  found title and extract the id with the href associated to the playlist item.
  This method can fail if there are two videos in that playlist (~queue) with the very same title.
  However, as Google changes the inner structure of the Youtube DOM quite regularly,
  it's not worth it to make bigger efforts here - these infos are not _that_ important.
  This method works now (03/2021) but there's no guarantee that it will work in the future.
  */  
  const scrapingYoutubeForVideoInfo = _ => {
    const real = {}
    const h1Big = q$('h1 .ytd-video-primary-info-renderer')?.textContent
    const h1Mini = q$('h1 .miniplayer-title')?.textContent
    const miniplayer = q$('ytd-miniplayer')
    const videoInMiniplayer = miniplayer?.querySelector('ytd-player')

    if (videoInMiniplayer) {
      real.videoTitle = h1Mini
      slog(`🟦 ${real.videoTitle = h1Mini}`)
      const wcEndPoints = [...miniplayer.querySelectorAll('a#wc-endpoint')]
      for (const wcEndPoint of wcEndPoints) {
        const videoId = wcEndPoint.getAttribute('href')?.split('?v=')[1]?.substr(0, 11)
        const title = wcEndPoint.querySelector('#video-title')?.getAttribute('title')
        title === h1Mini && (real.videoId = videoId)
      }
       slog(`🔷${real.videoId}`)
    } else {
      real.videoTitle = h1Big
      real.videoId = q$('.ytd-page-manager[video-id]')?.getAttribute('video-id')
      slog(`🟥${real.videoTitle}`)
      slog(`🔶 ${real.videoId}`)
    }
    return real
  }
  
  const createMediaObserver = (sourceUi) => {
    const observer = {
      sourceUi, //: for debug only
      videoState: undef,
      audioState: undef,
      iframeState: undef,
      lastState: {},
      currState: {},
      videoHash: '',
      audioHash: '',
      iframeHash: ''
    }
    const observerTickPeriod = 300 // 1000
    
    const getYtPlayerState = _ => {
      const ytp = sourceUi.ytPlayer
      const currentTime = ytp.getCurrentTime()
      const duration = ytp.getDuration()
      const {title, video_id: videoId} = ytp.getVideoData()
      const volume = ytp.getVolume()
      const playbackRate = ytp.getPlaybackRate()
      const muted = ytp.isMuted()
      const playerState = ytp.getPlayerState()
      // -1: unstarted // 0: ended // 1: playing // 2: paused // 3: buffering // 5: video cued
      return observer.iframeState = {
        paused: playerState !== 1, playerState, currentTime, duration, playbackRate,
        title, videoId, volume, muted, isIframeState: true
      }
    }
    
    const getVideoElementState = _ => { //: youtube.com video
      const {paused, volume, title, muted, currentTime, duration, playbackRate} = sourceUi.video$
      const {videoTitle, videoId} = scrapingYoutubeForVideoInfo()
      return observer.videoState = {
        paused, currentTime, duration, playbackRate,
        title, videoTitle, videoId, volume: volume * 100, muted, isVideoState: true
      }
    }
    
    const getAudioElementState = _ => {
      const {paused, volume, title, muted, currentTime, duration, playbackRate} = sourceUi.audio$
      return observer.audioState = {
        paused, currentTime, duration, playbackRate,
        title, videoTitle: '', videoId: '', volume: volume * 100, muted, isAudioState: true
      }  
    }
    const logState = type => {
      const state = observer[type + 'State']
      if (state) {
        const {paused, currentTime = 0.1, duration: d, playbackRate} = state
        const {title = '', videoTitle = '', videoId, volume, muted} = state
        const duration = d || 0.1 //Number.isNaN(d) ? 1 : d
        const info = `paused=${paused} curr=${currentTime.toFixed(2)}  dur=${duration.toFixed(2)} pbRate=${playbackRate} vol=${volume} muted=${muted} title=${title.substr(0, 40)} videoId=${videoId} videoTitle=${videoTitle.substr(0, 30)}`
        zlog(type, info)
      }
    }

    observer.getState = _ => sourceUi.video$ 
      ? observer.videoState 
      : sourceUi.audio$ 
        ? observer.audioState
        : sourceUi.iframe$
          ? observer.iframeState : {}

    const syncMocked = _ => {
      const {iframeState: slave, audioState: master} = observer
      const {ytPlayer} = sourceUi
      const diffToMaster = slave.currentTime - master.currentTime
      
      const konf = {
        coolDown: 2500, // this is in ms
        maxOkLag: .15, // .06
        preRun: .07 // .05
      }
      if (abs(diffToMaster) > konf.maxOkLag) {
        const elapsed = since(sourceUi.lastPlayerSyncAt || 0)
        if (elapsed > konf.coolDown) {
          const newSlaveTime = master.currentTime + (diffToMaster < 0 ? 2 : 1) * konf.preRun
          ytPlayer.seekTo(newSlaveTime, true)
          sourceUi.lastPlayerSyncAt = NoW()
          
          const diff = diffToMaster.toFixed(3)
          const masterAt = master.currentTime.toFixed(3)
          const slaveAt = slave.currentTime.toFixed(3)
          const targetAt = newSlaveTime.toFixed(3)
          const inf = `⚡️⚡️sync(${diff})-> slave:${slaveAt} master:${masterAt} new slave:${targetAt}`
          ylog(inf)
        } else {
          //console.log('elapsed to small', elapsed)
        }
      }
      if (master.paused !== slave.paused) {
        if (master.paused && slave.playerState === 1) { //: 1=playing
          ytPlayer.pauseVideo()
          ylog('⚡️⚡️sync pause!')
        } else if (!master.paused && [2, 5].includes(slave.playerState)) {
          ytPlayer.playVideo()
          ylog('⚡️⚡️sync play!')
        }
      }
      if (abs(master.playbackRate - slave.playbackRate) > .01) {
        ylog('⚡️⚡️sync speed!', master.playbackRate.toFixed(3), slave.playbackRate.toFixed(3))
        ytPlayer.setPlaybackRate(master.playbackRate)
      }
      if (!slave.muted) {
        ylog('⚡️⚡️sync mute!')
        ytPlayer.mute()
      }
    }
      
    const getMediaElementState = (fp = 0) => {
      if (!fp) {
        return console.error(`getMediaElement: dead observer?`, observer)
      }
      if (sourceUi.iframe$) {
        getYtPlayerState() //: no need to store in currState, the video / audio will overwrite it
      }
      if (sourceUi.video$) {
        getVideoElementState()
        observer.currState = {...observer.videoState}
      } else if (sourceUi.audio$) {
        getAudioElementState()
        observer.currState = {...observer.audioState}

        if (sourceUi.isMocked) {   //: this is the syncing point as it's a quite low level
          if (sourceUi.iframe$) {
            syncMocked()
          } else {
            console.warn(`getMediaElementState(): no iframe in mocked mode!`, observer)
          }
        }
      }
      const {currState, iframeState} = observer
      if (currState.videoId?.length !== 11) {
        currState.videoId = iframeState?.videoId
      }
      currState.title = currState.title || iframeState?.title || ''
      if (Number.isNaN(currState.duration)) {
        currState.duration = iframeState?.duration
      }
      
      observer.currStateReduced = {...observer.currState, currentTime: 0}

      const stateHashReduced = hashOfString(JSON.stringify(observer.currStateReduced))
      const hasTimeChanged = observer.lastState.currentTime !== observer.currState.currentTime
      const hasAllChanged = observer.mediaStateHashReduced !== stateHashReduced
      if (hasTimeChanged || hasAllChanged) {
        if (logMediaStateOn && hasAllChanged) {
          const tab = []
          observer.currState && tab.push(observer.currState)
          observer.audioState && tab.push(observer.audioState)
          observer.videoState && tab.push(observer.videoState)
          observer.iframeState && tab.push(observer.iframeState)
          console.table(tab)
        }
        hasAllChanged && sourceUi.onStateChanged()
        hasTimeChanged && sourceUi.onTimeChanged()
        observer.mediaStateHashReduced = stateHashReduced
        observer.lastState = observer.currState
        
        //if (playground.isSlave) { //: multi-window sync, disabled
          //sendGeneral('state', state)
          //console.log(`🚀state sent from slave`)
        //
      }
      if (logOn) {
        logState('last')
        const fps = fp === observer.fp ? `${fp}✔️` : `${fp}❌ (${observer.fp})`
        clog(`------${sourceUi.sourceIx}--${fps}----${observer.lastState.title}`)
      }
    }
    const lazyGetMediaElementState = startEndThrottle(getMediaElementState, observerTickPeriod)
    
    const tick = fp => {
      if (observer.fp === fp) {
        lazyGetMediaElementState(fp)
        schedule(observerTickPeriod).then(_ => tick(fp))
      } else {
        console.warn('observer tick aborted', fp, observer.fp)
      }
    }
      
    const init = _ => { //: this works for both video and audio
      const mediaElement = sourceUi.audio$ || sourceUi.video$
      //: TODO: We need an Ui control for this:
      sourceUi.audio$ && (sourceUi.audio$.volume = .7)
      observer.mediaElement = mediaElement
      const fp = 1 + getRndDig(6)
      mediaElement && post(_ => {
        mediaElement.addEventListener('onloadedmetadata', event => {
          zlog('ONLOADEDMETADATA', event)
          getMediaElementState(fp)
        })
        mediaElement.addEventListener('play', event => getMediaElementState(fp))
        mediaElement.addEventListener('pause', event => getMediaElementState(fp))
        mediaElement.addEventListener('seeked', event => getMediaElementState(fp))
        mediaElement.addEventListener('timeupdate', event => lazyGetMediaElementState(fp))
        zlog(`mediaObserver started listening to `, fp, mediaElement.title, mediaElement)
        observer.fp = fp
        tick(fp)
      })
    }
    init()
    
    observer.destroy = _ => observer.fp = 0
    
    return observer
  }
  return {createMediaObserver}
}

export const {createMediaObserver} = createModule()
