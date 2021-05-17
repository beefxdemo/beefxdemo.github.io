/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   standard/no-callback-literal, object-curly-newline */
  
import * as Corelib from '../stdlib/corelib-esm.js'
import * as DOMplusUltra from './dom-plus-ultra-esm.js'

const {nop, isStr, sanitize} = Corelib
const {leaf$} = DOMplusUltra
void isStr

//8#87d Redapt - React/DOMplusUltra adapter - currently selects React if 'react' is in the URL

export const Redact = (async _ => {
  const R =  {
    useReact: window.location.href.includes('react'),
    //isReady: pinky.promise('redact'),
    isProduction: false
  }
  
  if (R.useReact) {
     if (R.isProduction) {
      await import('https://cdn.skypack.dev/react')
      await import('https://cdn.skypack.dev/react-dom')
    } else {
      await import('./react.development.js')
      await import('./react-dom.development.js')
    }
    const {React, ReactDOM} = window
    R.capture({React, ReactDOM})

    R.c = React.createElement
    
    R.extend = sa => sa.split(',').map(tag => R[tag] = (...args) => {
      delete args[0].re
      return R.c(tag, ...args)
    })
    R.extend('div,span,a,h1,h2,h3,strong,em,form,label,input,button,ol,ul,li')
    R.extendComp = CC => R[CC.name] = (...args) => R.c(CC, ...args)
    R.ext = R.extendComp
    R.Frag = (...args) => R.c(React.Fragment, ...args)
    R.X = fun => R.c(fun)
  } else {
    R.React = {
      useState: _ => [{}, nop],
      useRef: _ => [{}, nop],
      createRef: _ => ({isRef: true}),
      forwardRef: fun => ({render: fun})
    }
    R.ReactDOM = {
      render: nop
    }
      
    R.c = (tag, par, ...children) => {
      if (children[0]?.isRef) {
        par.re = children.shift()
        return R.c(tag, par, ...children)
      }
      par.cclass = par.className
      par.style && (par.css = par.style)
      delete par.className
      delete par.style
      par.on = {
        click: par.onClick,
        mouseenter: par.onMouseEnter,
        mousemove: par.onMouseMove,
        change: par.onChange
      }
      sanitize(par.on)
      sanitize(par)
      try {
        const node = leaf$(tag, par, children)
        par.re && (par.re.current = node)
        //console.log(node, tag, par, children)
        return node
      } catch (err) {
        console.error(err)
        console.log(tag, par, children)
        debugger
      }
    }
    
    R.extend = sa => sa.split(',').map(tag => R[tag] = (...args) => R.c(tag, ...args))
    R.extend('div,span,a,h1,h2,h3,strong,em,form,label,input,button,ol,ul,li')
    R.extendComp = CC => R[CC.name] = (...args) => R.c(CC, ...args)
    R.ext = R.extendComp
    R.Frag = (...args) => R.c('frag', ...args)
    R.X = fun => fun()
  }
  //pinky.redact.resolve(R)
  return R
})()
