/**
 * @license
 * Copyright 2011 Paul Felix (paul.eric.felix@gmail.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */
/*global Dygraph:false,TouchEvent:false */

/**
 * @fileoverview This file contains the RangeSelector plugin used to provide
 * a timeline range selector widget for dygraphs.
 */


// ===================================================
// RANGE SELECTOR T CLASS DEFINITION
// =====================================================
Dygraph.Plugins.RangeSelectorT = (function() {

"use strict";

// OK
var rangeSelectorT = function() {
  this.isIE_ = /MSIE/.test(navigator.userAgent) && !window.opera;
  this.hasTouchInterface_ = typeof(TouchEvent) != 'undefined';
  this.isMobileDevice_ = /mobile|android/gi.test(navigator.appVersion);
  this.interfaceCreated_ = false;
};

// OK
rangeSelectorT.prototype.toString = function() {
  return "rangeSelectorT Plugin";
};

// OK
rangeSelectorT.prototype.activate = function(dygraph) {
  this.dygraph_ = dygraph;
  this.isUsingExcanvas_ = dygraph.isUsingExcanvas_;
  if (this.getOption_('showRangeSelectorT')) {
    this.createInterface_();
  }
  return {
    layout: this.reserveSpace_,
    predraw: this.renderStaticLayer_,
    didDrawChart: this.renderInteractiveLayer_
  };
};

// OK CALMAN
rangeSelectorT.prototype.destroy = function() {
  this.bgcanvas_ = null;
  this.fgcanvas_ = null;
  this.leftZoomHandle_ = null;
  this.rightZoomHandle_ = null;
  // CALMAN
  this.topZoomHandle = null;
  this.bottomZoomHandle = null;
  this.iePanOverlay_ = null;
};

// ===================================================================
// Private methods
//===================================================================

rangeSelectorT.prototype.getOption_ = function(name) {
  return this.dygraph_.getOption(name);
};

rangeSelectorT.prototype.setDefaultOption_ = function(name, value) {
  return this.dygraph_.attrs_[name] = value;
};




/**
 * ---------------------------------------------------------------------
 * @private
 * Creates the range selector elements and adds them to the graph.
 * ---------------------------------------------------------------------
 */
rangeSelectorT.prototype.createInterface_ = function() {
  this.createCanvases_();
  if (this.isUsingExcanvas_) {
    this.createIEPanOverlay_();
  }
  this.createZoomHandles_();
  this.initInteraction_();

  // Range selector and animatedZooms have a bad interaction. See issue 359.
  if (this.getOption_('animatedZooms')) {
    this.dygraph_.warn('Animated zooms and range selector are not compatible; disabling animatedZooms.');
    this.dygraph_.updateOptions({animatedZooms: false}, true);
  }

  this.interfaceCreated_ = true;
  this.addToGraph_();
};



/**
 * ---------------------------------------------------------------------
 * @private
 * Adds the range selector to the graph.
 * ---------------------------------------------------------------------
 */
rangeSelectorT.prototype.addToGraph_ = function() {
  var graphDiv = this.graphDiv_ = this.dygraph_.graphDiv;
  graphDiv.appendChild(this.bgcanvas_);
  graphDiv.appendChild(this.fgcanvas_);
  graphDiv.appendChild(this.leftZoomHandle_);
  graphDiv.appendChild(this.rightZoomHandle_);
  // CALMAN
  graphDiv.appendChild(this.topZoomHandle_);
  graphDiv.appendChild(this.bottomZoomHandle_);
};



/**
 * ---------------------------------------------------------------------
 * @private
 * Removes the range selector from the graph.
 * ---------------------------------------------------------------------
 */
rangeSelectorT.prototype.removeFromGraph_ = function() {
  var graphDiv = this.graphDiv_;
  graphDiv.removeChild(this.bgcanvas_);
  graphDiv.removeChild(this.fgcanvas_);
  graphDiv.removeChild(this.leftZoomHandle_);
  graphDiv.removeChild(this.rightZoomHandle_);
  // CALMAN
  graphDiv.removeChild(this.topZoomHandle_);
  graphDiv.removeChild(this.bottomZoomHandle_);
  this.graphDiv_ = null;
};

/**
 * ---------------------------------------------------------------------
 * @private
 * Called by Layout to allow range selector to reserve its space.
 * ---------------------------------------------------------------------
 */
rangeSelectorT.prototype.reserveSpace_ = function(e) {
  if (this.getOption_('showRangeSelectorT')) {
	 // TODO - add option to reserve space on bottom or righthand side 
    e.reserveSpaceBottom(this.getOption_('rangeSelectorTHeight') + 4);
  }
};

/**
 * ---------------------------------------------------------------------
 * @private
 * Renders the static portion of the range selector at the predraw stage.
 * ---------------------------------------------------------------------
 */
rangeSelectorT.prototype.renderStaticLayer_ = function() {
  if (!this.updateVisibility_()) {
    return;
  }
  this.resize_();
  this.drawStaticLayer_();
};

/**
 * ---------------------------------------------------------------------
 * @private
 * Renders the interactive portion of the range selector after the chart has been drawn.
 * ---------------------------------------------------------------------
 */
rangeSelectorT.prototype.renderInteractiveLayer_ = function() {
  if (!this.updateVisibility_() || this.isChangingRange_) {
    return;
  }
  this.placeZoomHandles_();
  this.drawInteractiveLayer_();
};

/**
 * ---------------------------------------------------------------------
 * @private
 * Check to see if the range selector is enabled/disabled and update visibility accordingly.
 * ---------------------------------------------------------------------
 */
rangeSelectorT.prototype.updateVisibility_ = function() {
  var enabled = this.getOption_('showRangeSelectorT');
  if (enabled) {
    if (!this.interfaceCreated_) {
      this.createInterface_();
    } else if (!this.graphDiv_ || !this.graphDiv_.parentNode) {
      this.addToGraph_();
    }
  } else if (this.graphDiv_) {
    this.removeFromGraph_();
    var dygraph = this.dygraph_;
    setTimeout(function() { dygraph.width_ = 0; dygraph.resize(); }, 1);
  }
  return enabled;
};

/**
 * ---------------------------------------------------------------------
 * @private
 * Resizes the range selector.
 * TODO CALMAN
 * ---------------------------------------------------------------------
 */

	// TODO update resize range selectorto be able to distinguish between right hadn side and bottom location
rangeSelectorT.prototype.resize_ = function() {
  // --------------------------------------
  // SUBFUNCTION: set Element SIZE
  // --------------------------------------	
  function setElementRect(canvas, rect) {
    canvas.style.top = rect.y + 'px';
    canvas.style.left = rect.x + 'px';
    canvas.width = rect.w;
    canvas.height = rect.h;
    canvas.style.width = canvas.width + 'px';    // for IE
    canvas.style.height = canvas.height + 'px';  // for IE
  }

  var plotArea = this.dygraph_.layout_.getPlotArea();
  
  var xAxisLabelHeight = 0;
  if(this.getOption_('drawXAxis')){
    xAxisLabelHeight = this.getOption_('xAxisHeight') || (this.getOption_('axisLabelFontSize') + 2 * this.getOption_('axisTickSize'));
  }
  this.canvasRect_ = {
    x: plotArea.x,
    y: plotArea.y + plotArea.h + xAxisLabelHeight + 4,
    w: plotArea.w,
    h: this.getOption_('rangeSelectorTHeight')
  };

  setElementRect(this.bgcanvas_, this.canvasRect_);
  setElementRect(this.fgcanvas_, this.canvasRect_);
};

/**
 * ---------------------------------------------------------------------
 * @private
 * Creates the background and foreground canvases.
 * ---------------------------------------------------------------------
 */
rangeSelectorT.prototype.createCanvases_ = function() {
  this.bgcanvas_ = Dygraph.createCanvas();
  this.bgcanvas_.className = 'dygraph-rangesel-bgcanvas';
  this.bgcanvas_.style.position = 'absolute';
  this.bgcanvas_.style.zIndex = 9;
  this.bgcanvas_ctx_ = Dygraph.getContext(this.bgcanvas_);

  this.fgcanvas_ = Dygraph.createCanvas();
  this.fgcanvas_.className = 'dygraph-rangesel-fgcanvas';
  this.fgcanvas_.style.position = 'absolute';
  this.fgcanvas_.style.zIndex = 9;
  this.fgcanvas_.style.cursor = 'default';
  this.fgcanvas_ctx_ = Dygraph.getContext(this.fgcanvas_);
};

/**
 * ---------------------------------------------------------------------
 * @private
 * Creates overlay divs for IE/Excanvas so that mouse events are handled properly.
 * ---------------------------------------------------------------------
 */
rangeSelectorT.prototype.createIEPanOverlay_ = function() {
  this.iePanOverlay_ = document.createElement("div");
  this.iePanOverlay_.style.position = 'absolute';
  this.iePanOverlay_.style.backgroundColor = 'white';
  this.iePanOverlay_.style.filter = 'alpha(opacity=0)';
  this.iePanOverlay_.style.display = 'none';
  this.iePanOverlay_.style.cursor = 'move';
  this.fgcanvas_.appendChild(this.iePanOverlay_);
};

/**
 * ---------------------------------------------------------------------
 * @private
 * Creates the zoom handle elements.
 * TODO CALMAN
 * ---------------------------------------------------------------------
 */
rangeSelectorT.prototype.createZoomHandles_ = function() {
 
  // Horizontal Sliders 
  // -----------------------------
  var imgH = new Image();
  imgH.className = 'dygraph-rangesel-zoomhandle';
  imgH.style.position = 'absolute';
  imgH.style.zIndex = 10;
  imgH.style.visibility = 'hidden'; // Initially hidden so they don't show up in the wrong place.
  imgH.style.cursor = 'col-resize';

  if (/MSIE 7/.test(navigator.userAgent)) { // IE7 doesn't support embedded src data.
	  imgH.width = 7;
	  imgH.height = 14;
	  imgH.style.backgroundColor = 'white';
	  imgH.style.border = '1px solid #333333'; // Just show box in IE7.
  } else {
	  imgH.width = 9;
	  imgH.height = 16;
	  imgH.src = 'data:image/png;base64,' +
'iVBORw0KGgoAAAANSUhEUgAAAAkAAAAQCAYAAADESFVDAAAAAXNSR0IArs4c6QAAAAZiS0dEANAA' +
'zwDP4Z7KegAAAAlwSFlzAAAOxAAADsQBlSsOGwAAAAd0SU1FB9sHGw0cMqdt1UwAAAAZdEVYdENv' +
'bW1lbnQAQ3JlYXRlZCB3aXRoIEdJTVBXgQ4XAAAAaElEQVQoz+3SsRFAQBCF4Z9WJM8KCDVwownl' +
'6YXsTmCUsyKGkZzcl7zkz3YLkypgAnreFmDEpHkIwVOMfpdi9CEEN2nGpFdwD03yEqDtOgCaun7s' +
'qSTDH32I1pQA2Pb9sZecAxc5r3IAb21d6878xsAAAAAASUVORK5CYII=';
  }

  if (this.isMobileDevice_) {
	  imgH.width *= 2;
	  imgH.height *= 2;
  }
  
  
  // Vertical Sliders
  //-----------------------------
  var imgV = new Image();
  imgV.className = 'dygraph-rangesel-zoomhandle';
  imgV.style.position = 'absolute';
  imgV.style.zIndex = 10;
  imgV.style.visibility = 'hidden'; // Initially hidden so they don't show up in the wrong place.
  //imgV.style.cursor = 'col-resize';
  imgV.style.cursor = 'row-resize';

  if (/MSIE 7/.test(navigator.userAgent)) { // IE7 doesn't support embedded src data.
	  imgV.width = 7;
	  imgV.height = 14;
	  imgV.style.backgroundColor = 'white';
	  imgV.style.border = '1px solid #333333'; // Just show box in IE7.
  } else {
	  imgV.width = 20;
	  imgV.height = 9;
	  imgV.src = 'data:image/png;base64,' +
'iVBORw0KGgoAAAANSUhEUgAAAAkAAAAQCAYAAADESFVDAAAAAXNSR0IArs4c6QAAAAZiS0dEANAA' +
'zwDP4Z7KegAAAAlwSFlzAAAOxAAADsQBlSsOGwAAAAd0SU1FB9sHGw0cMqdt1UwAAAAZdEVYdENv' +
'bW1lbnQAQ3JlYXRlZCB3aXRoIEdJTVBXgQ4XAAAAaElEQVQoz+3SsRFAQBCF4Z9WJM8KCDVwownl' +
'6YXsTmCUsyKGkZzcl7zkz3YLkypgAnreFmDEpHkIwVOMfpdi9CEEN2nGpFdwD03yEqDtOgCaun7s' +
'qSTDH32I1pQA2Pb9sZecAxc5r3IAb21d6878xsAAAAAASUVORK5CYII=';
  }

  if (this.isMobileDevice_) {
	  imgV.width *= 2;
	  imgV.height *= 2;
  }

  
  
 
  
  
  this.leftZoomHandle_ = imgH;
  this.rightZoomHandle_ = imgH.cloneNode(false);
  this.topZoomHandle_ = imgV;  
  this.bottomZoomHandle_ = imgV.cloneNode(false);
  //this.bottomZoomHandle_ = imgV2;

  
};



/**
 * ---------------------------------------------------------------------
 * @private
 * Sets up the interaction for the range selector.
 * ---------------------------------------------------------------------
 */
rangeSelectorT.prototype.initInteraction_ = function() {
  var self = this;
  var topElem = this.isIE_ ? document : window;
  var clientXLast = 0;
  var clientYLast = 0; // CALMAN
  var handle = null;
  var isXZooming = false;
  var isYZooming = false;
  var isXPanning = false;
  var isYPanning = false;
  var dynamic = !this.isMobileDevice_ && !this.isUsingExcanvas_;

  // We cover iframes during mouse interactions. See comments in
  // dygraph-utils.js for more info on why this is a good idea.
  var tarp = new Dygraph.IFrameTarp();

  // functions, defined below.  Defining them this way (rather than with
  // "function foo() {...}" makes JSHint happy.
  // X Zoom Variables
  var toXDataWindow, onXZoomStart, onXZoom, onXZoomEnd, doXZoom;
  
  // Y Zoom Variables
  var toYDataWindow, onYZoomStart, onYZoom, onYZoomEnd, doYZoom; 
  
  // X Pan Varaibles
  var onPanStart, isMouseInPanZone, onXPan, onXPanEnd, doXPan, onCanvasHover;
  
  // Y Pan Variables
  var onYPanStart, onYPan, onYPanEnd, doYPan;
     
    // Touch event functions
  var onXZoomHandleTouchEvent, onCanvasTouchEvent, addTouchEvents;

  //--------------------------------------
  // Interaction SUBFUNCTION: Get xDataMin and xDataMax
  // --------------------------------------	
  toXDataWindow = function(zoomHandleStatus) {
    var xDataLimits = self.dygraph_.xAxisExtremes();
    var fact = (xDataLimits[1] - xDataLimits[0])/self.canvasRect_.w;
    var xDataMin = xDataLimits[0] + (zoomHandleStatus.leftHandlePos - self.canvasRect_.x)*fact;
    var xDataMax = xDataLimits[0] + (zoomHandleStatus.rightHandlePos - self.canvasRect_.x)*fact;
    return [xDataMin, xDataMax];
  };
  
  //--------------------------------------
  // Interaction SUBFUNCTION: Get yDataMin and yDataMax
  // CALMAN
  // TODO bC calman chekc if works
  // --------------------------------------	
  toYDataWindow = function(zoomHandleStatus) {
    var yDataLimits = self.dygraph_.yAxisExtremes();
    var fact = (yDataLimits[1] - yDataLimits[0])/self.canvasRect_.h; // change to height
    var yDataMin = yDataLimits[0] + (zoomHandleStatus.topHandlePos - self.canvasRect_.y)*fact; // change to y
    var yDataMax = yDataLimits[0] + (zoomHandleStatus.bottomHandlePos - self.canvasRect_.y)*fact; // change to y
    var yRows = self.dygraph_.rawData_[0].length - 1;
    return [self.dygraph_.toDataYCoord(yDataMin), self.dygraph_.toDataYCoord(yDataMax)];
  };

  //--------------------------------------
  // Interaction SUBFUNCTION: On starting to zoom X
  // --------------------------------------	
  onXZoomStart = function(e) {
    Dygraph.cancelEvent(e);
    isXZooming = true;
    clientXLast = e.clientX;
   // clientYLast = e.clientY; //CALMAN
    handle = e.target ? e.target : e.srcElement;
    if (e.type === 'mousedown' || e.type === 'dragstart') {
      // These events are removed manually.
      Dygraph.addEvent(topElem, 'mousemove', onXZoom);
      Dygraph.addEvent(topElem, 'mouseup', onXZoomEnd);
    }
    self.fgcanvas_.style.cursor = 'col-resize'; //CALMAN TODO? add in row-resize? for y direction
    tarp.cover();
    return true;
  };


  //--------------------------------------
  // Interaction SUBFUNCTION: On zoom X
  // --------------------------------------	
  onXZoom = function(e) {
    if (!isXZooming) {
      return false;
    }
    Dygraph.cancelEvent(e);

    var delX = e.clientX - clientXLast;

    // check if less than four pixels? 
    if (Math.abs(delX) < 4) {
      return true;
    }
    
    clientXLast = e.clientX;

    // Move handle.
    var zoomHandleStatus = self.getZoomHandleStatus_();
    var newPos;
    // Check if Left ZoomHandle
    if (handle == self.leftZoomHandle_) {
        newPos = zoomHandleStatus.leftHandlePos + delX;
        newPos = Math.min(newPos, zoomHandleStatus.rightHandlePos - handle.width - 3);
        newPos = Math.max(newPos, self.canvasRect_.x);  
      
    // Check if Right ZoomHandle
    } else { 
        newPos = zoomHandleStatus.rightHandlePos + delX;
        newPos = Math.min(newPos, self.canvasRect_.x + self.canvasRect_.w);
        newPos = Math.max(newPos, zoomHandleStatus.leftHandlePos + handle.width + 3);  
    } 
    
    var halfHandleWidth = handle.width/2;
    
    // update x position
    handle.style.left = (newPos - halfHandleWidth) + 'px';
      
    //update top and bottom sliders
    self.topZoomHandle_.style.left = (zoomHandleStatus.leftHandlePos + Math.abs(zoomHandleStatus.rightHandlePos-zoomHandleStatus.leftHandlePos)/2 - zoomHandleStatus.yHandleWidth/2) + 'px';
    self.bottomZoomHandle_.style.left = (zoomHandleStatus.leftHandlePos + Math.abs(zoomHandleStatus.rightHandlePos-zoomHandleStatus.leftHandlePos)/2 - zoomHandleStatus.yHandleWidth/2) + 'px';
    
    self.drawInteractiveLayer_();

    // Zoom on the fly (if not using excanvas).
    if (dynamic) {
      doXZoom();
    }
    return true;
  };

  //--------------------------------------
  // Interaction SUBFUNCTION: do zoom X
  // CALMAN TODO
  // --------------------------------------	
  doXZoom = function() {
    try {
      var zoomHandleStatus = self.getZoomHandleStatus_();
      self.isChangingRange_ = true;
      if (!zoomHandleStatus.isZoomed) {
        self.dygraph_.resetZoom();
      } else {
        var xDataWindow = toXDataWindow(zoomHandleStatus);
        self.dygraph_.doZoomXDates_(xDataWindow[0], xDataWindow[1]);
        
     //   var yDataWindow = toYDataWindow(zoomHandleStatus);
     //   self.dygraph_.doZoomY_(yDataWindow[0], yDataWindow[1]);
        
      }
      
      
    } finally {
      self.isChangingRange_ = false;
    }
  };

  
  
  //--------------------------------------
  //  Interaction SUBFUNCTION: On zoom end X
  // --------------------------------------	
  onXZoomEnd = function(e) {
    if (!isXZooming) {
      return false;
    }
    isXZooming = false;
    tarp.uncover();
    Dygraph.removeEvent(topElem, 'mousemove', onXZoom);
    Dygraph.removeEvent(topElem, 'mouseup', onXZoomEnd);
    self.fgcanvas_.style.cursor = 'default';

    // If using excanvas, Zoom now.
    if (!dynamic) {
      doXZoom();
    }
    return true;
  };

  

  
  //--------------------------------------
  // Interaction SUBFUNCTION: On starting to zoom Y
  // --------------------------------------	
  onYZoomStart = function(e) {
    Dygraph.cancelEvent(e);
    isYZooming = true;
    clientYLast = e.clientY;
   // clientYLast = e.clientY; //CALMAN
    handle = e.target ? e.target : e.srcElement;
    if (e.type === 'mousedown' || e.type === 'dragstart') {
      // These events are removed manually.
      Dygraph.addEvent(topElem, 'mousemove', onYZoom);
      Dygraph.addEvent(topElem, 'mouseup', onYZoomEnd);
    }
    self.fgcanvas_.style.cursor = 'row-resize'; //CALMAN TODO? add in row-resize? for y direction
    tarp.cover();
    return true;
  };
  
  
  //--------------------------------------
  // Interaction SUBFUNCTION: On zoom Y
  // CALMAN
  // --------------------------------------	
  onYZoom = function(e) {
    if (!isYZooming) {
      return false;
    }
    Dygraph.cancelEvent(e);

    var delY = e.clientY - clientYLast;
    
    // check if less than four pixels
    if (Math.abs(delY) < 4) {
      return true;
    }
    
    clientYLast = e.clientY; 

    // Move handle.
    var zoomHandleStatus = self.getZoomHandleStatus_();
    var newPos;
   
    // Check if Top ZoomHandle  - CALMAN
    if (handle == self.topZoomHandle_) { // CALMAN - TODO confirm works properly
        newPos = zoomHandleStatus.topHandlePos + delY;
        newPos = Math.min(newPos, zoomHandleStatus.bottomHandlePos - handle.width - 3); // change to bottomHandlePos
        newPos = Math.max(newPos, self.canvasRect_.y); // change to y, change to h
    
    // Check if Bottom ZoomHandle - CALMAN TODO confirm works properly
    } else {
    	newPos = zoomHandleStatus.bottomHandlePos + delY;
    	newPos = Math.min(newPos, self.canvasRect_.y + self.canvasRect_.h);
    	newPos = Math.max(newPos, zoomHandleStatus.topHandlePos + handle.width + 3); 
    }
    var halfHandleWidth = handle.width/2;
    
    // update vertical position
    handle.style.top = (newPos - halfHandleWidth) + 'px';
    
    // update xSliders
    self.leftZoomHandle_.style.top = (zoomHandleStatus.topHandlePos + Math.abs(zoomHandleStatus.topHandlePos - zoomHandleStatus.bottomHandlePos)/2 - zoomHandleStatus.xHandleHeight/2) + 'px';
    self.rightZoomHandle_.style.top = (zoomHandleStatus.topHandlePos + Math.abs(zoomHandleStatus.topHandlePos - zoomHandleStatus.bottomHandlePos)/2 - zoomHandleStatus.xHandleHeight/2) + 'px';
    
    
    self.drawInteractiveLayer_();

    // Zoom on the fly (if not using excanvas).
    if (dynamic) {
      doYZoom();
    }
    return true;
  };
  
  
  //--------------------------------------
  //  Interaction SUBFUNCTION: On zoom end Y
  // --------------------------------------	
  onYZoomEnd = function(e) {
    if (!isYZooming) {
      return false;
    }
    isYZooming = false;
    tarp.uncover();
    Dygraph.removeEvent(topElem, 'mousemove', onYZoom);
    Dygraph.removeEvent(topElem, 'mouseup', onYZoomEnd);
    self.fgcanvas_.style.cursor = 'default';

    // If using excanvas, Zoom now.
    if (!dynamic) {
      doYZoom();
    }
    return true;
  };

  
  //--------------------------------------
  // Interaction SUBFUNCTION: do zoom Y
  // CALMAN TODO
  // --------------------------------------	
  doYZoom = function() {
    try {
      var zoomHandleStatus = self.getZoomHandleStatus_();
      self.isChangingRange_ = true;
      if (!zoomHandleStatus.isZoomed) {
        self.dygraph_.resetZoom();
      } else {
            var yDataWindow = toYDataWindow(zoomHandleStatus);
            self.dygraph_.doZoomY_(yDataWindow[0], yDataWindow[1])
      }
      
      
    } finally {
      self.isChangingRange_ = false;
    }
  };

  //--------------------------------------
  // Interaction SUBFUNCTION: Is Mouse in Pan Zone
  // CALMAN TODO - add in within y range
  // --------------------------------------	
  isMouseInPanZone = function(e) {
    if (self.isUsingExcanvas_) {
        return e.srcElement == self.iePanOverlay_;
    } else {
      var rect = self.leftZoomHandle_.getBoundingClientRect();
      var leftHandleClientX = rect.left + rect.width/2;
      rect = self.rightZoomHandle_.getBoundingClientRect();
      var rightHandleClientX = rect.left + rect.width/2;
      return (e.clientX > leftHandleClientX && e.clientX < rightHandleClientX);
      
      // TODO addin top/bottom handle check.
    }
  };

  //--------------------------------------
  // Interaction SUBFUNCTION: On  Pan Start
  // --------------------------------------	
  onPanStart = function(e) {
    if (!isXPanning && isMouseInPanZone(e) && self.getZoomHandleStatus_().isZoomed) {
      Dygraph.cancelEvent(e);
      isXPanning = true;
      clientXLast = e.clientX;
      //clientYLast = e.clientY; // CALMAN
      if (e.type === 'mousedown') {
        // These events are removed manually.
        Dygraph.addEvent(topElem, 'mousemove', onXPan);
        Dygraph.addEvent(topElem, 'mouseup', onXPanEnd);
       // Dygraph.addEvent(topElem, 'mousemove', onYPan);
       // Dygraph.addEvent(topElem, 'mouseup', onYPanEnd);
      }
      return true;
    }
    return false;
  };
  
  //--------------------------------------
  // Interaction SUBFUNCTION: On Y Pan Start
  // CALMAN
  // --------------------------------------	
  onYPanStart = function(e) {
    if (!isYPanning && isMouseInPanZone(e) && self.getZoomHandleStatus_().isZoomed) {
      Dygraph.cancelEvent(e);
      isYPanning = true;
      clientYLast = e.clientY;
      if (e.type === 'mousedown') {
        // These events are removed manually.
        Dygraph.addEvent(topElem, 'mousemove', onYPan);
        Dygraph.addEvent(topElem, 'mouseup', onYPanEnd);
      }
      return true;
    }
    return false;
  };

  
  
  
  //--------------------------------------
  // Interaction SUBFUNCTION: On X Pan
  // --------------------------------------	
  onXPan = function(e) {
    if (!isXPanning) {
      return false;
    }
    Dygraph.cancelEvent(e);

    var delX = e.clientX - clientXLast;
    var delY = e.clientY - clientYLast;
    // check if less than four pixels = TODO add in Y CHECK
    if (Math.abs(delX) < 4) {
      return true;
    }
    
    clientXLast = e.clientX;
    clientYLast = e.clientY;
    // Move range view
    var zoomHandleStatus = self.getZoomHandleStatus_();
   

    var leftHandlePos = zoomHandleStatus.leftHandlePos;
    var rightHandlePos = zoomHandleStatus.rightHandlePos;   
    var rangeXSize = rightHandlePos - leftHandlePos;
  
    // Update X Range Size
    if (leftHandlePos + delX <= self.canvasRect_.x) {
      leftHandlePos = self.canvasRect_.x;
      rightHandlePos = leftHandlePos + rangeXSize;
    } else if (rightHandlePos + delX >= self.canvasRect_.x + self.canvasRect_.w) {
      rightHandlePos = self.canvasRect_.x + self.canvasRect_.w;
      leftHandlePos = rightHandlePos - rangeXSize;
    } else {
      leftHandlePos += delX;
      rightHandlePos += delX;
    }
    
     var halfHandleWidthX = self.leftZoomHandle_.width/2;
     self.leftZoomHandle_.style.left = (leftHandlePos - halfHandleWidthX) + 'px';
     self.rightZoomHandle_.style.left = (rightHandlePos - halfHandleWidthX) + 'px';
     self.topZoomHandle_.style.left = leftHandlePos + (rightHandlePos - leftHandlePos)/2 - zoomHandleStatus.yHandleWidth/2 + 'px';
     self.bottomZoomHandle_.style.left = leftHandlePos + (rightHandlePos - leftHandlePos)/2 - zoomHandleStatus.yHandleWidth/2 + 'px';
     // Update position of top and bottom sliders
     //self.topZoomHandle_.style.left = (leftHandlePos + (rightHandlePos - leftHandlePos)/2); //- (self.topZoomHandle_.width/2);
     //self.topZoomHandle_.style.left = (self.leftZoomHandle_.style.left + Math.abs(self.leftZoomHandle_.style.left - self.rightZoomHandle_.style.left)/2 - zoomHandleStatus.yHandleWidth/2) + 'px';
     //self.bottomZoomHandle_.style.left = (self.leftZoomHandle_.style.left + Math.abs(self.leftZoomHandle_.style.left - self.rightZoomHandle_.style.left)/2 - zoomHandleStatus.yHandleWidth/2) + 'px';
     
     
     self.drawInteractiveLayer_();

    // Do pan on the fly (if not using excanvas).
    if (dynamic) {
      doXPan();
    }
    return true;
  };
  

  //--------------------------------------
  // Interaction SUBFUNCTION: On X Pan End
  // --------------------------------------	
  onXPanEnd = function(e) {
    if (!isXPanning) {
      return false;
    }
    isXPanning = false;
    Dygraph.removeEvent(topElem, 'mousemove', onXPan);
    Dygraph.removeEvent(topElem, 'mouseup', onXPanEnd);
    // If using excanvas, do pan now.
    if (!dynamic) {
      doXPan();
    }
    return true;
  };
  
  //--------------------------------------
  // Interaction SUBFUNCTION: Do X Pan
  // --------------------------------------	
  doXPan = function() {
    try {
      self.isChangingRange_ = true;
      self.dygraph_.dateWindow_ = toXDataWindow(self.getZoomHandleStatus_());
      self.dygraph_.drawGraph_(false);
    } finally {
      self.isChangingRange_ = false;
    }
  };

  
  
  //--------------------------------------
  // Interaction SUBFUNCTION: On Y Pan
  // CALMAN
  // --------------------------------------	
  onYPan = function(e) {
    if (!isYPanning) {
      return false;
    }
    Dygraph.cancelEvent(e);

    var delY = e.clientY - clientYLast; 
    
    // check if less than four pixels
    if (Math.abs(delY) < 4) {
      return true;
    }
    clientYLast = e.clientY;

    // Move range view
    var zoomHandleStatus = self.getZoomHandleStatus_();
    var topHandlePos = zoomHandleStatus.topHandlePos;	// CALMAN
    var bottomHandlePos = zoomHandleStatus.bottomHandlePos; // CALMAN
    var rangeYSize = topHandlePos - bottomHandlePos; // CALMAN
    
       
    // Update Y Range Size - CALMAN
    if(topHandlePos + delY <= self.canvasRect_.y){
    	topHandlePos = self.canvasRect_.y;
    	bottomHandlePos = topHandlePos + rangeYSize;
    } else if(bottomHandlePos + delY >= self.canvasRect_.y + self.canvasRect_.h){
    	bottomHandlePos = self.canvasRect_.y + self.canvasRect_.h;
    	topHandlePos = bottomHandlePos - rangeYSize;
    } else {
    	topHandlePos += delY;
    	bottomHandlePos += delY;
    }
    
    var halfHandleWidthY = self.topZoomHandle_.height/2; //CALMAN
    self.topZoomHandle_.style.top = (topHandlePos - halfHandleWidthY) +'px';  //CALMAN
    self.bottomZoomHandle_.style.top = (bottomHandlePos - halfHandleWidthY) +'px';  //CALMAN
    self.drawInteractiveLayer_();

    // Do pan on the fly (if not using excanvas).
    if (dynamic) {
      doYPan();
    }
    return true;
  };

  

  
  //--------------------------------------
  // Interaction SUBFUNCTION: On Y Pan End
  // CALMAN
  // --------------------------------------	
  onYPanEnd = function(e) {
    if (!isYPanning) {
      return false;
    }
    isYPanning = false;
    Dygraph.removeEvent(topElem, 'mousemove', onYPan);
    Dygraph.removeEvent(topElem, 'mouseup', onYPanEnd);
    // If using excanvas, do pan now.
    if (!dynamic) {
      doYPan();
    }
    return true;
  };


  //--------------------------------------
  // Interaction SUBFUNCTION: Do Y Pan
  // --------------------------------------	
  doYPan = function() {
    try {
      self.isChangingRange_ = true;
      self.dygraph_.valueWindow_ = toYDataWindow(self.getZoomHandleStatus_());
      self.dygraph_.drawGraph_(false);
    } finally {
      self.isChangingRange_ = false;
    }
  };

  
  
  //--------------------------------------
  // Interacation SUBFUNCTION: On Canvas hover
  // TODO calman make for x and y 
  // --------------------------------------	
  onCanvasHover = function(e) {
    if (isXZooming || isXPanning) {
      return;
    }
    var cursor = isMouseInPanZone(e) ? 'move' : 'default';
    if (cursor != self.fgcanvas_.style.cursor) {
      self.fgcanvas_.style.cursor = cursor;
    }
  };

  
  //--------------------------------------
  // Interaction SUBFUNCTION: On Zoom Handle Touch Event
  // TODO Calman  make x and y zoom handle touch event
  // --------------------------------------	
  onXZoomHandleTouchEvent = function(e) {
    if (e.type == 'touchstart' && e.targetTouches.length == 1) {
      if (onZoomStart(e.targetTouches[0])) {
        Dygraph.cancelEvent(e);
      }
    } else if (e.type == 'touchmove' && e.targetTouches.length == 1) {
      if (onZoom(e.targetTouches[0])) {
        Dygraph.cancelEvent(e);
      }
    } else {
      onZoomEnd(e);
    }
  };

  //--------------------------------------
  // Interaction SUBFUNCTION: On Canvas Touch Event
  // TODO calman
  // --------------------------------------	
  onCanvasTouchEvent = function(e) {
    if (e.type == 'touchstart' && e.targetTouches.length == 1) {
      if (onPanStart(e.targetTouches[0])) {
        Dygraph.cancelEvent(e);
      }
    } else if (e.type == 'touchmove' && e.targetTouches.length == 1) {
      if (onPan(e.targetTouches[0])) {
        Dygraph.cancelEvent(e);
      }
    } else {
      onPanEnd(e);
    }
  };

  //--------------------------------------
  // Interaction SUBFUNCTION: Add Touch Events
  // --------------------------------------	
  addTouchEvents = function(elem, fn) {
    var types = ['touchstart', 'touchend', 'touchmove', 'touchcancel'];
    for (var i = 0; i < types.length; i++) {
      self.dygraph_.addEvent(elem, types[i], fn);
    }
  };

  
  
  this.setDefaultOption_('interactionModel', Dygraph.Interaction.dragIsPanInteractionModel);
  this.setDefaultOption_('panEdgeFraction', 0.0001);

  var dragStartEvent = window.opera ? 'mousedown' : 'dragstart';
  this.dygraph_.addEvent(this.leftZoomHandle_, dragStartEvent, onXZoomStart);
  this.dygraph_.addEvent(this.rightZoomHandle_, dragStartEvent, onXZoomStart);
  
  this.dygraph_.addEvent(this.topZoomHandle_, dragStartEvent, onYZoomStart);  // Calman
  this.dygraph_.addEvent(this.bottomZoomHandle_, dragStartEvent, onYZoomStart);  // Calman
  
  if (this.isUsingExcanvas_) {
    this.dygraph_.addEvent(this.iePanOverlay_, 'mousedown', onPanStart);
  } else {
    this.dygraph_.addEvent(this.fgcanvas_, 'mousedown', onPanStart);
    this.dygraph_.addEvent(this.fgcanvas_, 'mousemove', onCanvasHover);
  }

  // Touch events
  if (this.hasTouchInterface_) {
    addTouchEvents(this.leftZoomHandle_, onXZoomHandleTouchEvent);
    addTouchEvents(this.rightZoomHandle_, onXZoomHandleTouchEvent);
    addTouchEvents(this.topZoomHandle_, onYZoomHandleTouchEvent);  // Calman
    addTouchEvents(this.bottomZoomHandle_, onYZoomHandleTouchEvent); // Calman
    addTouchEvents(this.fgcanvas_, onCanvasTouchEvent);
  }
};






/**
 * ---------------------------------------------------------------------
 * @private
 * Draws the static layer in the background canvas.
 * ---------------------------------------------------------------------
 */
rangeSelectorT.prototype.drawStaticLayer_ = function() {
  var ctx = this.bgcanvas_ctx_;
  ctx.clearRect(0, 0, this.canvasRect_.w, this.canvasRect_.h);
  try {
    this.drawMiniPlot_();
  } catch(ex) {
    Dygraph.warn(ex);
  }

  var margin = 0.5;
  this.bgcanvas_ctx_.lineWidth = 1;
  ctx.strokeStyle = 'gray';
  ctx.beginPath();
  ctx.moveTo(margin, margin);
  ctx.lineTo(margin, this.canvasRect_.h-margin);
  ctx.lineTo(this.canvasRect_.w-margin, this.canvasRect_.h-margin);
  ctx.lineTo(this.canvasRect_.w-margin, margin);
  ctx.stroke();
};


/**
 * ---------------------------------------------------------------------
 * @private
 * Draws the mini plot in the background canvas.
 * ---------------------------------------------------------------------
 */
rangeSelectorT.prototype.drawMiniPlot_ = function() {
  var fillStyle = this.getOption_('rangeSelectorTPlotFillColor');
  var strokeStyle = this.getOption_('rangeSelectorTPlotStrokeColor');
  if (!fillStyle && !strokeStyle) {
    return;
  }

  var stepPlot = this.getOption_('stepPlot');

  var combinedSeriesData = this.computeCombinedSeriesAndLimits_(); //tODO combined series data remove.
  var yRange = combinedSeriesData.yMax - combinedSeriesData.yMin;  //TODO combined series data remove

  // Draw the mini plot.
  var ctx = this.bgcanvas_ctx_;
  var margin = 0.5;

  var xExtremes = this.dygraph_.xAxisExtremes();
  var xRange = Math.max(xExtremes[1] - xExtremes[0], 1.e-30);
  var xFact = (this.canvasRect_.w - margin)/xRange;
  var yFact = (this.canvasRect_.h - margin)/yRange;
  var canvasWidth = this.canvasRect_.w - margin;
  var canvasHeight = this.canvasRect_.h - margin;

  var prevX = null, prevY = null;

  ctx.beginPath();
  ctx.moveTo(margin, canvasHeight);
  for (var i = 0; i < combinedSeriesData.data.length; i++) {
    var dataPoint = combinedSeriesData.data[i];
    var x = ((dataPoint[0] !== null) ? ((dataPoint[0] - xExtremes[0])*xFact) : NaN);
    var y = ((dataPoint[1] !== null) ? (canvasHeight - (dataPoint[1] - combinedSeriesData.yMin)*yFact) : NaN);
    if (isFinite(x) && isFinite(y)) {
      if(prevX === null) {
        ctx.lineTo(x, canvasHeight);
      }
      else if (stepPlot) {
        ctx.lineTo(x, prevY);
      }
      ctx.lineTo(x, y);
      prevX = x;
      prevY = y;
    }
    else {
      if(prevX !== null) {
        if (stepPlot) {
          ctx.lineTo(x, prevY);
          ctx.lineTo(x, canvasHeight);
        }
        else {
          ctx.lineTo(prevX, canvasHeight);
        }
      }
      prevX = prevY = null;
    }
  }
  ctx.lineTo(canvasWidth, canvasHeight);
  ctx.closePath();

  if (fillStyle) {
    var lingrad = this.bgcanvas_ctx_.createLinearGradient(0, 0, 0, canvasHeight);
    lingrad.addColorStop(0, 'white');
    lingrad.addColorStop(1, fillStyle);
    this.bgcanvas_ctx_.fillStyle = lingrad;
    ctx.fill();
  }

  if (strokeStyle) {
    this.bgcanvas_ctx_.strokeStyle = strokeStyle;
    this.bgcanvas_ctx_.lineWidth = 1.5;
    ctx.stroke();
  }
};

/**
 * ---------------------------------------------------------------------
 * @private
 * Computes and returns the combinded series data along with min/max for the mini plot.
 * @return {Object} An object containing combinded series array, ymin, ymax.
 * 
 * TODO calman remove the combined series fucntionality nad calculate ymin and ymax from data.
 * ---------------------------------------------------------------------
 */
rangeSelectorT.prototype.computeCombinedSeriesAndLimits_ = function() {
  var data = this.dygraph_.rawData_;
  var logscale = this.getOption_('logscale');

  // Create a combined series (average of all series values).
  var combinedSeries = [];
  var sum;
  var count;
  var mutipleValues;
  var i, j, k;
  var xVal, yVal;

  // Find out if data has multiple values per datapoint.
  // Go to first data point that actually has values (see http://code.google.com/p/dygraphs/issues/detail?id=246)
  for (i = 0; i < data.length; i++) {
    if (data[i].length > 1 && data[i][1] !== null) {
      mutipleValues = typeof data[i][1] != 'number';
      if (mutipleValues) {
        sum = [];
        count = [];
        for (k = 0; k < data[i][1].length; k++) {
          sum.push(0);
          count.push(0);
        }
      }
      break;
    }
  }

  for (i = 0; i < data.length; i++) {
    var dataPoint = data[i];
    xVal = dataPoint[0];

    if (mutipleValues) {
      for (k = 0; k < sum.length; k++) {
        sum[k] = count[k] = 0;
      }
    } else {
      sum = count = 0;
    }

    for (j = 1; j < dataPoint.length; j++) {
      if (this.dygraph_.visibility()[j-1]) {
        var y;
        if (mutipleValues) {
          for (k = 0; k < sum.length; k++) {
            y = dataPoint[j][k];
            if (y === null || isNaN(y)) continue;
            sum[k] += y;
            count[k]++;
          }
        } else {
          y = dataPoint[j];
          if (y === null || isNaN(y)) continue;
          sum += y;
          count++;
        }
      }
    }

    if (mutipleValues) {
      for (k = 0; k < sum.length; k++) {
        sum[k] /= count[k];
      }
      yVal = sum.slice(0);
    } else {
      yVal = sum/count;
    }

    combinedSeries.push([xVal, yVal]);
  }

  // Account for roll period, fractions.
  combinedSeries = this.dygraph_.rollingAverage(combinedSeries, this.dygraph_.rollPeriod_);

  if (typeof combinedSeries[0][1] != 'number') {
    for (i = 0; i < combinedSeries.length; i++) {
      yVal = combinedSeries[i][1];
      combinedSeries[i][1] = yVal[0];
    }
  }

  // Compute the y range.
  var yMin = Number.MAX_VALUE;
  var yMax = -Number.MAX_VALUE;
  for (i = 0; i < combinedSeries.length; i++) {
    yVal = combinedSeries[i][1];
    if (yVal !== null && isFinite(yVal) && (!logscale || yVal > 0)) {
      yMin = Math.min(yMin, yVal);
      yMax = Math.max(yMax, yVal);
    }
  }

  // Convert Y data to log scale if needed.
  // Also, expand the Y range to compress the mini plot a little.
  var extraPercent = 0.25;
  if (logscale) {
    yMax = Dygraph.log10(yMax);
    yMax += yMax*extraPercent;
    yMin = Dygraph.log10(yMin);
    for (i = 0; i < combinedSeries.length; i++) {
      combinedSeries[i][1] = Dygraph.log10(combinedSeries[i][1]);
    }
  } else {
    var yExtra;
    var yRange = yMax - yMin;
    if (yRange <= Number.MIN_VALUE) {
      yExtra = yMax*extraPercent;
    } else {
      yExtra = yRange*extraPercent;
    }
    yMax += yExtra;
    yMin -= yExtra;
  }

  return {data: combinedSeries, yMin: yMin, yMax: yMax};
};

/**
 * ---------------------------------------------------------------------
 * @private
 * Places the zoom handles in the proper position based on the current X data window.
 * ---------------------------------------------------------------------
 */
rangeSelectorT.prototype.placeZoomHandles_ = function() {
	
	
  // X Axis Zoom Handles
  // -------------------------
  // get xrange extremes
  var xExtremes = this.dygraph_.xAxisExtremes();
  var xWindowLimits = this.dygraph_.xAxisRange();
  var xRange = xExtremes[1] - xExtremes[0];
  
  // calcualte percentage left and right
  var leftPercent = Math.max(0, (xWindowLimits[0] - xExtremes[0])/xRange);
  var rightPercent = Math.max(0, (xExtremes[1] - xWindowLimits[1])/xRange);
  
  // calculate left and right coordinates
  var leftCoord = this.canvasRect_.x + this.canvasRect_.w*leftPercent;
  var rightCoord = this.canvasRect_.x + this.canvasRect_.w*(1 - rightPercent);
  
  // calculate distance from top
  var handleTop = Math.max(this.canvasRect_.y, this.canvasRect_.y + (this.canvasRect_.h - this.leftZoomHandle_.height)/2);
  var halfHandleWidth = this.leftZoomHandle_.width/2;
  
  // set left handle
  this.leftZoomHandle_.style.left = (leftCoord - halfHandleWidth) + 'px';
  this.leftZoomHandle_.style.top = handleTop + 'px';
  
  // set right handle
  this.rightZoomHandle_.style.left = (rightCoord - halfHandleWidth) + 'px';
  this.rightZoomHandle_.style.top = this.leftZoomHandle_.style.top;

  // set visible
  this.leftZoomHandle_.style.visibility = 'visible';
  this.rightZoomHandle_.style.visibility = 'visible';
  
  // Y Axis Zoom Handles - CALMAN
  // -------------------------
  // get yrange extremes
  var yExtremes = this.dygraph_.yAxisExtremes();
  var yRange = yExtremes[1] - yExtremes[0];
  
  // calcualate top and bottom coordinates
  var topCoord = this.canvasRect_.y; //+ this.canvasRect_.h;//*topPercent;
  var bottomCoord = this.canvasRect_.y + this.canvasRect_.h;//*(1-topPercent);
  
  // calculate distance from left
  var myX = this.canvasRect_.x;
  var handleLeft = Math.max(myX, myX + (this.canvasRect_.w - this.topZoomHandle_.width)/2);
  
  var yHalfHandleWidth = this.topZoomHandle_.height/2;
  
  // Set top handle
  this.topZoomHandle_.style.left = handleLeft + 'px';
  this.topZoomHandle_.style.top = (topCoord - yHalfHandleWidth)+'px';
  
  // set bottom handle- TODO calman fix need tow ork out why not visible
  this.bottomZoomHandle_.style.left = handleLeft+'px';
  this.bottomZoomHandle_.style.top = (bottomCoord - yHalfHandleWidth)+'px';
   
  //set visible
  this.topZoomHandle_.style.visibility = 'visible';
  this.bottomZoomHandle_.style.visibility = 'visible';
};




/**
 * ---------------------------------------------------------------------
 * @private
 * Draws the interactive layer in the foreground canvas.
 * ---------------------------------------------------------------------
 */
rangeSelectorT.prototype.drawInteractiveLayer_ = function() {
  var ctx = this.fgcanvas_ctx_;
  ctx.clearRect(0, 0, this.canvasRect_.w, this.canvasRect_.h);
  var margin = 1;
  var width = this.canvasRect_.w - margin;
  var height = this.canvasRect_.h - margin;
  var zoomHandleStatus = this.getZoomHandleStatus_();

  ctx.strokeStyle = 'black';
  if (!zoomHandleStatus.isZoomed) {
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height);
    ctx.lineTo(width, height);
    ctx.lineTo(width, margin);
    ctx.stroke();
    if (this.iePanOverlay_) {
      this.iePanOverlay_.style.display = 'none';
    }
  } else {
	
	// Get handle positions on canvas
    var leftHandleCanvasPos = Math.max(margin, zoomHandleStatus.leftHandlePos - this.canvasRect_.x);
    var rightHandleCanvasPos = Math.min(width, zoomHandleStatus.rightHandlePos - this.canvasRect_.x);
    
    var topHandleCanvasPos = Math.max(margin, zoomHandleStatus.topHandlePos - this.canvasRect_.y); // CALMAN
    var bottomHandleCanvasPos = Math.min(height, zoomHandleStatus.bottomHandlePos - this.canvasRect_.y); // CALMAN
    

    // Fill space outside of desired range
    ctx.fillStyle = 'rgba(240, 240, 240, 0.6)';
    // ctx.fillRect(x, y, Width, height); xy              ->    (x+widht), y 
    //                                    |             FILL           |
    //                                    x, (y+height)   <-     (x + width), (y + height)
    ctx.fillRect(0, 0, leftHandleCanvasPos, this.canvasRect_.h); // fill in unused space on left of left hand handle
    ctx.fillRect(rightHandleCanvasPos, 0, this.canvasRect_.w - rightHandleCanvasPos, this.canvasRect_.h); // fill in unused space on right hand side of right handle
    ctx.fillRect(0,0, this.canvasRect_.w, topHandleCanvasPos); // fill in unused space on top of top handle // calman - this one defs works
    ctx.fillRect(0, bottomHandleCanvasPos, this.canvasRect_.w, this.canvasRect_.h); // fill in  unused space beneath bottom handle // calman
    
   
    // outline unused left hand side
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(leftHandleCanvasPos,margin);
    ctx.lineTo(leftHandleCanvasPos, height);
    ctx.lineTo(margin, height);
    ctx.stroke();

    // outline unused right hand side
    ctx.beginPath();
    ctx.moveTo(width, margin);
    ctx.lineTo(rightHandleCanvasPos,margin);
    ctx.lineTo(rightHandleCanvasPos, height);
    ctx.lineTo(width, height);
    ctx.stroke();
    
    // outline unused top part
    ctx.beginPath();
    ctx.moveTo(leftHandleCanvasPos, topHandleCanvasPos);
    ctx.lineTo(rightHandleCanvasPos, topHandleCanvasPos);
    ctx.stroke();
    
    // outline unused top part
    ctx.beginPath();
    ctx.moveTo(leftHandleCanvasPos, bottomHandleCanvasPos);
    ctx.lineTo(rightHandleCanvasPos, bottomHandleCanvasPos);
    ctx.stroke();
    

    if (this.isUsingExcanvas_) {
      this.iePanOverlay_.style.width = (rightHandleCanvasPos - leftHandleCanvasPos) + 'px';
      this.iePanOverlay_.style.left = leftHandleCanvasPos + 'px';
     
      this.iePanOverlay_.style.height = (bottomHandleCanvasPos - topHandleCanvasPos) + 'px';
      this.iePanOverlay_.style.top = topHandleCanvasPos + 'px';
      //this.iePanOverlay_.style.height = height + 'px'; // TODO CALMAN update so that it goes to the correct height based on top and bottom handles
      this.iePanOverlay_.style.display = 'inline';
    }
  }
};

/**
 * ---------------------------------------------------------------------
 * @private
 * Returns the current zoom handle position information.
 * @return {Object} The zoom handle status.
 * ---------------------------------------------------------------------
 */
rangeSelectorT.prototype.getZoomHandleStatus_ = function() {
  var halfHandleWidth = this.leftZoomHandle_.width/2;
  var leftHandlePos = parseFloat(this.leftZoomHandle_.style.left) + halfHandleWidth;
  var rightHandlePos = parseFloat(this.rightZoomHandle_.style.left) + halfHandleWidth;
  
  var yHalfHandleHeight = this.topZoomHandle_.height/2; // CALMAN
 
  var topHandlePos = parseFloat(this.topZoomHandle_.style.top) + yHalfHandleHeight; // CALMAN
  var bottomHandlePos = parseFloat(this.bottomZoomHandle_.style.top) + yHalfHandleHeight; // CALMAN

  
  return {
      leftHandlePos: leftHandlePos,
      rightHandlePos: rightHandlePos,
      topHandlePos: topHandlePos,
      bottomHandlePos: bottomHandlePos,
      //isZoomed: (leftHandlePos - 1 > this.canvasRect_.x || rightHandlePos + 1 < this.canvasRect_.x+this.canvasRect_.w)
      isZoomed: (leftHandlePos - 1 > this.canvasRect_.x || rightHandlePos + 1 < this.canvasRect_.x+this.canvasRect_.w || topHandlePos -1 > this.canvasRect_.y || bottomHandlePos + 1 < this.canvasRect_.y + this.canvasRect_.h), // CALMAN
      xHandleHeight: this.leftZoomHandle_.height,
      yHandleWidth: this.topZoomHandle_.width
  };
};

return rangeSelectorT;

})();
