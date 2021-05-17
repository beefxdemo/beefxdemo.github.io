# beeFX Web Audio library & playground

beeFX is a collection of filters, audio effects, visualisers and other tools for the Web Audio API with a unified widget UI.

![image](https://github.com/setalosas/beefx/blob/main/doc/dem8.jpg)

You can watch a longer video demo here:

[![youtube](https://github.com/setalosas/beefx/blob/main/doc/beevid.png)](https://www.youtube.com/watch?v=ZxTfdHzt3Ic)

# The components of beeFX

The original goal of this project was to make an extendable library of audio effects. As these filters are quite difficult to test without an existing audio environment, it appeared a good idea to create a test app. So the playground subproject was born to implement a testing tool, but then it grew beyond this original goal and became a full stand-alone interactive testing bed / experimenting lab with lots of Ui elements and attached components.

Although many parts of beeFX are implemented (and working), the project itself is in development phase. Thus the final architecture can change, but here are the components of the current concept:

## The beeFX library

There are lots of audio effects around on the web from different sources. However, they differ in their implementation. It's quite difficult to build a complex audio system if the elements are not standardized.

There are a few solutions which implements filters and effects as standardized elements, most notably Tuna, Note.js, Pizzicato, etc. However, I found it difficult or impossible to extend them with new filters or variations without tinkering the original source code.

So the most important feature goal of beeFX was the easy extensibility, new effects should be added easily as separate modules, using the common architecture of the library. Of course similar filters or variations can be grouped into one module.

Currently the beeFX library has over 60 effects or other Web Audio gadgets. These effects - at least the algorithm of them - are from various sources, but they were rewritten to fit the beeFX architecture (and also into ES6 Javascript from various dialects / standards / languages). Many effects are in test phase, as there are different implementations for each filter, I tried a few variations and made a lot of experimental ones. (It's quite easy to write bad effects. However my goal is to make an audio library, not getting a PhD in DSP.) This collection must be cut down to a more standard set for a release, but at this moment this set is not defined yet (and I still love experimenting with the filter variations).

Also, this is a work in progress, have to find out yet a few things. The most important issue is the separation of the different parts - visualizations from effects, UIs from the core. The project concept changed a lot since the original idea was born. Currently (almost) all effects or other audio components can be used in headless mode (just managing them from a program without UI) except of course things like visualisations. The main topic of interest is whether the infrastructural parts (like source or stage handling) should be included in beeFx or it's better to make a stand-alone layer from them.

For the very short term the goal here is to make a core effect library and a separate extension library for the not-so-standard elements.

So the separation is something like:

Core:
* Basic WAU filters
* IIR filters
* Equalizers
* Convolvers (from impulse and sample)
* BBC Ring Modulator
* Compressor
* etc.

Extensions:
* BPM detector
* Recorder
* Sampler
* Oscilloscope
* Spectrum
* etc.

Everything in the Core must work in headless mode, the Extension part contains components which can or cannot be used without Ui.

In the wiki there is (or soon will be) a detailed desciption of how to create, connect and control beeFX filters, it's basically works the same way as for every similar library.

## The beeFX Playground

![image](https://github.com/setalosas/beefx/blob/main/doc/golem.jpg)

Starting as a testing tool, the playground grew into an application where the user can define different audio sources and chains of effects for them in different channels (stages), something like a mixer board with effect modules.

The UI elements are not part of the core effect modules, they are generated automatically from the effects definition data (so the definition data containes properties which are only useful for the user interface, but this part is very thin).

The playground also contains infrastructure elements for building a multi-stage audio chain with sources (and players). This is not needed at all when using the effect library, just an option.

This repo itself is the playground at this moment, but I plan to put the components into different repos after the first development phase.

VID

## The beeFX Chrome Extension for Youtube

The playground as a site has limits in the use of copyrighted music - of course I cannot include real songs with it. There is no much fun trying out a complex effect pipeline with free music or singing through the microphone, so from the beginning there was an option for upload and use any user files (mp3 or wav). However, not too many users have mp3s on their computer these days. So it seemed natural to use Youtube videos as audio sources - but here comes a wall again: embedded youtube iframes are closed, there is no way to access their audio output. Except of course if the playground runs on the youtube.com domain.

So as a very simple solution to that problem it can run on the youtube.com domain. This repo is also a Chrome extension - you have to load into Chrome with the 'Load unpacked' option on the chrome://extensions page. With this extensions almost any Youtube video can be used as a source - except the ones where the embed is disabled (these can be used only if they are the main video on that page).

There is a normal mode when you click on the bee in the bottom left corner and a full takeover mode if you click with the Shift key held down. This is useful because it kills the complete youtube page (it needs quite a lot resources).

Currently the playground can be used with local audio files, youtube videos, audio file links and also with STEMs (parallel tracks for a song). For testing there is also a mock mode when it's possible to use Youtube videos if we have locally the audio files for them - there are many online downloading sites to create these files. 

# Installation

This is an unreleased library, there is no npm package yet, you can download the repo and try it (the index.html gives you a static site, the manifest allows you to use this same folder as a Chrome extension on Youtube, the js/beefx folder contains the core library without the playground and UI elements. It's possible to use this subfolder without the other parts, at least I use it in a bigger sequencer app as a library.

Note: **no dependencies**, so you don't have to install anything. No external libraries, frameworks or packagers used, it's pure ES6 Javascript and this repo contains every line of code used in the library or the playground - no surprises. (Ok, there is one exception: we include the Youtube API for the Youtube embeds of course, but it's dynamic include from Google servers.)

I'm working on a React version, but it's in a very preliminary phase yet. The Player controls are converted, but they work with or without React. The React version is pulled in only if there is a 'react' string in the url (?react at the end of it for example).

# Performance

The Web Audio API is quite effective, audio graphs consisting of more than 1000 nodes are running without problem on the playground. Of course complex filters can be implemented badly and there are a few problematic, especially the ones using ScriptProcessorNode or AudioWorkletNode (e.g. Recorder, BPM detector, Sampler) or the Convolver, but most of the effects are surprisingly cheap in CPU.

For the playground of course the DOM is the bottleneck in most cases.

(I don't know how to make an exact performance test with audio graphs, the current method is that for each element type I put 16 pieces of them into the playground at the same time and let it run for a minute - the table with the results will be included in the Wiki. There must be a better way than comparing the CPU graph screenshots.)

# Browsers

The playground is intented to run in Chrome and for now I don't plan test other browsers. However:
* It works in Firefox but the UI controls are ugly.
* It works in Edge, but a few effects have some sound artifacts. (I will find out why as Edge is more comfortable for development than Chrome as it's much faster.)
* It works in Android Chrome on phones too if someone has quite small fingers (or a huge phone).

# Acknowledgments

The main goal of this project is not to find out how to compute the coefficients of a stable IIR filter (although accidentally it happened), but to collect and standardize the many audio effects and useful things available in the open source. There are lots of sources and the list grows day by day, the most important ones are:

* Oskar Eriksson (Theodeus), the creator of [Tuna](https://github.com/Theodeus/tuna), from whom I borrowed many ideas and algorithms.
* Chris Wilson [cwilso](https://github.com/cwilso) (Google), who created countless Web Audio demos and examples.
* Raymond Toy (rtoy) ([webaudio-hacks](https://github.com/rtoy/webaudio-hacks))
* [mohayonao](https://github.com/mohayonao) - [wave-tables](https://github.com/mohayonao/wave-tables) collection
* José M. Pérez ([JMPerez](https://github.com/JMPerez)) original implementation of the [BPM detection](https://github.com/JMPerez/beats-audio-api)
  * [Detecting tempo of a song using browser's Audio API](https://jmperezperez.com/bpm-detection-javascript/)   
  * [Beat Detection Using JavaScript and the Web Audio API by Joe Sullivan](http://joesul.li/van/beat-detection-using-web-audio/)
* [The Scientist and Engineer's Guide to Digital Signal Processing By Steven W. Smith, Ph.D.](http://www.dspguide.com/) - Chebyshev-filter coefficient algorithm
* [khoin](https://github.com/khoin) - implementation of Jon Dattorro's reverb algorithm
* Reverb impulse response samples are from [Voxengo](https://www.voxengo.com/impulses/)'s free collection 
* [BBC](https://github.com/bbc/webaudio.prototyping.bbc.co.uk/blob/master/src/ring-modulator.coffee) - Ring modulator
* [Zach Denton](https://noisehack.com/) - noises
