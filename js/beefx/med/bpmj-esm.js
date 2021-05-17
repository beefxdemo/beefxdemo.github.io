/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, no-unused-vars, 
   object-curly-spacing, no-trailing-spaces, quotes, no-return-assign, indent */

const {OfflineAudioContext} = window

//: Original algorithm from JMPerez (based on Joe Sullivan's article).
//: Tweaked a lot, it's better now but it still has problems (works in most cases).
//: Reliability depends on the length of the sample (originally it needed 30secs,
//: now it works quite fine with 10-15s samples (even 5sec / 70 bpm works for a song!)).
//: Fast and precise BPM detection is crucial as it feeds many BeeFX components. 
//: There are a lot of possibilites for experimenting here.
//: And also there is a slightly different version of this algorithm from 
//: https://github.com/dlepaux/allegro-youtube-bpm-extension (and other different ones too).
//: There is definitely more space to experiment with this.
//: The main problem now is the beat window, 60-120 is too small, a 60-180 window seems 
//: difficult to implement (this algo is limited into a x..2x window).
//: In theory this is not an impossible problem, hardware DJ controllers are very
//: reliable and fast with BPM detection.
//: Of course we are limited by the sample's length - a DJ controller knows the full song.

export const detectBPMj = (buffer, {minBpm = 66} = {}) => {
  const bpm = {}
  const warnings = []
    
  const {duration, length, numberOfChannels, sampleRate} = buffer

  function getPeaks (data) {
    // What we're going to do here, is to divide up our audio into parts.
    // We will then identify, for each part, what the loudest sample is in that part.
    // It's implied that that sample would represent the most likely 'beat' within that part.
    // Each part is 0.5 seconds long - or 22050 samples.
    // This will give us 60 'beats' - we will only take the loudest half of those.
    // This will allow us to ignore breaks, and allow us to address tracks with a BPM below 120.
    const len = data[0].length
    const le = data[0]
    const ri = data[1]
    const vol = new Array(len)
    for (let i = 0; i < len; i++) {
      vol[i] =  Math.max(Math.abs(le[i]), Math.abs(ri[i]))
    }
    // Modifications to the original:
    // We don't want to detect the edges of parts as they are most probably false ones and
    // this gives us a lot of false 120 bpm hints (if the parts are 1/2 sec long).
    // So we first detect local peaks (ie the left and right frames are both lower that that).
    // Also we use shorter samples, so we need more peaks, so we use smaller parts (1/4 sec).
    const partSize = sampleRate / 4
    const parts = len / partSize
    const peaks = []
  
    for (let i = 0; i < parts; i++) {
      let ix = i * partSize
      
      const localPeaks = []
      for (let p = 1; p < partSize - 1; p++, ix++) {
        if (vol[ix - 1] < vol[ix] && vol[ix] > vol[ix + 1]) {
          // We could check here the distance from the previous peak (and throw away the lower
          // one if the distance is too small). LATER.
          localPeaks.push({pos: ix, p, vol: vol[ix]})
        }
      }
      if (!localPeaks.length) { // It's possible a silent part (all 0s). 
        warnings.push({msg: 'noPeaks', par: {i, parts}})
        console.warn(`No local peaks found`, {i, parts})  
        continue
      }   
      let max = {
        position: 0,
        volume: 0
      }
      for (const {pos, vol, p} of localPeaks) {
        if (vol > max.volume) {
          max = {
            // p, // p was stored to check for edges, but it's not needed now.
            position: pos,
            volume: vol
          }
        }
      }
      peaks.push(max)
    }
    /*  original code
    for (var i = 0; i < parts; i++) {
      var max = 0
      for (var j = i * partSize; j < (i + 1) * partSize; j++) {
        var volume = Math.max(Math.abs(data[0][j]), Math.abs(data[1][j]))
        if (!max || (volume > max.volume)) {
          max = {
            position: j,
            volume: volume
          }
        }
      }
      peaks.push(max)
    } */
    peaks.sort((a, b) => b.volume - a.volume) 
    // We then sort the peaks according to volume, take the loudest half of those
    // and re-sort it back based on position.
  
    return peaks.splice(0, peaks.length * 0.5).sort((a, b) => a.position - b.position)
  }

  function getIntervals (peaks) {
    // What we now do is get all of our peaks, and then measure the distance to other peaks,
    // to create intervals.  Then based on the distance between those peaks (the distance of 
    // the intervals) we can calculate the BPM of that particular interval. The interval 
    // that is seen the most should have the BPM that corresponds to the track itself.
  
    const groups = []
  
    peaks.forEach(function (peak, index) {
      for (var i = 1; (index + i) < peaks.length && i < 10; i++) {
        // This check is important only if we use overlapping parts:
        if (peaks[index + i].position === peak.position) { 
          continue
        }
        var group = {
          tempo: (60 * 44100) / (peaks[index + i].position - peak.position),
          volume: peaks[index + i].volume,
          count: 1
        }
        
        while (group.tempo < minBpm) { // was 90, but must be a parameter
          group.tempo *= 2
        }
  
        while (group.tempo > 180) {
          group.tempo /= 2
        }
  
        group.tempo = Math.round(group.tempo)
  
        if (!(groups.some(function (interval) {
          return (interval.tempo === group.tempo ? interval.count++ : 0)
        }))) {
          groups.push(group)
        }
      }
    })
    return groups
  }
  
  const detectj = _ => new Promise(resolve => {
    var offlineContext = new OfflineAudioContext(numberOfChannels, duration * sampleRate, sampleRate)
    const source = offlineContext.createBufferSource()
    source.buffer = buffer

    // Beats, or kicks, generally occur around the 100 to 150 hz range.
    // Below this is often the bassline.  So let's focus just on that.
    
    //: This should also be tried out with different filter parameters!

    // First a lowpass to remove most of the song.
    const lowpass = offlineContext.createBiquadFilter()
    lowpass.type = "lowpass"
    lowpass.frequency.value = 150
    lowpass.Q.value = 1

    // Run the output of the source through the low pass.
    source.connect(lowpass)

    // Now a highpass to remove the bassline.
    const highpass = offlineContext.createBiquadFilter()
    highpass.type = "highpass"
    highpass.frequency.value = 100
    highpass.Q.value = 1

    // Run the output of the lowpass through the highpass.
    lowpass.connect(highpass)

    // Run the output of the highpass through our offline context.
    highpass.connect(offlineContext.destination)

    // Start the source, and render the output into the offline conext.
    source.start(0)
    offlineContext.startRendering()
    
    offlineContext.oncomplete = function (e) {
      const buffer = e.renderedBuffer
      const peaks = getPeaks([buffer.getChannelData(0), buffer.getChannelData(1)])
      const groups = getIntervals(peaks)
      //console.table(groups)
      
      const candidates = groups.sort((intA, intB) => intB.count - intA.count).slice(0, 20)
      bpm.capture({candidates, groups, peaks, warnings})
      
      //console.log(bpm)
      resolve(bpm)
    }
  })
  
  return detectj()
}
