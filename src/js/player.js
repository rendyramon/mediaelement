'use strict';

import window from 'global/window';
import document from 'global/document';
import mejs from './core/mejs';
import MediaElement from './core/mediaelement';
import i18n from './core/i18n';
import {
	IS_FIREFOX,
	IS_IPAD,
	IS_IPHONE,
	IS_ANDROID,
	IS_IOS,
	IS_STOCK_ANDROID,
	HAS_MS_NATIVE_FULLSCREEN,
	HAS_TRUE_NATIVE_FULLSCREEN
} from './utils/constants';
import {splitEvents, debounce, isNodeAfter, createEvent} from './utils/general';
import {calculateTimeFormat} from './utils/time';
import {getTypeFromFile} from './utils/media';
import * as dom from './utils/dom';

mejs.mepIndex = 0;

mejs.players = {};

// default player values
export const config = {
	// url to poster (to fix iOS 3.x)
	poster: '',
	// When the video is ended, show the poster.
	showPosterWhenEnded: false,
	// When the video is paused, show the poster.
	showPosterWhenPaused: false,
	// Default if the <video width> is not specified
	defaultVideoWidth: 480,
	// Default if the <video height> is not specified
	defaultVideoHeight: 270,
	// If set, overrides <video width>
	videoWidth: -1,
	// If set, overrides <video height>
	videoHeight: -1,
	// Default if the user doesn't specify
	defaultAudioWidth: 400,
	// Default if the user doesn't specify
	defaultAudioHeight: 40,
	// Default amount to move back when back key is pressed
	defaultSeekBackwardInterval: (media) => media.duration * 0.05,
	// Default amount to move forward when forward key is pressed
	defaultSeekForwardInterval: (media) => media.duration * 0.05,
	// Set dimensions via JS instead of CSS
	setDimensions: true,
	// Width of audio player
	audioWidth: -1,
	// Height of audio player
	audioHeight: -1,
	// Initial volume when the player starts (overridden by user cookie)
	startVolume: 0.8,
	// Useful for <audio> player loops
	loop: false,
	// Rewind to beginning when media ends
	autoRewind: true,
	// Resize to media dimensions
	enableAutosize: true,
	/*
	 * Time format to use. Default: 'mm:ss'
	 * Supported units:
	 *   h: hour
	 *   m: minute
	 *   s: second
	 *   f: frame count
	 * When using 'hh', 'mm', 'ss' or 'ff' we always display 2 digits.
	 * If you use 'h', 'm', 's' or 'f' we display 1 digit if possible.
	 *
	 * Example to display 75 seconds:
	 * Format 'mm:ss': 01:15
	 * Format 'm:ss': 1:15
	 * Format 'm:s': 1:15
	 */
	timeFormat: '',
	// Force the hour marker (##:00:00)
	alwaysShowHours: false,
	// Show framecount in timecode (##:00:00:00)
	showTimecodeFrameCount: false,
	// Used when showTimecodeFrameCount is set to true
	framesPerSecond: 25,
	// Hide controls when playing and mouse is not over the video
	alwaysShowControls: false,
	// Display the video control when media is loading
	hideVideoControlsOnLoad: false,
	// Display the video controls when media is paused
	hideVideoControlsOnPause: false,
	// Enable click video element to toggle play/pause
	clickToPlayPause: true,
	// Time in ms to hide controls
	controlsTimeoutDefault: 1500,
	// Time in ms to trigger the timer when mouse moves
	controlsTimeoutMouseEnter: 2500,
	// Time in ms to trigger the timer when mouse leaves
	controlsTimeoutMouseLeave: 1000,
	// Force iPad's native controls
	iPadUseNativeControls: false,
	// Force iPhone's native controls
	iPhoneUseNativeControls: false,
	// Force Android's native controls
	AndroidUseNativeControls: false,
	// Features to show
	features: ['playpause', 'current', 'progress', 'duration', 'tracks', 'volume', 'fullscreen'],
	// Only for dynamic
	isVideo: true,
	// Stretching modes (auto, fill, responsive, none)
	stretching: 'auto',
	// Prefix class names on elements
	classPrefix: 'mejs__',
	// Turn keyboard support on and off for this instance
	enableKeyboard: true,
	// When this player starts, it will pause other players
	pauseOtherPlayers: true,
	// Array of keyboard actions such as play/pause
	keyActions: [
		{
			keys: [
				32, // SPACE
				179 // GOOGLE play/pause button
			],
			action: (player, media) => {

				if (!IS_FIREFOX) {
					if (media.paused || media.ended) {
						media.play();
					} else {
						media.pause();
					}
				}
			}
		},
		{
			keys: [38], // UP
			action: (player, media) => {

				if (player.container.querySelector(`.${config.classPrefix}volume-button>button`).matches(':focus') ||
					player.container.querySelector(`.${config.classPrefix}volume-slider`).matches(':focus')) {
					player.container.querySelector(`.${config.classPrefix}volume-slider`).style.display = 'block';
				}
				if (player.isVideo) {
					player.showControls();
					player.startControlsTimer();
				}

				const newVolume = Math.min(media.volume + 0.1, 1);
				media.setVolume(newVolume);
				if (newVolume > 0) {
					media.setMuted(false);
				}

			}
		},
		{
			keys: [40], // DOWN
			action: (player, media) => {

				if (player.container.querySelector(`.${config.classPrefix}volume-button>button`).matches(':focus') ||
					player.container.querySelector(`.${config.classPrefix}volume-slider`).matches(':focus')) {
					player.container.querySelector(`.${config.classPrefix}volume-slider`).style.display = 'block';
				}

				if (player.isVideo) {
					player.showControls();
					player.startControlsTimer();
				}

				const newVolume = Math.max(media.volume - 0.1, 0);
				media.setVolume(newVolume);

				if (newVolume <= 0.1) {
					media.setMuted(true);
				}

			}
		},
		{
			keys: [
				37, // LEFT
				227 // Google TV rewind
			],
			action: (player, media) => {
				if (!isNaN(media.duration) && media.duration > 0) {
					if (player.isVideo) {
						player.showControls();
						player.startControlsTimer();
					}

					// 5%
					const newTime = Math.max(media.currentTime - player.options.defaultSeekBackwardInterval(media), 0);
					media.setCurrentTime(newTime);
				}
			}
		},
		{
			keys: [
				39, // RIGHT
				228 // Google TV forward
			],
			action: (player, media) => {

				if (!isNaN(media.duration) && media.duration > 0) {
					if (player.isVideo) {
						player.showControls();
						player.startControlsTimer();
					}

					// 5%
					const newTime = Math.min(media.currentTime + player.options.defaultSeekForwardInterval(media), media.duration);
					media.setCurrentTime(newTime);
				}
			}
		},
		{
			keys: [70], // F
			action: (player, media, key, event) => {
				if (!event.ctrlKey) {
					if (typeof player.enterFullScreen !== 'undefined') {
						if (player.isFullScreen) {
							player.exitFullScreen();
						} else {
							player.enterFullScreen();
						}
					}
				}
			}
		},
		{
			keys: [77], // M
			action: (player) => {

				player.container.querySelector(`.${config.classPrefix}volume-slider`).style.display = 'block';
				if (player.isVideo) {
					player.showControls();
					player.startControlsTimer();
				}
				if (player.media.muted) {
					player.setMuted(false);
				} else {
					player.setMuted(true);
				}
			}
		}
	]
};

mejs.MepDefaults = config;

/**
 * Wrap a MediaElement object in player controls
 *
 * @constructor
 * @param {HTMLElement|String} node
 * @param {Object} o
 * @return {?MediaElementPlayer}
 */
class MediaElementPlayer {

	constructor (node, o) {

		const
			t = this,
			element = typeof node === 'string' ? document.getElementById(node) : node
		;

		t.hasFocus = false;

		t.controlsAreVisible = true;

		t.controlsEnabled = true;

		t.controlsTimer = null;

		// enforce object, even without "new" (via John Resig)
		if (!(t instanceof MediaElementPlayer)) {
			return new MediaElementPlayer(element, o);
		}

		// these will be reset after the MediaElement.success fires
		// t.media will be the fake node to emulate all HTML5 events, methods, etc
		// t.node will be the node to be restored
		t.node = t.media = element;

		if (!t.node) {
			return;
		}

		// check for existing player
		if (t.media.player !== undefined) {
			return t.media.player;
		}


		// try to get options from data-mejsoptions
		if (o === undefined) {
			o = t.node.getAttribute('data-mejsoptions');
		}

		// extend default options
		t.options = Object.assign({}, config, o);

		if (!t.options.timeFormat) {
			// Generate the time format according to options
			t.options.timeFormat = 'mm:ss';
			if (t.options.alwaysShowHours) {
				t.options.timeFormat = 'hh:mm:ss';
			}
			if (t.options.showTimecodeFrameCount) {
				t.options.timeFormat += ':ff';
			}
		}

		calculateTimeFormat(0, t.options, t.options.framesPerSecond || 25);

		// unique ID
		t.id = `mep_${mejs.mepIndex++}`;

		// add to player array (for focus events)
		mejs.players[t.id] = t;

		// start up
		const

			meOptions = Object.assign({}, t.options, {
				success: (media, domNode) => {
					t._meReady(media, domNode);
				},
				error: (e) => {
					t._handleError(e);
				}
			}),
			tagName = t.node.tagName.toLowerCase()
		;

		// get video from src or href?
		t.isDynamic = (tagName !== 'audio' && tagName !== 'video');
		t.isVideo = (t.isDynamic) ? t.options.isVideo : (tagName !== 'audio' && t.options.isVideo);

		// use native controls in iPad, iPhone, and Android
		if ((IS_IPAD && t.options.iPadUseNativeControls) || (IS_IPHONE && t.options.iPhoneUseNativeControls)) {

			// add controls and stop
			t.node.setAttribute('controls', true);

			// override Apple's autoplay override for iPads
			if (IS_IPAD && t.node.getAttribute('autoplay')) {
				t.play();
			}

		} else if ((t.isVideo || (!t.isVideo && t.options.features.length)) && !(IS_ANDROID && t.options.AndroidUseNativeControls)) {

			// DESKTOP: use MediaElementPlayer controls

			// remove native controls
			t.node.removeAttribute('controls');
			const videoPlayerTitle = t.isVideo ? i18n.t('mejs.video-player') : i18n.t('mejs.audio-player');
			// insert description for screen readers
			const offscreen = document.createElement('span');
			offscreen.className = `${t.options.classPrefix}offscreen`;
			offscreen.innerText = videoPlayerTitle;
			t.media.parentNode.insertBefore(offscreen, t.media);

			// build container
			t.container = document.createElement('div');
			t.container.id = t.id;
			t.container.className = `${t.options.classPrefix}container ${t.options.classPrefix}container-keyboard-inactive ${t.media.className}`;
			t.container.tabIndex = 0;
			t.container.setAttribute('role', 'application');
			t.container.setAttribute('aria-label', videoPlayerTitle);
			t.container.innerHTML = `<div class="${t.options.classPrefix}inner">` +
				`<div class="${t.options.classPrefix}layers"></div>` +
				`<div class="${t.options.classPrefix}controls"></div>` +
				`<div class="${t.options.classPrefix}mediaelement"></div>` +
				`<div class="${t.options.classPrefix}clear"></div>` +
			`</div>`;
			t.container.addEventListener('focus', (e) => {
				if (!t.controlsAreVisible && !t.hasFocus && t.controlsEnabled) {
					t.showControls(true);
					// In versions older than IE11, the focus causes the playbar to be displayed
					// if user clicks on the Play/Pause button in the control bar once it attempts
					// to hide it
					if (!HAS_MS_NATIVE_FULLSCREEN) {
						// If e.relatedTarget appears before container, send focus to play button,
						// else send focus to last control button.
						const
							btnSelector = isNodeAfter(e.relatedTarget, t.container) ?
								`.${t.options.classPrefix}controls .${t.options.classPrefix}button:last-child > button` :
								`.${t.options.classPrefix}playpause-button > button`,
							button = t.container.querySelector(btnSelector)
						;

						button.focus();
					}
				}
			}, false);
			t.node.parentNode.insertBefore(t.container, t.node);

			// When no elements in controls, hide bar completely
			if (!t.options.features.length) {
				t.container.style.background = 'transparent';
				t.container.querySelector(`.${t.options.classPrefix}controls`).style.display = 'none';
			}

			if (t.isVideo && t.options.stretching === 'fill' && !dom.hasClass(t.container.parentNode, `.${t.options.classPrefix}fill-container`)) {
				// outer container
				t.outerContainer = t.media.parentNode;

				const wrapper = document.createElement('div');
				wrapper.className = `${t.options.classPrefix}fill-container`;
				t.container.parentNode.insertBefore(wrapper, t.container);
				wrapper.appendChild(t.container);
			}

			// add classes for user and content
			const mediaClasses = (
				(IS_ANDROID ? `${t.options.classPrefix}android ` : '') +
				(IS_IOS ? `${t.options.classPrefix}ios ` : '') +
				(IS_IPAD ? `${t.options.classPrefix}ipad ` : '') +
				(IS_IPHONE ? `${t.options.classPrefix}iphone ` : '') +
				(t.isVideo ? `${t.options.classPrefix}video` : `${t.options.classPrefix}audio`)
			);

			dom.addClass(t.container, mediaClasses);
			// move the <video/video> tag into the right spot
			t.container.querySelector(`.${t.options.classPrefix}mediaelement`).appendChild(t.node);

			// needs to be assigned here, after iOS remap
			t.media.player = t;

			// find parts
			t.controls = t.container.querySelector(`.${t.options.classPrefix}controls`);
			t.layers = t.container.querySelector(`.${t.options.classPrefix}layers`);

			// determine the size

			/* size priority:
			 (1) videoWidth (forced),
			 (2) style="width;height;"
			 (3) width attribute,
			 (4) defaultVideoWidth (for unspecified cases)
			 */

			const
				tagType = (t.isVideo ? 'video' : 'audio'),
				capsTagName = tagType.substring(0, 1).toUpperCase() + tagType.substring(1)
			;


			if (t.options[tagType + 'Width'] > 0 || t.options[tagType + 'Width'].toString().indexOf('%') > -1) {
				t.width = t.options[tagType + 'Width'];
			} else if (t.node.style.width !== '' && t.node.style.width !== null) {
				t.width = t.node.style.width;
			} else if (t.node.getAttribute('width')) {
				t.width = t.node.getAttribute('width');
			} else {
				t.width = t.options['default' + capsTagName + 'Width'];
			}

			if (t.options[tagType + 'Height'] > 0 || t.options[tagType + 'Height'].toString().indexOf('%') > -1) {
				t.height = t.options[tagType + 'Height'];
			} else if (t.node.style.height !== '' && t.node.style.height !== null) {
				t.height = t.node.style.height;
			} else if (t.node.getAttribute('height')) {
				t.height = t.node.getAttribute('height');
			} else {
				t.height = t.options['default' + capsTagName + 'Height'];
			}

			t.initialAspectRatio = (t.height >= t.width) ? t.width / t.height : t.height / t.width;

			// set the size, while we wait for the plugins to load below
			t.setPlayerSize(t.width, t.height);

			// create MediaElementShim
			meOptions.pluginWidth = t.width;
			meOptions.pluginHeight = t.height;
		}
		// Hide media completely for audio that doesn't have any features
		else if (!t.isVideo && !t.options.features.length) {
			t.node.style.display = 'none';
		}

		// create MediaElement shim
		new MediaElement(t.media, meOptions);

		if (t.container !== undefined && t.options.features.length && t.controlsAreVisible && !t.options.hideVideoControlsOnLoad) {
			// controls are shown when loaded
			const event = createEvent('controlsshown', t.container);
			t.container.dispatchEvent(event);
		}

		return t;
	}

	showControls (doAnimation) {
		const t = this;

		doAnimation = doAnimation === undefined || doAnimation;

		if (t.controlsAreVisible) {
			return;
		}

		if (doAnimation) {
			dom.removeClass(t.controls, `${t.options.classPrefix}offscreen`);
			dom.fadeIn(t.controls, 200, () => {
				const event = createEvent('controlsshown', t.container);
				t.container.dispatchEvent(event);
			});

			// any additional controls people might add and want to hide
			const controls = t.container.querySelectorAll(`.${t.options.classPrefix}control`);
			for (let i = 0, total = controls.length; i < total; i++) {
				dom.fadeIn(controls[i], 200, () => {
					dom.removeClass(controls[i], `${t.options.classPrefix}offscreen`);
				});
			}
		} else {
			dom.removeClass(t.controls, `${t.options.classPrefix}offscreen`);
			t.controls.style.display = 'block';

			// any additional controls people might add and want to hide
			const controls = t.container.querySelectorAll(`.${t.options.classPrefix}control`);
			for (let i = 0, total = controls.length; i < total; i++) {
				dom.removeClass(controls[i], `${t.options.classPrefix}offscreen`);
				controls[i].style.display = 'block';
			}

			const event = createEvent('controlsshown', t.container);
			t.container.dispatchEvent(event);
		}

		t.controlsAreVisible = true;
		t.setControlsSize();

	}

	hideControls (doAnimation) {
		const t = this;

		doAnimation = doAnimation === undefined || doAnimation;

		if (!t.controlsAreVisible || t.options.alwaysShowControls || t.keyboardAction ||
			(t.media.paused && t.media.readyState === 4 && ((!t.options.hideVideoControlsOnLoad &&
			t.media.currentTime <= 0) || (!t.options.hideVideoControlsOnPause && t.media.currentTime > 0))) ||
			(t.isVideo && !t.options.hideVideoControlsOnLoad && !t.media.readyState) ||
			t.media.ended) {
			return;
		}

		if (doAnimation) {
			// fade out main controls
			dom.fadeOut(t.controls, 200, () => {
				dom.addClass(t.controls, `${t.options.classPrefix}offscreen`);
				t.controls.style.display = 'block';
				const event = createEvent('controlshidden', t.container);
				t.container.dispatchEvent(event);
			});

			// any additional controls people might add and want to hide
			const controls = t.container.querySelectorAll(`.${t.options.classPrefix}control`);
			for (let i = 0, total = controls.length; i < total; i++) {
				dom.fadeOut(controls[i], 200, () => {
					dom.addClass(controls[i], `${t.options.classPrefix}offscreen`);
					controls[i].style.display = 'block';
				});
			}
		} else {

			// hide main controls
			dom.addClass(t.controls, `${t.options.classPrefix}offscreen`);
			t.controls.style.display = 'block';

			// hide others
			const controls = t.container.querySelectorAll(`.${t.options.classPrefix}control`);
			for (let i = 0, total = controls.length; i < total; i++) {
				dom.addClass(controls[i], `${t.options.classPrefix}offscreen`);
				controls[i].style.display = 'block';
			}

			const event = createEvent('controlshidden', t.container);
			t.container.dispatchEvent(event);
		}

		t.controlsAreVisible = false;
	}

	startControlsTimer (timeout) {

		const t = this;

		timeout = typeof timeout !== 'undefined' ? timeout : t.options.controlsTimeoutDefault;

		t.killControlsTimer('start');

		t.controlsTimer = setTimeout(() => {
			t.hideControls();
			t.killControlsTimer('hide');
		}, timeout);
	}

	killControlsTimer () {

		const t = this;

		if (t.controlsTimer !== null) {
			clearTimeout(t.controlsTimer);
			delete t.controlsTimer;
			t.controlsTimer = null;
		}
	}

	disableControls () {
		const t = this;

		t.killControlsTimer();
		t.hideControls(false);
		t.controlsEnabled = false;
	}

	enableControls () {
		const t = this;

		t.showControls(false);
		t.controlsEnabled = true;
	}

	/**
	 * Set up all controls and events
	 *
	 * @param media
	 * @param domNode
	 * @private
	 */
	_meReady (media, domNode) {

		const
			t = this,
			autoplayAttr = domNode.getAttribute('autoplay'),
			autoplay = !(autoplayAttr === undefined || autoplayAttr === null || autoplayAttr === 'false'),
			isNative = media.rendererName !== null && media.rendererName.match(/(native|html5)/) !== null
		;

		// make sure it can't create itself again if a plugin reloads
		if (t.created) {
			return;
		}

		t.created = true;
		t.media = media;
		t.domNode = domNode;

		if (!(IS_ANDROID && t.options.AndroidUseNativeControls) && !(IS_IPAD && t.options.iPadUseNativeControls) && !(IS_IPHONE && t.options.iPhoneUseNativeControls)) {

			// In the event that no features are specified for audio,
			// create only MediaElement instance rather than
			// doing all the work to create a full player
			if (!t.isVideo && !t.options.features.length) {

				// force autoplay for HTML5
				if (autoplay && isNative) {
					t.play();
				}


				if (t.options.success) {

					if (typeof t.options.success === 'string') {
						window[t.options.success](t.media, t.domNode, t);
					} else {
						t.options.success(t.media, t.domNode, t);
					}
				}

				return;
			}

			// two built in features
			t.buildposter(t, t.controls, t.layers, t.media);
			t.buildkeyboard(t, t.controls, t.layers, t.media);
			t.buildoverlays(t, t.controls, t.layers, t.media);

			// grab for use by features
			//t.findTracks();

			// cache container to store control elements' original position
			t.featurePosition = {};

			// add user-defined features/controls
			for (let i = 0, il = t.options.features.length; i < il; i++) {
				const feature = t.options.features[i];
				if (t[`build${feature}`]) {
					try {
						t[`build${feature}`](t, t.controls, t.layers, t.media);
					} catch (e) {
						// TODO: report control error
						console.error(`error building ${feature}`, e);
					}
				}
			}

			const event = createEvent('controlsready', t.container);
			t.container.dispatchEvent(event);

			// controls fade
			if (t.isVideo) {

				if ((IS_ANDROID || IS_IOS) && !t.options.alwaysShowControls) {

					// for touch devices (iOS, Android)
					// show/hide without animation on touch

					t.node.addEventListener('touchstart', () => {

						// toggle controls
						if (t.controlsAreVisible) {
							t.hideControls(false);
						} else {
							if (t.controlsEnabled) {
								t.showControls(false);
							}
						}
					}, false);

				} else {

					t.createIframeLayer();

					// create callback here since it needs access to current
					// MediaElement object
					t.clickToPlayPauseCallback = () => {

						if (t.options.clickToPlayPause) {
							const
								button = t.container
									.querySelector(`.${t.options.classPrefix}overlay-button`),
								pressed = button.getAttribute('aria-pressed')
							;

							if (t.media.paused && pressed) {
								t.pause();
							} else if (t.media.paused) {
								t.play();
							} else {
								t.pause();
							}

							button.setAttribute('aria-pressed', !(pressed));
						}
					};

					// click to play/pause
					t.media.addEventListener('click', t.clickToPlayPauseCallback, false);

					// show/hide controls
					t.container.addEventListener('mouseenter', () => {
						if (t.controlsEnabled) {
							if (!t.options.alwaysShowControls) {
								t.killControlsTimer('enter');
								t.showControls();
								t.startControlsTimer(t.options.controlsTimeoutMouseEnter);
							}
						}
					}, false);
					t.container.addEventListener('mousemove', () => {
						if (t.controlsEnabled) {
							if (!t.controlsAreVisible) {
								t.showControls();
							}
							if (!t.options.alwaysShowControls) {
								t.startControlsTimer(t.options.controlsTimeoutMouseEnter);
							}
						}
					}, false);
					t.container.addEventListener('mouseleave', () => {
						if (t.controlsEnabled) {
							if (!t.media.paused && !t.options.alwaysShowControls) {
								t.startControlsTimer(t.options.controlsTimeoutMouseLeave);
							}
						}
					}, false);
				}

				if (t.options.hideVideoControlsOnLoad) {
					t.hideControls(false);
				}

				// check for autoplay
				if (autoplay && !t.options.alwaysShowControls) {
					t.hideControls();
				}

				// resizer
				if (t.options.enableAutosize) {
					t.media.addEventListener('loadedmetadata', (e) => {
						// if the <video height> was not set and the options.videoHeight was not set
						// then resize to the real dimensions
						if (t.options.videoHeight <= 0 && !t.domNode.getAttribute('height') &&
							e.target !== null && !isNaN(e.target.videoHeight)) {
							t.setPlayerSize(e.target.videoWidth, e.target.videoHeight);
							t.setControlsSize();
							t.media.setSize(e.target.videoWidth, e.target.videoHeight);
						}
					}, false);
				}
			}

			// EVENTS

			// FOCUS: when a video starts playing, it takes focus from other players (possibly pausing them)
			t.media.addEventListener('play', () => {
				t.hasFocus = true;

				// go through all other players
				for (const playerIndex in mejs.players) {
					if (mejs.players.hasOwnProperty(playerIndex)) {
						const p = mejs.players[playerIndex];

						if (p.id !== t.id && t.options.pauseOtherPlayers && !p.paused && !p.ended) {
							p.pause();
							p.hasFocus = false;
						}
					}
				}

			}, false);

			// ended for all
			t.media.addEventListener('ended', () => {
				if (t.options.autoRewind) {
					try {
						t.media.setCurrentTime(0);
						// Fixing an Android stock browser bug, where "seeked" isn't fired correctly after
						// ending the video and jumping to the beginning
						setTimeout(() => {
							t.container.querySelector(`.${t.options.classPrefix}overlay-loading`)
								.parentNode.style.display = 'none';
						}, 20);
					} catch (exp) {
						console.log(exp);
					}
				}

				if (typeof t.media.stop === 'function') {
					t.media.stop();
				} else {
					t.media.pause();
				}

				if (t.setProgressRail) {
					t.setProgressRail();
				}
				if (t.setCurrentRail) {
					t.setCurrentRail();
				}

				if (t.options.loop) {
					t.play();
				} else if (!t.options.alwaysShowControls && t.controlsEnabled) {
					t.showControls();
				}
			}, false);

			// resize on the first play
			t.media.addEventListener('loadedmetadata', () => {

				calculateTimeFormat(t.duration, t.options, t.options.framesPerSecond || 25);

				if (t.updateDuration) {
					t.updateDuration();
				}
				if (t.updateCurrent) {
					t.updateCurrent();
				}

				if (!t.isFullScreen) {
					t.setPlayerSize(t.width, t.height);
					t.setControlsSize();
				}
			}, false);

			// Only change the time format when necessary
			let duration = null;
			t.media.addEventListener('timeupdate', () => {
				if (duration !== t.media.duration) {
					duration = t.media.duration;
					calculateTimeFormat(duration, t.options, t.options.framesPerSecond || 25);

					// make sure to fill in and resize the controls (e.g., 00:00 => 01:13:15
					if (t.updateDuration) {
						t.updateDuration();
					}
					if (t.updateCurrent) {
						t.updateCurrent();
					}
					t.setControlsSize();
				}
			}, false);

			t.container.addEventListener('focusout', debounce(() => {
				setTimeout(() => {
					// Safari triggers focusout multiple times
					// Firefox does NOT support e.relatedTarget to see which element
					// just lost focus, so wait to find the next focused element

					const parent = dom.closest(document.activeElement, (el) => {
						return el == t.container;
					});
					if (t.keyboardAction && !parent.length) {
						t.keyboardAction = false;
						if (t.isVideo && !t.options.alwaysShowControls) {
							// focus is outside the control; hide controls
							t.hideControls(true);
						}
					}
				}, 0);
			}, 100));

			// reset all layers and controls
			t.setPlayerSize(t.width, t.height);
			t.setControlsSize();

			// adjust controls whenever window sizes (used to be in fullscreen only)
			t.globalBind('resize', () => {

				// don't resize for fullscreen mode
				if (!(t.isFullScreen || (HAS_TRUE_NATIVE_FULLSCREEN && document.webkitIsFullScreen))) {
					t.setPlayerSize(t.width, t.height);
				}

				// always adjust controls
				t.setControlsSize();
			});

			// Disable focus outline to improve look-and-feel for regular users
			t.globalBind('click', (e) => {
				if (e.target.matches(`.${t.options.classPrefix}container`)) {
					dom.addClass(e.target, `${t.options.classPrefix}container-keyboard-inactive`);
				} else if (e.target.closest(`.${t.options.classPrefix}container`).length) {
					dom.addClass(e.target.closest(`.${t.options.classPrefix}container`), `${t.options.classPrefix}container-keyboard-inactive`);
				}
			});

			// Enable focus outline for Accessibility purposes
			t.globalBind('keydown', (e) => {
				if (e.target.matches(`.${t.options.classPrefix}container`)) {
					dom.removeClass(e.target, `${t.options.classPrefix}container-keyboard-inactive`);
				} else if (e.target.closest(`.${t.options.classPrefix}container`).length) {
					dom.removeClass(e.target.closest(`.${t.options.classPrefix}container`), `${t.options.classPrefix}container-keyboard-inactive`);
				}
			});
		}

		// force autoplay for HTML5
		if (autoplay && isNative) {
			t.play();
		}

		if (t.options.success) {

			if (typeof t.options.success === 'string') {
				window[t.options.success](t.media, t.domNode, t);
			} else {
				t.options.success(t.media, t.domNode, t);
			}
		}
	}

	/**
	 *
	 * @param {Event} e
	 * @private
	 */
	_handleError (e) {
		const t = this;

		if (t.controls) {
			t.disableControls();
		}

		// Tell user that the file cannot be played
		if (t.options.error) {
			t.options.error(e);
		}
	}

	setPlayerSize (width, height) {
		const t = this;

		if (!t.options.setDimensions) {
			return false;
		}

		if (typeof width !== 'undefined') {
			t.width = width;
		}

		if (typeof height !== 'undefined') {
			t.height = height;
		}

		// @todo: Rewrite this
		if (typeof FB !== 'undefined' && t.isVideo) {
			FB.Event.subscribe('xfbml.ready', () => {
				const target = t.media.children('.fb-video');

				t.width = target.width();
				t.height = target.height();
				t.setDimensions(t.width, t.height);
				return false;
			});

			const target = $(t.media).children('.fb-video');

			if (target.length) {
				t.width = target.width();
				t.height = target.height();
			}
		}

		// check stretching modes
		switch (t.options.stretching) {
			case 'fill':
				// The 'fill' effect only makes sense on video; for audio we will set the dimensions
				if (t.isVideo) {
					t.setFillMode();
				} else {
					t.setDimensions(t.width, t.height);
				}
				break;
			case 'responsive':
				t.setResponsiveMode();
				break;
			case 'none':
				t.setDimensions(t.width, t.height);
				break;
			// This is the 'auto' mode
			default:
				if (t.hasFluidMode() === true) {
					t.setResponsiveMode();
				} else {
					t.setDimensions(t.width, t.height);
				}
				break;
		}
	}

	hasFluidMode () {
		const t = this;

		console.log(t.node);

		// detect 100% mode - use currentStyle for IE since css() doesn't return percentages
		return (t.height.toString().includes('%') || (t.node.style.maxWidth !== 'none' && t.node.style.maxWidth !== t.width) ||
			(t.node.currentStyle && t.node.currentStyle.maxWidth === '100%'));
	}

	setResponsiveMode () {
		const
			t = this,
			parent = dom.closest(t.container, (el) => {
				return el !== t.container && dom.visible(el);
			}),
			parentStyles = getComputedStyle(parent, null),
			nativeWidth = (() => {
				if (t.isVideo) {
					if (t.media.videoWidth && t.media.videoWidth > 0) {
						return t.media.videoWidth;
					} else if (t.node.getAttribute('width')) {
						return t.node.getAttribute('width');
					} else {
						return t.options.defaultVideoWidth;
					}
				} else {
					return t.options.defaultAudioWidth;
				}
			})(),
			nativeHeight = (() => {
				if (t.isVideo) {
					if (t.media.videoHeight && t.media.videoHeight > 0) {
						return t.media.videoHeight;
					} else if (t.node.getAttribute('height')) {
						return t.node.getAttribute('height');
					} else {
						return t.options.defaultVideoHeight;
					}
				} else {
					return t.options.defaultAudioHeight;
				}
			})(),
			aspectRatio = (() => {
				let ratio = 1;
				if (!t.isVideo) {
					return ratio;
				}

				if (t.media.videoWidth && t.media.videoWidth > 0 && t.media.videoHeight && t.media.videoHeight > 0) {
					ratio = (t.height >= t.width) ? t.media.videoWidth / t.media.videoHeight :
						t.media.videoHeight / t.media.videoWidth;
				} else {
					ratio = t.initialAspectRatio;
				}

				if (isNaN(ratio) || ratio < 0.01 || ratio > 100) {
					ratio = 1;
				}

				return ratio;
			})(),
			parentHeight = parseInt(parentStyles.height)
		;

		let
			newHeight,
			parentWidth = parseInt(parentStyles.width)
		;

		if (t.isVideo) {
			// Responsive video is based on width: 100% and height: 100%
			if (t.height === '100%') {
				newHeight = parseInt(parentWidth * nativeHeight / nativeWidth, 10);
			} else {
				newHeight = t.height >= t.width ? parseInt(parentWidth / aspectRatio, 10) : parseInt(parentWidth * aspectRatio, 10);
			}
		} else {
			newHeight = nativeHeight;
		}

		// If we were unable to compute newHeight, get the container height instead
		if (isNaN(newHeight)) {
			newHeight = parentHeight;
		}

		if (t.container.parentNode.length > 0 && t.container.parentNode.tagName.toLowerCase() === 'body') {
			parentWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
			newHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
		}

		if (newHeight && parentWidth) {

			// set outer container size
			t.container.style.width = `${parentWidth}px`;
			t.container.style.height = `${newHeight}px`;

			// set native <video> or <audio> and shims
			t.node.style.width = '100%';
			t.node.style.height = '100%';

			// if shim is ready, send the size to the embedded plugin
			if (t.isVideo && t.media.setSize) {
				t.media.setSize(parentWidth, newHeight);
			}

			// set the layers
			const layerChildren = t.layers.childNodes;
			for (let i = 0, total = layerChildren.length; i < total; i++) {
				layerChildren[i].style.width = '100%';
				layerChildren[i].style.height = '100%';
			}
		}
	}

	setFillMode () {
		const
			t = this,
			parent = t.outerContainer
		;

		let parentStyles = getComputedStyle(parent, null);

		// Remove the responsive attributes in the event they are there
		if (t.node.style.height !== 'none' && t.node.style.height !== t.height) {
			t.node.style.height = '';
		}
		if (t.node.style.maxWidth !== 'none' && t.node.style.maxWidth !== t.width) {
			t.node.style.maxWidth = '';
		}

		if (t.node.style.maxHeight !== 'none' && t.node.style.maxHeight !== t.height) {
			t.node.style.maxHeight = '';
		}

		if (t.node.currentStyle) {
			if (t.node.currentStyle.height === '100%') {
				t.node.currentStyle.height = '';
			}
			if (t.node.currentStyle.maxWidth === '100%') {
				t.node.currentStyle.maxWidth = '';
			}
			if (t.node.currentStyle.maxHeight === '100%') {
				t.node.currentStyle.maxHeight = '';
			}
		}

		if (!parseInt(parentStyles.width)) {
			parent.style.width = `${t.media.offsetWidth}px`;
		}

		if (!parseInt(parentStyles.height)) {
			parent.style.height = `${t.media.offsetHeight}px`;
		}

		parentStyles = getComputedStyle(parent, null);

		const
			parentWidth = parseInt(parentStyles.width),
			parentHeight = parseInt(parentStyles.height)
		;

		t.setDimensions('100%', '100%');

		// This prevents an issue when displaying poster
		const poster = t.container.querySelector(`${t.options.classPrefix}poster img`);
		if (poster) {
			poster.style.display = 'block';
		}

		// calculate new width and height
		const
			targetElement = t.container.querySelectorAll('object, embed, iframe, video'),
			initHeight = t.height,
			initWidth = t.width,
			// scale to the target width
			scaleX1 = parentWidth,
			scaleY1 = (initHeight * parentWidth) / initWidth,
			// scale to the target height
			scaleX2 = (initWidth * parentHeight) / initHeight,
			scaleY2 = parentHeight,
			// now figure out which one we should use
			bScaleOnWidth = scaleX2 > parentWidth === false,
			finalWidth = bScaleOnWidth ? Math.floor(scaleX1) : Math.floor(scaleX2),
			finalHeight = bScaleOnWidth ? Math.floor(scaleY1) : Math.floor(scaleY2),
			width = bScaleOnWidth ? `${parentWidth}px` : `${finalWidth}px`,
			height = bScaleOnWidth ? `${finalHeight}px` : `${parentHeight}px`
			;

		for (let i = 0, total = targetElement.length; i < total; i++) {
			targetElement[i].style.height = height;
			targetElement[i].style.width = width;
			if (t.media.setSize) {
				t.media.setSize(width, height);
			}

			targetElement[i].style.marginLeft = `${Math.floor((parentWidth - finalWidth) / 2)}px`;
			targetElement[i].style.marginTop = 0;
		}
	}

	setDimensions (width, height) {
		const t = this;

		width = typeof width === 'string' ? width : `${parseInt(width)}px`;
		height = typeof height === 'string' ? height : `${parseInt(height)}px`;

		t.container.style.width = width;
		t.container.style.height = height;

		const layers = t.layers.childNodes;
		for (let i = 0, total = layers.length; i < total; i++) {
			layers[i].style.width = width;
			layers[i].style.height = height;
		}
	}

	setControlsSize () {
		const t = this;

		// skip calculation if hidden
		if (!dom.visible(t.container) || !t.rail || !t.rail.length || !dom.visible(t.rail)) {
			return;
		}

		const
			railMargin = parseFloat(t.rail.style.marginLeft) + parseFloat(t.rail.style.marginRight),
			totalMargin = parseFloat(t.total.style.marginLeft) + parseFloat(t.total.style.marginRight) || 0
			;

		let siblingsWidth = 0;

		const siblings = dom.siblings(t.rail), total = siblings.length;
		for (let i = 0; i < total; i++) {
			if (dom.visible(siblings[i])) {
				siblingsWidth += parseFloat(siblings[i].offsetWidth);
			}
		}

		siblingsWidth += totalMargin + railMargin + 1;

		// Substract the width of the feature siblings from time rail
		t.rail.width = `${(t.controls.width - siblingsWidth)}px`;

		const event = createEvent('controlsresize', t.container);
		t.container.dispatchEvent(event);
	}

	/**
	 * Add featured control element and cache its position in case features are reset
	 *
	 * @param {HTMLElement} element
	 * @param {String} key
	 */
	addControlElement (element, key) {

		const t = this;

		if (t.featurePosition[key] !== undefined) {
			const children = t.controls.querySelector(`:eq(${(t.featurePosition[key] - 1)})`);
			children.parentNode.insertAfter(element, children.nextSibling);
		} else {
			t.controls.appendChild(element);
			const children = t.controls.childNodes;
			for (let i = 0, total = children.length; i < total; i++) {
				if (element == children[i]) {
					t.featurePosition[key] = i;
					break;
				}
			}
		}
	}

	/**
	 * Append layer to manipulate `<iframe>` elements safely.
	 *
	 * This allows the user to trigger events properly given that mouse/click don't get lost in the `<iframe>`.
	 */
	createIframeLayer () {

		const t = this;

		if (t.isVideo && t.media.rendererName !== null && t.media.rendererName.match(/iframe/i) !== null && !t.container.getElementById(`${t.media.id}-iframe-overlay`).length) {

			const
				layer = document.createElement('div'),
				target = document.getElementById(`${t.media.id}_${t.media.rendererName}`)
				;

			layer.id = `${t.media.id}-iframe-overlay`;
			layer.className = `${t.options.classPrefix}iframe-overlay`;
			layer.addEventListener('click', (e) => {
				if (t.options.clickToPlayPause) {
					if (t.media.paused) {
						t.media.play();
					} else {
						t.media.pause();
					}

					e.preventDefault();
					e.stopPropagation();
				}
			}, false);

			target.parentNode.insertBefore(layer, target);
		}
	}

	resetSize () {
		const t = this;
		// webkit has trouble doing this without a delay
		setTimeout(() => {
			t.setPlayerSize(t.width, t.height);
			t.setControlsSize();
		}, 50);
	}

	setPoster (url) {
		const
			t = this,
			posterDiv = t.container.querySelector(`.${t.options.classPrefix}poster`)
			;

		let posterImg = posterDiv.querySelector('img');

		if (posterImg.length === 0) {
			posterImg = document.createElement('img');
			posterImg.className = `${t.options.classPrefix}poster-img`;
			posterImg.width = '100%';
			posterImg.height = '100%';
			posterDiv.appendChild(posterImg);
		}

		posterImg.setAttribute('src', url);
		posterDiv.style.backgroundImage = `url("${url}")`;
	}

	changeSkin (className) {
		const t = this;

		t.container.className = `${t.options.classPrefix}container ${className}`;
		t.setPlayerSize(t.width, t.height);
		t.setControlsSize();
	}

	globalBind (events, callback) {
		const
			t = this,
			doc = t.node ? t.node.ownerDocument : document
			;

		events = splitEvents(events, t.id);
		if (events.d) {
			const eventList = events.d.split(' ');
			for (let i = 0, total = eventList.length; i < total; i++) {
				eventList[i].split('.').reduce(function (part, e) {
					e = e ? `${e}.${part}` : part;
					doc.addEventListener(e, callback, true);
					return e;
				}, '');
			}
		}
		if (events.w) {
			const eventList = events.w.split(' ');
			for (let i = 0, total = eventList.length; i < total; i++) {
				eventList[i].split('.').reduce(function (part, e) {
					window.addEventListener(e, callback, true);
					return e;
				}, '');
			}
		}
	}

	globalUnbind (events, callback) {

		const
			t = this,
			doc = t.node ? t.node.ownerDocument : document
			;

		events = splitEvents(events, t.id);
		if (events.d) {
			const eventList = events.d.split(' ');
			for (let i = 0, total = eventList.length; i < total; i++) {
				eventList[i].split('.').reduce(function (part, e) {
					e = e ? `${e}.${part}` : part;
					doc.removeEventListener(e, callback, true);
					return e;
				}, '');
			}
		}
		if (events.w) {
			const eventList = events.d.split(' ');
			for (let i = 0, total = eventList.length; i < total; i++) {
				eventList[i].split('.').reduce(function (part, e) {
					window.removeEventListener(e, callback, true);
					return e;
				}, '');
			}
		}
	}

	buildposter (player, controls, layers, media) {

		const
			t = this,
			poster = document.createElement('div')
			;

		poster.className = `${t.options.classPrefix}poster ${t.options.classPrefix}layer`;
		layers.appendChild(poster);

		let posterUrl = player.media.getAttribute('poster');

		// priority goes to option (this is useful if you need to support iOS 3.x (iOS completely fails with poster)
		if (player.options.poster !== '') {
			posterUrl = player.options.poster;
		}

		// second, try the real poster
		if (posterUrl) {
			t.setPoster(posterUrl);
		} else {
			poster.style.display = 'none';
		}

		media.addEventListener('play', () => {
			poster.style.display = 'none';
		}, false);

		media.addEventListener('playing', () => {
			poster.style.display = 'none';
		}, false);

		if (player.options.showPosterWhenEnded && player.options.autoRewind) {
			media.addEventListener('ended', () => {
				poster.style.display = 'block';
			}, false);
		}

		media.addEventListener('error', () => {
			poster.style.display = 'none';
		}, false);

		if (player.options.showPosterWhenPaused) {
			media.addEventListener('pause', () => {
				// To avoid displaying the poster when video ended, since it
				// triggers a pause event as well
				if (!media.ended) {
					poster.style.display = 'block';
				}
			}, false);
		}
	}

	buildoverlays (player, controls, layers, media) {

		if (!player.isVideo) {
			return;
		}

		const
			t = this,
			loading = document.createElement('div'),
			error = document.createElement('div'),
			// this needs to come last so it's on top
			bigPlay = document.createElement('div')
			;

		loading.style.display = 'none'; // start out hidden
		loading.className = `${t.options.classPrefix}overlay ${t.options.classPrefix}layer`;
		loading.innerHTML = `<div class="${t.options.classPrefix}overlay-loading">` +
			`<span class="${t.options.classPrefix}overlay-loading-bg-img"></span>` +
			`</div>`;
		layers.appendChild(loading);

		error.style.display = 'none';
		error.className = `${t.options.classPrefix}overlay ${t.options.classPrefix}layer`;
		error.innerHTML = `<div class="${t.options.classPrefix}overlay-error"></div>`;
		layers.appendChild(error);

		bigPlay.className = `${t.options.classPrefix}overlay ${t.options.classPrefix}layer ${t.options.classPrefix}overlay-play`;
		bigPlay.innerHTML = `<div class="${t.options.classPrefix}overlay-button" role="button" tabindex="0"` +
			`aria-label="${i18n.t('mejs.play')}" aria-pressed="false"></div>`;
		bigPlay.addEventListener('click', () => {
			// Removed 'touchstart' due issues on Samsung Android devices where a tap on bigPlay
			// started and immediately stopped the video
			if (t.options.clickToPlayPause) {

				const
					button = t.media.closest(`.${t.options.classPrefix}container`)
					.querySelector(`.${t.options.classPrefix}overlay-button`),
					pressed = button.getAttribute('aria-pressed')
					;

				if (media.paused) {
					media.play();
				} else {
					media.pause();
				}

				button.setAttribute('aria-pressed', !!pressed);
			}
		}, false);
		layers.appendChild(bigPlay);

		if (t.media.rendererName !== null && ((t.media.rendererName.match(/(youtube|facebook)/) && !(player.media.attr('poster') || player.options.poster)) || IS_STOCK_ANDROID)) {
			bigPlay.style.display = 'none';
		}

		// show/hide big play button
		media.addEventListener('play', () => {
			bigPlay.style.display = 'none';
			loading.style.display = 'none';
			if (controls.getElementsByClassName(`${t.options.classPrefix}time-buffering`).length) {
				controls.getElementsByClassName(`${t.options.classPrefix}time-buffering`)[0].style.display = 'none';
			}
			error.style.display = 'none';
		}, false);

		media.addEventListener('playing', () => {
			bigPlay.style.display = 'none';
			loading.style.display = 'none';
			if (controls.getElementsByClassName(`${t.options.classPrefix}time-buffering`).length) {
				controls.getElementsByClassName(`${t.options.classPrefix}time-buffering`)[0].style.display = 'none';
			}
			error.style.display = 'none';
		}, false);

		media.addEventListener('seeking', () => {
			loading.style.display = 'block';
			if (controls.getElementsByClassName(`${t.options.classPrefix}time-buffering`).length) {
				controls.getElementsByClassName(`${t.options.classPrefix}time-buffering`)[0].style.display = 'block';
			}
		}, false);

		media.addEventListener('seeked', () => {
			loading.style.display = 'none';
			if (controls.getElementsByClassName(`${t.options.classPrefix}time-buffering`).length) {
				controls.getElementsByClassName(`${t.options.classPrefix}time-buffering`)[0].style.display = 'block';
			}
		}, false);

		media.addEventListener('pause', () => {
			if (!IS_STOCK_ANDROID) {
				bigPlay.style.display = 'block';
			}
		}, false);

		media.addEventListener('waiting', () => {
			loading.style.display = 'block';
			if (controls.getElementsByClassName(`${t.options.classPrefix}time-buffering`).length) {
				controls.getElementsByClassName(`${t.options.classPrefix}time-buffering`)[0].style.display = 'block';
			}
		}, false);


		// show/hide loading
		media.addEventListener('loadeddata', () => {
			loading.style.display = 'block';
			if (controls.getElementsByClassName(`${t.options.classPrefix}time-buffering`).length) {
				controls.getElementsByClassName(`${t.options.classPrefix}time-buffering`)[0].style.display = 'block';
			}

			// Firing the 'canplay' event after a timeout which isn't getting fired on some Android 4.1 devices
			// (https://github.com/johndyer/mediaelement/issues/1305)
			if (IS_ANDROID) {
				media.canplayTimeout = setTimeout(() => {
					if (document.createEvent) {
						const evt = document.createEvent('HTMLEvents');
						evt.initEvent('canplay', true, true);
						return media.dispatchEvent(evt);
					}
				}, 300);
			}
		}, false);
		media.addEventListener('canplay', () => {
			loading.style.display = 'none';
			if (controls.getElementsByClassName(`${t.options.classPrefix}time-buffering`).length) {
				controls.getElementsByClassName(`${t.options.classPrefix}time-buffering`)[0].style.display = 'none';
			}
			// Clear timeout inside 'loadeddata' to prevent 'canplay' from firing twice
			clearTimeout(media.canplayTimeout);
		}, false);

		// error handling
		media.addEventListener('error', (e) => {
			t._handleError(e);
			loading.style.display = 'none';
			bigPlay.style.display = 'none';
			error.style.display = 'block';
			error.getElementsByClassName(`${t.options.classPrefix}overlay-error`)[0].innerHTML = e.message;
		}, false);

		media.addEventListener('keydown', (e) => {
			t.onkeydown(player, media, e);
		}, false);
	}

	buildkeyboard (player, controls, layers, media) {

		const t = this;

		t.container.addEventListener('keydown', () => {
			t.keyboardAction = true;
		});

		// listen for key presses
		t.globalBind('keydown', (event) => {
			const
				container = dom.closest(event.target, (el) => {
					return el == t.container;
				}),
				target = dom.closest(player.media, (el) => {
					return el == t.container;
				})
				;
			player.hasFocus = container.length !== 0 && container.id === target.id;
			return t.onkeydown(player, media, event);
		});


		// check if someone clicked outside a player region, then kill its focus
		t.globalBind('click', (event) => {
			player.hasFocus = dom.closest(event.target, (el) => {
				return el == t.container;
			}).length;
		});

	}

	onkeydown (player, media, e) {

		if (player.hasFocus && player.options.enableKeyboard) {
			// find a matching key
			for (let i = 0, il = player.options.keyActions.length; i < il; i++) {
				const keyAction = player.options.keyActions[i];

				for (let j = 0, jl = keyAction.keys.length; j < jl; j++) {
					if (e.keyCode === keyAction.keys[j]) {
						keyAction.action(player, media, e.keyCode, e);
						return false;
					}
				}
			}
		}

		return true;
	}

	play () {
		const t = this;

		// only load if the current time is 0 to ensure proper playing
		if (t.media.getCurrentTime() <= 0) {
			t.load();
		}
		t.media.play();
	}

	pause () {
		try {
			this.media.pause();
		} catch (e) {
			console.log(e);
		}
	}

	load () {
		const t = this;

		if (!t.isLoaded) {
			t.media.load();
		}

		t.isLoaded = true;
	}

	setMuted (muted) {
		this.media.setMuted(muted);
	}

	setCurrentTime (time) {
		this.media.setCurrentTime(time);
	}

	getCurrentTime () {
		return this.media.currentTime;
	}

	setVolume (volume) {
		this.media.setVolume(volume);
	}

	getVolume () {
		return this.media.volume;
	}

	setSrc (src) {
		const
			t = this,
			layer = document.getElementById(`${t.media.id}-iframe-overlay`)
			;

		if (layer && layer.length) {
			layer.remove();
		}

		t.media.setSrc(src);

		t.createIframeLayer();
	}

	remove () {

		const
			t = this,
			rendererName = t.media.rendererName
		;

		// Stop completely media playing
		if (!t.media.paused) {
			t.media.pause();
		}

		const src = t.media.originalNode.getAttribute('src');
		t.media.setSrc('');

		// invoke features cleanup
		for (const featureIndex in t.options.features) {
			const feature = t.options.features[featureIndex];
			if (t[`clean${feature}`]) {
				try {
					t[`clean${feature}`](t);
				} catch (e) {
					// @todo: report control error
					console.error(`error cleaning ${feature}`, e);
				}
			}
		}

		// reset dimensions
		let
			nativeWidth = t.node.getAttribute('width'),
			nativeHeight = t.node.getAttribute('height')
		;
		if (nativeWidth) {
			if (nativeWidth.match('%') === null) {
				nativeWidth = `${nativeWidth}px`;
			}
		} else {
			nativeWidth = 'auto';
		}
		if (nativeHeight) {
			if (nativeHeight.match('%') === null) {
				nativeHeight = `${nativeHeight}px`;
			}
		} else {
			nativeHeight = 'auto';
		}
		t.node.style.width = nativeWidth;
		t.node.style.height = nativeHeight;

		// grab video and put it back in place
		if (!t.isDynamic) {
			t.node.setAttribute('controls', true);
			t.node.setAttribute('id', t.node.getAttribute('id').replace(`_${rendererName}`, '').replace('_from_mejs', ''));

			// Remove `autoplay` (not worth bringing it back once player is destroyed)
			delete t.node.autoplay;

			// Reintegrate file if it can be played
			if (t.media.canPlayType(getTypeFromFile(src))) {
				t.node.setAttribute('src', src);
			}

			// If <iframe>, remove overlay
			if (rendererName.match(/iframe/i) !== null) {
				const layer = document.getElementById(`${t.media.id}-iframe-overlay`);
				layer.parentNode.removeChild(layer);
			}

			const node = t.node.cloneNode(true);
			t.container.parentNode.insertBefore(node, t.container);
			t.node.parentNode.removeChild(t.node);
			delete t.node;
		} else {
			t.container.parentNode.insertBefore(t.node, t.container);
		}

		if (typeof t.media.destroy === 'function') {
			t.media.destroy();
		}

		// Remove the player from the mejs.players object so that pauseOtherPlayers doesn't blow up when trying to
		// pause a non existent Flash API.
		delete mejs.players[t.id];

		if (typeof t.container === 'object') {
			const offscreen = t.container.parentNode.querySelector(`.${t.options.classPrefix}offscreen`);
			offscreen.parentNode.removeChild(offscreen);
			t.container.parentNode.removeChild(t.container);
		}
		t.globalUnbind();

		delete t.media.player;
	}
}

window.MediaElementPlayer = MediaElementPlayer;

export default MediaElementPlayer;

// turn into plugin
(($) => {

	if (typeof $ !== 'undefined') {
		$.fn.mediaelementplayer = function (options) {
			if (options === false) {
				this.each(function () {
					const player = $(this).data('mediaelementplayer');
					if (player) {
						player.remove();
					}
					$(this).removeData('mediaelementplayer');
				});
			}
			else {
				this.each(function () {
					$(this).data('mediaelementplayer', new MediaElementPlayer(this, options));
				});
			}
			return this;
		};

		$(document).ready(() => {
			// auto enable using JSON attribute
			$(`.${config.classPrefix}player`).mediaelementplayer();
		});
	}

})(mejs.$);