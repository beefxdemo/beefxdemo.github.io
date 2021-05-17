/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, camelcase, indent,
   no-trailing-spaces, no-return-assign, no-floating-decimal, object-curly-spacing,
   valid-typeof, block-spacing, no-void, quotes, import/first */

//: [Reduced]

import * as Corelib from '../stdlib/corelib-esm.js'

const {Ø, undef, isArr, isStr} = Corelib // eslint-disable-line no-unused-vars
const {wassert} = Corelib.Debug

export const domReady = _ => ['complete', 'interactive'].includes(document.readyState)

export const onReadyState = (doc = document) => new Promise(resolve => doc.getElementsByTagName('head').length
    ? resolve()
    : doc.addEventListener('readystatechange', _ => {
        if (doc.readyState === 'interactive' || doc.readyState === 'complete') {
          resolve()
        }
      })
    )

const onReadyStatePromise = onReadyState()

export const onDomReady = async callback => onReadyStatePromise.then(callback)

export const q$ = s => document.querySelector(s)
export const q$$ = s => [...document.querySelectorAll(s)]

export const create$ = (host, parent) => (name, node, parentOverride = parent) => {
  const $name = '$' + name
  host[$name] = node.appendTo(parentOverride)
  host[name] = wassert(host[$name][0])            
  return host[$name]
}

export const newBreed = plannedParent => {
  const host$ = document.createDocumentFragment()
  const spawn = parent => (parent || plannedParent || document.body).appendChild(host$)
  return {host$, spawn}
}
export const newFrag = (optParent, optRoot) => {//:attach root to parent!
  const render = (parent = optParent, root = optRoot) => {
    const nodeInDOM = parent || document.body
    wassert(typeof nodeInDOM.appendChild === 'function')
    nodeInDOM.appendChild(root)
  }
  return {render}
}

export const iAttr = (node$, attr) => parseInt(node$?.getAttribute(attr))

export const setClass$ = (node$, bool, cclass) => {
  bool ? node$.classList.add(cclass) : node$.classList.remove(cclass)
}
export const toggleClass$ = (node$, cclass) => {
  const on = !node$.classList.contains(cclass)
  setClass$(node$, on, cclass)
  return on
}

export const css$ = (node, css) => {
  for (const key in css) {
    const modKey = key.beginS('__') ? '--' + key.substr(2) : key
    if (modKey.beginS('--')) {
      node.style.setProperty(modKey, css[key])
    } else {
      if (key.includes('-')) {
        const jsKey = key // mapCss2Js(key)
        console.log({key, jsKey})
        node.style[jsKey] = css[key]
      } else {
        node.style[key] = css[key]
      }
    }
  }
}
export const set$ = (node, pars = {}, children) => {
  const cclass = pars.class || pars.cclass || []
  const {css, attr = {}, id, text, html, value, on = {}, click} = pars
  const {deattr, declass = []} = pars
  id && (attr.id = id)
  const classList = isArr(cclass) ? cclass : cclass ? cclass.split(' ').filter(a => a) : []
  const declassList = isArr(declass) ? declass : declass ? declass.split(' ').filter(a => a) : []
  classList.length && node.classList.add(...classList)
  declassList.length && node.classList.remove(...declassList)
  for (const key in attr) {
    node.setAttribute(key, attr[key])
  }
  for (const key in deattr) {
    node.removeAttribute(key)
  }
  css$(node, css)
  typeof children === 'string' && (node.textContent = children)
  if (typeof text === 'string') {
    node.textContent = text 
  } else if (typeof text === 'number') {
    node.textContent = text + ''
  }
  isStr(html) && (node.innerHTML = html)
  typeof value !== Ø && (node.value = value)
  for (const eventType in on) {
    node.addEventListener(eventType, on[eventType])
  }
  click && node.addEventListener('click', click)//:shortcut
  if (children && typeof children === 'object') {
    children.nodeType && (children = [children])
    wassert(isArr(children))
    for (const child of children) {
      typeof child === 'string'
        ? node.appendChild(document.createTextNode(child))
        : child && child.nodeType && node.appendChild(child)
    }
  }
  return node
}
export const leaf$ = (type, pars, children = [], realChildren) => {
  if (pars && (pars.nodeType || pars.jquery)) {
    return end$(type, pars, children, realChildren)//: type, pars->root, children->pars, real->ch
  }
  return type === 'frag'
    ? set$(document.createDocumentFragment(), pars, children)
    : set$(document.createElement(type), pars, children)
}
export const div$ = (...args) => leaf$('div', ...args)
export const canvas$ = (...args) => leaf$('canvas', ...args)
export const span$ = (attr, children) => leaf$('span', attr, children)
export const frag$ = children => leaf$('frag', {}, children)

export const end$ = (type, root, pars, children) => root.appendChild(leaf$(type, pars, children))

export const D = {c: leaf$}
D.extend = sa => sa.split(',').map(tag => D[tag] = (...args) => leaf$(tag, ...args))
D.extend('div,span,a,h1,h2,h3,strong,em,form,label,input,button,ul,li')

export const state$ = node => {
  wassert(node)
  
  const state = {
    classHash: {},
    attr: {},
    css: {},
    text: node.textContent,
    html: node.innerHTML
  }
  const reHash = _ => {
    state.classHash = {}
    for (const cl of [...node.classList]) {
      state.classHash[cl] = true
    }
    //:css not important - will be filled on first sets, the perf only important later
  }
  reHash()
  
  state.set = pars => {
    const cclass = pars.class || pars.cclass || []
    const {css, attr = {}, text, html, value} = pars
    const {deattr = {}, declass = []} = pars
    const classList = isArr(cclass) ? cclass : cclass ? cclass.split(' ').filter(a => a) : []
    const declassList = isArr(declass) ? declass : declass ? declass.split(' ').filter(a => a) : []
    let doSet = false
    for (const cl of classList) {
      if (!state.classHash[cl]) {
        state.classHash[cl] = true
        doSet = true
      }
    }
    for (const cl of declassList) {
      if (state.classHash[cl]) {
        delete state.classHash[cl]
        doSet = true
      }
    }
    for (const prop in css) {
      if (state.css[prop] !== css[prop]) {
        state.css[prop] = css[prop]
        doSet = true
      }
    }
    for (const key in attr) {
      if (state.attr[key] !== attr[key]) {
        state.attr[key] = attr[key]
        doSet = true
      }
    }
    for (const key in deattr) {
      if (state.attr[key]) {
        delete state.attr[key]
        doSet = true
      }
    }
    if (isStr(text) && state.text !== text) {
      state.text = text
      doSet = true
    }
    if (isStr(html) && state.html !== html) {
      state.html = html
      doSet = true
    }
    if (typeof value !== Ø) {
      state.value = value
      doSet = true
    }
    doSet && set$(node, pars)
    //console.log({doSet, node}, pars, state)
    return node //????
  }
  state.get = _ => state
  
  state.remove = _ => node.remove() //: no need for this
  
  return state
}

export const haltEvent = event => {
  event.preventDefault()  
  event.stopPropagation()
}
