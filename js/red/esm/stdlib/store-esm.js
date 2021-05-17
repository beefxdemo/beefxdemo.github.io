/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, no-return-assign,
  valid-typeof, object-curly-spacing, no-trailing-spaces, indent, new-cap, object-property-newline,
  block-spacing, comma-spacing, handle-callback-err,  camelcase, standard/no-callback-literal,
  no-floating-decimal, no-void, quotes */

//: [Reduced]

const {localStorage} = window

export const createStore = name => {
  const store = {
    storeType: 'localStorage',    //4or sessionStorage
    storage: localStorage,
    nameDot: name + '.'
  }
  
  const safeParseJSON = jason => {
   let parsedData = void 0
     try { parsedData = JSON.parse(jason) } catch (e) { return null }
    return parsedData
  }

  const safeStringifyJSON = (...args) => {
    let jason = ''
    try { jason = JSON.stringify(...args) } catch (e) { return 'safeStringifyError+' + e.message}
    return jason      
  }
  
  const ext = key => store.nameDot + key //9check key! undef? ''?
  
  store.load = (key, def) => safeParseJSON(store.storage.getItem(ext(key))) || def
  
  store.save = (key, val) => store.storage.setItem(ext(key), safeStringifyJSON(val) || 
    console.log(`Cannot stringify object '${key}' for localStorage! ('' stored.)`, val) || '')
    
  store.remove = key => store.storage.removeItem(ext(key))
  
  store.iterateKeys = (pattern, iteraFun) => {
    const filterString = store.nameDot + pattern
    const flen = filterString.length
    const nlen = store.nameDot.length
    for (const key in store.storage) {
      key.substr(0, flen) === filterString && iteraFun(key.substr(nlen))
    }
  }
      
  return store
}
