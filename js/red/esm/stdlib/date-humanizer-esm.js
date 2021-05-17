/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, object-curly-spacing, indent */

//: [Reduced]

const {floor, round} = Math

const dateOrNow = date => typeof date === 'undefined' ? Date.now() : date

const uZone = d => new Date(dateOrNow(d) - new Date().getTimezoneOffset() * 6E4).toISOString().split('T')

export const dateToHumanDateTime = date => uZone(date).join(' ').substr(0, 19)

const hms2str = (h, m, s) => {
  const lastPad2 = u => ('0' + u).slice(-2)
  return (h ? lastPad2(h) + ':' : '') + lastPad2(m) + ':' + lastPad2(s)
}

export const timeToString = date => {  //2move to common/utils if possible
  if (!date) {
    return '--:--:--'
  }
  const [h, m, s] = [date.getHours(), date.getMinutes(), date.getSeconds()]
  return hms2str(h, m, s)
}

export const getHMSMsArray = (date = Date.now()) => {
  if (typeof date === 'number') { //4like NoW() or no args => NoW()
    date = new Date(date)
  }
  return [date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()]
}
export const getHMSArray = getHMSMsArray

export const secToString = sec => {
  sec = round(sec)
  const s = sec % 60
  sec = floor(sec / 60)
  const m = sec % 60
  const h = floor(sec / 60)
  return hms2str(h, m, s)
}
